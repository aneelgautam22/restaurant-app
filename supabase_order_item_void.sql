alter table public.order_items
  add column if not exists voided boolean not null default false,
  add column if not exists voided_at timestamptz,
  add column if not exists void_reason text;

create index if not exists order_items_active_by_order_idx
  on public.order_items (order_id, voided)
  where voided is false;

create or replace function public.void_order_item_before_payment(
  p_restaurant_id bigint,
  p_order_id bigint,
  p_order_item_id bigint,
  p_reason text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_item order_items%rowtype;
  v_reason text;
  v_voided_at timestamptz := now();
begin
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if p_restaurant_id is null or p_order_id is null or p_order_item_id is null then
    raise exception 'invalid_void_request' using errcode = '22023';
  end if;

  if v_reason is null then
    raise exception 'void_reason_required' using errcode = '22023';
  end if;

  select *
    into v_order
    from orders
   where id = p_order_id
     and restaurant_id = p_restaurant_id
   for update;

  if not found then
    raise exception 'order_not_found' using errcode = 'P0002';
  end if;

  if v_order.is_paid is true then
    raise exception 'paid_order_cannot_be_modified' using errcode = 'P0001';
  end if;

  select *
    into v_item
    from order_items
   where id = p_order_item_id
     and order_id = p_order_id
   for update;

  if not found then
    raise exception 'order_item_not_found' using errcode = 'P0002';
  end if;

  if coalesce(v_item.voided, false) is true then
    return jsonb_build_object(
      'success', true,
      'message', 'already voided',
      'id', v_item.id,
      'voided', true,
      'voided_at', v_item.voided_at,
      'void_reason', v_item.void_reason
    );
  end if;

  update order_items
     set voided = true,
         voided_at = v_voided_at,
         void_reason = v_reason
   where id = p_order_item_id
     and order_id = p_order_id;

  return jsonb_build_object(
    'success', true,
    'message', 'voided',
    'id', p_order_item_id,
    'voided', true,
    'voided_at', v_voided_at,
    'void_reason', v_reason
  );
end;
$$;
