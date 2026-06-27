begin;

drop function if exists public.deduct_inventory_and_lock_cost(bigint);
drop function if exists public.deduct_inventory_and_lock_cost(integer);

create or replace function public.deduct_inventory_and_lock_cost(p_order_id bigint)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_inventory_enabled boolean := false;
  v_snapshot_id bigint;
  v_total_revenue numeric := 0;
  v_total_cost numeric := 0;
begin
  if p_order_id is null then
    raise exception 'invalid_order_id' using errcode = '22023';
  end if;

  select *
    into v_order
    from orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  select coalesce(inventory_enabled, false)
    into v_inventory_enabled
    from restaurants
   where id = v_order.restaurant_id;

  if coalesce(v_inventory_enabled, false) is false then
    update orders
       set inventory_deducted = true
     where id = p_order_id
       and restaurant_id = v_order.restaurant_id;

    return jsonb_build_object(
      'success', true,
      'message', 'Inventory disabled; deduction skipped',
      'skipped', true,
      'snapshot_id', null,
      'total_cost', 0,
      'total_revenue', 0,
      'total_profit', 0,
      'deduction', jsonb_build_object('success', true, 'message', 'Inventory disabled; deduction skipped')
    );
  end if;

  if coalesce(v_order.inventory_deducted, false) is true then
    select id, total_revenue, total_cost
      into v_snapshot_id, v_total_revenue, v_total_cost
      from order_cost_snapshots
     where order_id = p_order_id
       and restaurant_id = v_order.restaurant_id
     order by created_at desc, id desc
     limit 1;

    return jsonb_build_object(
      'success', true,
      'message', 'Inventory already deducted',
      'snapshot_id', v_snapshot_id,
      'total_cost', coalesce(v_total_cost, 0),
      'total_revenue', coalesce(v_total_revenue, 0),
      'total_profit', coalesce(v_total_revenue, 0) - coalesce(v_total_cost, 0),
      'deduction', jsonb_build_object('success', true, 'message', 'Inventory already deducted')
    );
  end if;

  with active_order_items as (
    select
      oi.id,
      oi.order_id,
      oi.item_name,
      oi.quantity,
      oi.unit_price,
      oi.menu_item_id,
      oi.menu_item_variant_id
    from order_items oi
    where oi.order_id = p_order_id
      and coalesce(oi.voided, false) = false
  )
  select coalesce(sum(quantity * unit_price), 0)
    into v_total_revenue
    from active_order_items;

  with active_order_items as (
    select
      oi.id,
      oi.quantity,
      oi.menu_item_id,
      oi.menu_item_variant_id
    from order_items oi
    where oi.order_id = p_order_id
      and coalesce(oi.voided, false) = false
  ),
  material_costs as (
    select
      material_links.order_item_id,
      sum(material_links.material_quantity * coalesce(ii.cost_per_unit, 0)) as cost
    from (
      select
        aoi.id as order_item_id,
        mir.inventory_item_id,
        aoi.quantity * coalesce(mir.quantity_used, 0) as material_quantity
      from active_order_items aoi
      join menu_item_recipes mir
        on mir.restaurant_id = v_order.restaurant_id
       and mir.menu_item_id = aoi.menu_item_id
       and coalesce(mir.menu_item_variant_id, 0) = coalesce(aoi.menu_item_variant_id, 0)

      union all

      select
        aoi.id as order_item_id,
        msl.inventory_item_id,
        aoi.quantity * coalesce(msl.quantity_per_sale, 0) as material_quantity
      from active_order_items aoi
      join menu_item_stock_links msl
        on msl.restaurant_id = v_order.restaurant_id
       and msl.menu_item_id = aoi.menu_item_id
       and coalesce(msl.menu_item_variant_id, 0) = coalesce(aoi.menu_item_variant_id, 0)
    ) material_links
    join inventory_items ii
      on ii.id = material_links.inventory_item_id
     and ii.restaurant_id = v_order.restaurant_id
    group by material_links.order_item_id
  )
  select coalesce(sum(cost), 0)
    into v_total_cost
    from material_costs;

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
    v_total_revenue - v_total_cost
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
    aoi.item_name,
    aoi.quantity,
    aoi.unit_price,
    aoi.quantity * aoi.unit_price as selling,
    coalesce(materials.cost, 0) as cost,
    (aoi.quantity * aoi.unit_price) - coalesce(materials.cost, 0) as profit,
    coalesce(materials.rows, '[]'::jsonb) as materials
  from (
    select
      oi.id,
      oi.order_id,
      coalesce(nullif(oi.item_name, ''), mi.item_name) as item_name,
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
      sum(material_links.material_quantity * coalesce(ii.cost_per_unit, 0)) as cost,
      jsonb_agg(
        jsonb_build_object(
          'inventory_item_id', ii.id,
          'item_name', ii.item_name,
          'unit', ii.unit,
          'quantity', material_links.material_quantity,
          'cost', material_links.material_quantity * coalesce(ii.cost_per_unit, 0),
          'type', ii.item_type,
          'source', material_links.source_type
        )
        order by ii.item_name, ii.id
      ) as rows
    from (
      select
        mir.inventory_item_id,
        aoi.quantity * coalesce(mir.quantity_used, 0) as material_quantity,
        'recipe'::text as source_type
      from menu_item_recipes mir
      where mir.restaurant_id = v_order.restaurant_id
        and mir.menu_item_id = aoi.menu_item_id
        and coalesce(mir.menu_item_variant_id, 0) = coalesce(aoi.menu_item_variant_id, 0)

      union all

      select
        msl.inventory_item_id,
        aoi.quantity * coalesce(msl.quantity_per_sale, 0) as material_quantity,
        'direct'::text as source_type
      from menu_item_stock_links msl
      where msl.restaurant_id = v_order.restaurant_id
        and msl.menu_item_id = aoi.menu_item_id
        and coalesce(msl.menu_item_variant_id, 0) = coalesce(aoi.menu_item_variant_id, 0)
    ) material_links
    join inventory_items ii
      on ii.id = material_links.inventory_item_id
     and ii.restaurant_id = v_order.restaurant_id
  ) materials on true;

  with deduction_totals as (
    select
      material_links.inventory_item_id,
      sum(material_links.material_quantity) as total_quantity
    from (
      select
        mir.inventory_item_id,
        oi.quantity * coalesce(mir.quantity_used, 0) as material_quantity
      from order_items oi
      join menu_item_recipes mir
        on mir.restaurant_id = v_order.restaurant_id
       and mir.menu_item_id = oi.menu_item_id
       and coalesce(mir.menu_item_variant_id, 0) = coalesce(oi.menu_item_variant_id, 0)
      where oi.order_id = p_order_id
        and coalesce(oi.voided, false) = false

      union all

      select
        msl.inventory_item_id,
        oi.quantity * coalesce(msl.quantity_per_sale, 0) as material_quantity
      from order_items oi
      join menu_item_stock_links msl
        on msl.restaurant_id = v_order.restaurant_id
       and msl.menu_item_id = oi.menu_item_id
       and coalesce(msl.menu_item_variant_id, 0) = coalesce(oi.menu_item_variant_id, 0)
      where oi.order_id = p_order_id
        and coalesce(oi.voided, false) = false
    ) material_links
    group by material_links.inventory_item_id
    having sum(material_links.material_quantity) <> 0
  ),
  updated_inventory as (
    update inventory_items ii
       set current_stock = ii.current_stock - dt.total_quantity,
           updated_at = now()
      from deduction_totals dt
     where ii.id = dt.inventory_item_id
       and ii.restaurant_id = v_order.restaurant_id
    returning ii.id, dt.total_quantity
  )
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
    ui.id,
    'sale_deduction',
    ui.total_quantity,
    'Order inventory deduction',
    p_order_id
  from updated_inventory ui;

  update orders
     set inventory_deducted = true
   where id = p_order_id
     and restaurant_id = v_order.restaurant_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Inventory deducted and item-wise cost locked',
    'snapshot_id', v_snapshot_id,
    'total_cost', v_total_cost,
    'total_revenue', v_total_revenue,
    'total_profit', v_total_revenue - v_total_cost,
    'deduction', jsonb_build_object('success', true, 'message', 'Inventory deducted fast')
  );
end;
$$;

commit;
