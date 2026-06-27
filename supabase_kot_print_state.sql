alter table public.order_items
  add column if not exists kot_printed boolean not null default false,
  add column if not exists kot_printed_at timestamptz;

create index if not exists order_items_kot_unprinted_idx
  on public.order_items (order_id, status, kot_printed)
  where kot_printed is false;
