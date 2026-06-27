create or replace function public.restock_inventory_item_atomic(
  p_restaurant_id bigint,
  p_inventory_item_id bigint,
  p_quantity numeric,
  p_cost_per_unit numeric default null,
  p_transaction_note text default null,
  p_supplier_id bigint default null,
  p_purchase_note text default null,
  p_paid_amount numeric default 0
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_item inventory_items%rowtype;
  v_next_stock numeric;
  v_next_cost numeric;
  v_effective_unit_cost numeric;
  v_total_amount numeric;
  v_paid_amount numeric;
  v_due_amount numeric;
begin
  if p_restaurant_id is null or p_inventory_item_id is null then
    raise exception 'invalid_restock_request' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_restock_quantity' using errcode = '22023';
  end if;

  if p_cost_per_unit is not null and p_cost_per_unit < 0 then
    raise exception 'invalid_restock_cost' using errcode = '22023';
  end if;

  v_paid_amount := coalesce(p_paid_amount, 0);

  if v_paid_amount < 0 then
    raise exception 'invalid_paid_amount' using errcode = '22023';
  end if;

  select *
    into v_item
    from inventory_items
   where id = p_inventory_item_id
     and restaurant_id = p_restaurant_id
   for update;

  if not found then
    raise exception 'inventory_item_not_found' using errcode = 'P0002';
  end if;

  if p_supplier_id is not null then
    perform 1
      from suppliers
     where id = p_supplier_id
       and restaurant_id = p_restaurant_id;

    if not found then
      raise exception 'supplier_not_found' using errcode = 'P0002';
    end if;
  end if;

  v_next_stock := coalesce(v_item.current_stock, 0) + p_quantity;
  v_next_cost := coalesce(p_cost_per_unit, v_item.cost_per_unit);
  v_effective_unit_cost := coalesce(v_next_cost, 0);
  v_total_amount := p_quantity * v_effective_unit_cost;

  if v_paid_amount > v_total_amount then
    raise exception 'paid_amount_exceeds_total' using errcode = '22023';
  end if;

  v_due_amount := v_total_amount - v_paid_amount;

  update inventory_items
     set current_stock = v_next_stock,
         cost_per_unit = v_next_cost,
         updated_at = now()
   where id = v_item.id
     and restaurant_id = p_restaurant_id;

  insert into inventory_transactions (
    restaurant_id,
    inventory_item_id,
    transaction_type,
    quantity,
    note
  ) values (
    p_restaurant_id,
    p_inventory_item_id,
    'purchase',
    p_quantity,
    coalesce(nullif(trim(p_transaction_note), ''), 'Stock added for ' || coalesce(v_item.item_name, 'inventory item'))
  );

  if p_supplier_id is not null then
    insert into supplier_purchases (
      restaurant_id,
      supplier_id,
      inventory_item_id,
      quantity,
      unit_cost,
      total_amount,
      paid_amount,
      due_amount,
      note
    ) values (
      p_restaurant_id,
      p_supplier_id,
      p_inventory_item_id,
      p_quantity,
      v_effective_unit_cost,
      v_total_amount,
      v_paid_amount,
      v_due_amount,
      nullif(trim(coalesce(p_purchase_note, '')), '')
    );
  end if;

  return jsonb_build_object(
    'id', v_item.id,
    'restaurant_id', p_restaurant_id,
    'current_stock', v_next_stock,
    'cost_per_unit', v_next_cost
  );
end;
$$;

create or replace function public.adjust_inventory_stock_atomic(
  p_restaurant_id bigint,
  p_inventory_item_id bigint,
  p_quantity numeric,
  p_mode text,
  p_note text default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_item inventory_items%rowtype;
  v_signed_quantity numeric;
  v_next_stock numeric;
  v_transaction_type text;
begin
  if p_restaurant_id is null or p_inventory_item_id is null then
    raise exception 'invalid_adjustment_request' using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'invalid_adjustment_quantity' using errcode = '22023';
  end if;

  if p_mode not in ('add', 'minus') then
    raise exception 'invalid_adjustment_mode' using errcode = '22023';
  end if;

  select *
    into v_item
    from inventory_items
   where id = p_inventory_item_id
     and restaurant_id = p_restaurant_id
   for update;

  if not found then
    raise exception 'inventory_item_not_found' using errcode = 'P0002';
  end if;

  v_signed_quantity := case when p_mode = 'minus' then -p_quantity else p_quantity end;
  v_next_stock := coalesce(v_item.current_stock, 0) + v_signed_quantity;

  if v_next_stock < 0 then
    raise exception 'negative_stock_not_allowed' using errcode = '22023';
  end if;

  v_transaction_type := case when p_mode = 'minus' then 'adjustment_minus' else 'adjustment_add' end;

  update inventory_items
     set current_stock = v_next_stock,
         updated_at = now()
   where id = v_item.id
     and restaurant_id = p_restaurant_id;

  insert into inventory_transactions (
    restaurant_id,
    inventory_item_id,
    transaction_type,
    quantity,
    note
  ) values (
    p_restaurant_id,
    p_inventory_item_id,
    v_transaction_type,
    p_quantity,
    coalesce(
      nullif(trim(p_note), ''),
      'Manual ' || case when p_mode = 'minus' then 'minus' else 'plus' end || ' adjustment for ' || coalesce(v_item.item_name, 'inventory item')
    )
  );

  return jsonb_build_object(
    'id', v_item.id,
    'restaurant_id', p_restaurant_id,
    'current_stock', v_next_stock
  );
end;
$$;

