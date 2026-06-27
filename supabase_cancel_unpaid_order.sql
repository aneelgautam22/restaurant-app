begin;

alter table public.orders
  add column if not exists cancelled boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

create index if not exists orders_active_unpaid_idx
  on public.orders (restaurant_id, is_paid, cancelled)
  where is_paid is not true and cancelled is not true;

create or replace function public.cancel_unpaid_order(
  p_restaurant_id bigint,
  p_order_id bigint,
  p_reason text
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_reason text;
  v_cancelled_at timestamptz := now();
begin
  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if p_restaurant_id is null or p_order_id is null then
    raise exception 'invalid_cancel_request' using errcode = '22023';
  end if;

  if v_reason is null then
    raise exception 'cancel_reason_required' using errcode = '22023';
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
    raise exception 'paid_order_cannot_be_cancelled' using errcode = 'P0001';
  end if;

  if coalesce(v_order.cancelled, false) is true then
    return jsonb_build_object(
      'success', true,
      'message', 'already cancelled',
      'id', v_order.id,
      'cancelled', true,
      'cancelled_at', v_order.cancelled_at,
      'cancel_reason', v_order.cancel_reason
    );
  end if;

  update orders
     set cancelled = true,
         cancelled_at = v_cancelled_at,
         cancel_reason = v_reason,
         status = 'cancelled'
   where id = p_order_id
     and restaurant_id = p_restaurant_id;

  return jsonb_build_object(
    'success', true,
    'message', 'cancelled',
    'id', p_order_id,
    'cancelled', true,
    'cancelled_at', v_cancelled_at,
    'cancel_reason', v_reason
  );
end;
$$;

commit;
