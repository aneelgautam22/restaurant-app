create or replace function public.claim_kot_items_for_print(
  p_restaurant_id bigint,
  p_order_item_ids bigint[]
)
returns table (
  id bigint,
  order_id bigint,
  item_name text,
  quantity integer,
  unit_price numeric,
  status text,
  menu_item_id bigint,
  menu_item_variant_id bigint,
  kot_printed boolean,
  kot_printed_at timestamptz
)
language sql
as $$
  update order_items oi
     set kot_printed = true,
         kot_printed_at = now()
    from orders o
   where oi.order_id = o.id
     and o.restaurant_id = p_restaurant_id
     and oi.id = any(p_order_item_ids)
     and coalesce(oi.kot_printed, false) = false
     and coalesce(oi.voided, false) = false
     and lower(coalesce(oi.status, 'pending')) <> 'ready'
  returning
    oi.id,
    oi.order_id,
    oi.item_name,
    oi.quantity,
    oi.unit_price,
    oi.status,
    oi.menu_item_id,
    oi.menu_item_variant_id,
    oi.kot_printed,
    oi.kot_printed_at;
$$;
