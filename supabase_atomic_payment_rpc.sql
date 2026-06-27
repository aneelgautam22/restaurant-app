create or replace function public.mark_order_paid_fast(
  p_order_id bigint,
  p_payment_method text,
  p_subtotal numeric default null,
  p_discount_enabled boolean default null,
  p_discount_percent numeric default null,
  p_discount_amount numeric default null,
  p_tax_enabled boolean default null,
  p_tax_percent numeric default null,
  p_tax_amount numeric default null,
  p_grand_total numeric default null
)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_order orders%rowtype;
  v_paid_at timestamptz := now();
begin
  if p_order_id is null then
    raise exception 'invalid_order_id' using errcode = '22023';
  end if;

  if p_payment_method not in ('cash', 'qr', 'card') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  select *
    into v_order
    from orders
   where id = p_order_id
   for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'message', 'order not found'
    );
  end if;

  if v_order.is_paid is true then
    return jsonb_build_object(
      'success', false,
      'message', 'already paid',
      'payment_method', v_order.payment_method,
      'paid_at', v_order.paid_at,
      'subtotal', v_order.subtotal,
      'discount_enabled', v_order.discount_enabled,
      'discount_percent', v_order.discount_percent,
      'discount_amount', v_order.discount_amount,
      'tax_enabled', v_order.tax_enabled,
      'tax_percent', v_order.tax_percent,
      'tax_amount', v_order.tax_amount,
      'grand_total', v_order.grand_total,
      'inventory_deducted', v_order.inventory_deducted
    );
  end if;

  update orders
     set subtotal = coalesce(p_subtotal, v_order.subtotal),
         discount_enabled = coalesce(p_discount_enabled, v_order.discount_enabled),
         discount_percent = coalesce(p_discount_percent, v_order.discount_percent),
         discount_amount = coalesce(p_discount_amount, v_order.discount_amount),
         tax_enabled = coalesce(p_tax_enabled, v_order.tax_enabled),
         tax_percent = coalesce(p_tax_percent, v_order.tax_percent),
         tax_amount = coalesce(p_tax_amount, v_order.tax_amount),
         grand_total = coalesce(p_grand_total, v_order.grand_total),
         is_paid = true,
         payment_method = p_payment_method,
         paid_at = v_paid_at
   where id = p_order_id
     and is_paid is not true;

  return jsonb_build_object(
    'success', true,
    'message', 'paid',
    'payment_method', p_payment_method,
    'paid_at', v_paid_at,
    'subtotal', coalesce(p_subtotal, v_order.subtotal),
    'discount_enabled', coalesce(p_discount_enabled, v_order.discount_enabled),
    'discount_percent', coalesce(p_discount_percent, v_order.discount_percent),
    'discount_amount', coalesce(p_discount_amount, v_order.discount_amount),
    'tax_enabled', coalesce(p_tax_enabled, v_order.tax_enabled),
    'tax_percent', coalesce(p_tax_percent, v_order.tax_percent),
    'tax_amount', coalesce(p_tax_amount, v_order.tax_amount),
    'grand_total', coalesce(p_grand_total, v_order.grand_total),
    'inventory_deducted', coalesce(v_order.inventory_deducted, false)
  );
end;
$$;
