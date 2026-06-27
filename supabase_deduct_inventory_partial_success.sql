begin;

drop function if exists public.deduct_inventory_and_lock_cost(bigint);
drop function if exists public.deduct_inventory_and_lock_cost(integer);

create or replace function public.deduct_inventory_and_lock_cost(p_order_id bigint)
returns jsonb
language plpgsql
as $$
declare
  v_order orders%rowtype;
  v_inventory_enabled boolean;
  v_snapshot_id bigint;
  v_existing_snapshot_id bigint;
  v_total_revenue numeric := 0;
  v_total_cost numeric := 0;
  v_total_profit numeric := 0;
  v_skipped_items jsonb := '[]'::jsonb;
  v_deducted_items jsonb := '[]'::jsonb;
  v_partial boolean := false;
begin
  select *
    into v_order
    from orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  select r.inventory_enabled
    into v_inventory_enabled
    from restaurants r
   where r.id = v_order.restaurant_id;

  if not found then
    raise exception 'Restaurant % not found for order %', v_order.restaurant_id, p_order_id;
  end if;

  if not coalesce(v_inventory_enabled, false) then
    update orders
       set inventory_deducted = true
     where id = p_order_id
       and restaurant_id = v_order.restaurant_id;

    return jsonb_build_object(
      'success', true,
      'partial', false,
      'skipped', true,
      'message', 'Inventory disabled; deduction skipped',
      'snapshot_id', null,
      'total_cost', 0,
      'total_revenue', 0,
      'total_profit', 0,
      'skipped_items', '[]'::jsonb,
      'deducted_items', '[]'::jsonb,
      'deduction', jsonb_build_object(
        'success', true,
        'partial', false,
        'skipped', true,
        'message', 'Inventory disabled; deduction skipped'
      )
    );
  end if;

  if coalesce(v_order.inventory_deducted, false) then
    select
      ocs.id,
      coalesce(ocs.total_cost, 0),
      coalesce(ocs.total_revenue, 0),
      coalesce(ocs.total_profit, 0)
      into v_existing_snapshot_id, v_total_cost, v_total_revenue, v_total_profit
      from order_cost_snapshots ocs
     where ocs.order_id = p_order_id
     order by ocs.created_at desc, ocs.id desc
     limit 1;

    return jsonb_build_object(
      'success', true,
      'partial', false,
      'message', 'Inventory already deducted',
      'snapshot_id', v_existing_snapshot_id,
      'total_cost', v_total_cost,
      'total_revenue', v_total_revenue,
      'total_profit', v_total_profit,
      'skipped_items', '[]'::jsonb,
      'deducted_items', '[]'::jsonb,
      'deduction', jsonb_build_object(
        'success', true,
        'partial', false,
        'message', 'Inventory already deducted'
      )
    );
  end if;

  drop table if exists pg_temp.deduct_inventory_materials;
  drop table if exists pg_temp.deduct_inventory_totals;

  create temporary table deduct_inventory_materials on commit drop as
  with active_order_items as (
    select
      oi.id as order_item_id,
      oi.order_id,
      coalesce(nullif(oi.item_name, ''), mi.item_name) as order_item_name,
      oi.quantity,
      oi.unit_price,
      oi.menu_item_id,
      oi.menu_item_variant_id
    from order_items oi
    left join menu_items mi
      on mi.id = oi.menu_item_id
     and mi.restaurant_id = v_order.restaurant_id
    where oi.order_id = p_order_id
      and coalesce(oi.voided, false) = false
  ),
  material_links as (
    select
      aoi.order_item_id,
      aoi.order_id,
      aoi.order_item_name,
      aoi.quantity as order_quantity,
      aoi.unit_price,
      aoi.menu_item_id,
      aoi.menu_item_variant_id,
      mir.inventory_item_id,
      aoi.quantity * coalesce(mir.quantity_used, 0) as required_qty,
      'recipe'::text as source_type
    from active_order_items aoi
    join menu_item_recipes mir
      on mir.restaurant_id = v_order.restaurant_id
     and mir.menu_item_id = aoi.menu_item_id
     and coalesce(mir.menu_item_variant_id, 0) = coalesce(aoi.menu_item_variant_id, 0)

    union all

    select
      aoi.order_item_id,
      aoi.order_id,
      aoi.order_item_name,
      aoi.quantity as order_quantity,
      aoi.unit_price,
      aoi.menu_item_id,
      aoi.menu_item_variant_id,
      msl.inventory_item_id,
      aoi.quantity * coalesce(msl.quantity_per_sale, 0) as required_qty,
      'direct'::text as source_type
    from active_order_items aoi
    join menu_item_stock_links msl
      on msl.restaurant_id = v_order.restaurant_id
     and msl.menu_item_id = aoi.menu_item_id
     and coalesce(msl.menu_item_variant_id, 0) = coalesce(aoi.menu_item_variant_id, 0)
  )
  select
    ml.*,
    ii.item_name as inventory_item_name,
    ii.item_type,
    ii.unit,
    coalesce(ii.cost_per_unit, 0) as cost_per_unit
  from material_links ml
  join inventory_items ii
    on ii.id = ml.inventory_item_id
   and ii.restaurant_id = v_order.restaurant_id
  where coalesce(ml.required_qty, 0) > 0;

  perform 1
  from inventory_items ii
  join (
    select distinct inventory_item_id
    from deduct_inventory_materials
  ) dim
    on dim.inventory_item_id = ii.id
  where ii.restaurant_id = v_order.restaurant_id
  order by ii.id
  for update of ii;

  create temporary table deduct_inventory_totals on commit drop as
  select
    dim.inventory_item_id,
    dim.inventory_item_name,
    dim.item_type,
    dim.unit,
    dim.cost_per_unit,
    sum(dim.required_qty) as required_qty,
    coalesce(ii.current_stock, 0) as available_qty,
    coalesce(ii.current_stock, 0) >= sum(dim.required_qty) as deducted,
    coalesce(ii.current_stock, 0) < sum(dim.required_qty) as insufficient_stock
  from deduct_inventory_materials dim
  join inventory_items ii
    on ii.id = dim.inventory_item_id
   and ii.restaurant_id = v_order.restaurant_id
  group by
    dim.inventory_item_id,
    dim.inventory_item_name,
    dim.item_type,
    dim.unit,
    dim.cost_per_unit,
    ii.current_stock;

  select coalesce(sum(oi.quantity * oi.unit_price), 0)
    into v_total_revenue
    from order_items oi
   where oi.order_id = p_order_id
     and coalesce(oi.voided, false) = false;

  select coalesce(sum(required_qty * cost_per_unit), 0)
    into v_total_cost
    from deduct_inventory_materials;

  v_total_profit := v_total_revenue - v_total_cost;

  insert into order_cost_snapshots (
    order_id,
    restaurant_id,
    total_cost,
    total_revenue,
    total_profit
  )
  values (
    p_order_id,
    v_order.restaurant_id,
    v_total_cost,
    v_total_revenue,
    v_total_profit
  )
  returning id into v_snapshot_id;

  insert into order_cost_snapshot_items (
    order_id,
    restaurant_id,
    menu_item_id,
    menu_item_variant_id,
    item_name,
    quantity,
    unit_price,
    selling,
    cost,
    profit,
    materials
  )
  select
    aoi.order_id,
    v_order.restaurant_id,
    aoi.menu_item_id,
    aoi.menu_item_variant_id,
    aoi.order_item_name,
    aoi.quantity,
    aoi.unit_price,
    aoi.quantity * aoi.unit_price as selling,
    coalesce(materials.cost, 0) as cost,
    (aoi.quantity * aoi.unit_price) - coalesce(materials.cost, 0) as profit,
    coalesce(materials.rows, '[]'::jsonb) as materials
  from (
    select
      oi.id as order_item_id,
      oi.order_id,
      coalesce(nullif(oi.item_name, ''), mi.item_name) as order_item_name,
      oi.quantity,
      oi.unit_price,
      oi.menu_item_id,
      oi.menu_item_variant_id
    from order_items oi
    left join menu_items mi
      on mi.id = oi.menu_item_id
     and mi.restaurant_id = v_order.restaurant_id
    where oi.order_id = p_order_id
      and coalesce(oi.voided, false) = false
  ) aoi
  left join lateral (
    select
      sum(dim.required_qty * dim.cost_per_unit) as cost,
      jsonb_agg(
        jsonb_build_object(
          'inventory_item_id', dim.inventory_item_id,
          'item_name', dim.inventory_item_name,
          'unit', dim.unit,
          'type', dim.item_type,
          'source', dim.source_type,
          'quantity', dim.required_qty,
          'required_qty', dim.required_qty,
          'available_qty', dt.available_qty,
          'cost', dim.required_qty * dim.cost_per_unit,
          'deducted', dt.deducted,
          'insufficient_stock', dt.insufficient_stock
        )
        order by dim.inventory_item_name, dim.inventory_item_id
      ) as rows
    from deduct_inventory_materials dim
    join deduct_inventory_totals dt
      on dt.inventory_item_id = dim.inventory_item_id
    where dim.order_item_id = aoi.order_item_id
  ) materials on true;

  update inventory_items ii
     set current_stock = ii.current_stock - dt.required_qty,
         updated_at = now()
    from deduct_inventory_totals dt
   where ii.id = dt.inventory_item_id
     and ii.restaurant_id = v_order.restaurant_id
     and dt.deducted = true
     and dt.required_qty > 0;

  insert into inventory_transactions (
    restaurant_id,
    inventory_item_id,
    transaction_type,
    quantity,
    note,
    reference_order_id
  )
  select
    v_order.restaurant_id,
    dt.inventory_item_id,
    'sale_deduction',
    dt.required_qty,
    'Order inventory deduction',
    p_order_id
  from deduct_inventory_totals dt
  where dt.deducted = true
    and dt.required_qty > 0;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'inventory_item_id', dt.inventory_item_id,
        'item_name', dt.inventory_item_name,
        'required_qty', dt.required_qty,
        'available_qty', dt.available_qty
      )
      order by dt.inventory_item_name, dt.inventory_item_id
    ),
    '[]'::jsonb
  )
    into v_skipped_items
    from deduct_inventory_totals dt
   where dt.insufficient_stock = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'inventory_item_id', dt.inventory_item_id,
        'item_name', dt.inventory_item_name,
        'required_qty', dt.required_qty,
        'deducted_qty', dt.required_qty,
        'available_qty', dt.available_qty
      )
      order by dt.inventory_item_name, dt.inventory_item_id
    ),
    '[]'::jsonb
  )
    into v_deducted_items
    from deduct_inventory_totals dt
   where dt.deducted = true
     and dt.required_qty > 0;

  v_partial := jsonb_array_length(v_skipped_items) > 0;

  update orders
     set inventory_deducted = true
   where id = p_order_id
     and restaurant_id = v_order.restaurant_id;

  return jsonb_build_object(
    'success', true,
    'partial', v_partial,
    'message',
      case
        when v_partial then 'Inventory partially deducted; insufficient stock items skipped'
        else 'Inventory deducted and item-wise cost locked'
      end,
    'snapshot_id', v_snapshot_id,
    'total_cost', v_total_cost,
    'total_revenue', v_total_revenue,
    'total_profit', v_total_profit,
    'skipped_items', v_skipped_items,
    'deducted_items', v_deducted_items,
    'deduction', jsonb_build_object(
      'success', true,
      'partial', v_partial,
      'message',
        case
          when v_partial then 'Inventory partially deducted; insufficient stock items skipped'
          else 'Inventory deducted fast'
        end,
      'skipped_items', v_skipped_items,
      'deducted_items', v_deducted_items
    )
  );
end;
$$;

commit;
