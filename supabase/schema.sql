-- Yapa Café MVP schema
-- Run this complete file in the Supabase SQL Editor.
-- The six menu products remain in lib/data/products.ts; only order snapshots
-- are persisted in order_items for this MVP.

create table if not exists public.sessions (
  id uuid primary key,
  table_number text not null
    check (table_number in ('1', '2', '3')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true,
  check (expires_at > created_at)
);

create table if not exists public.orders (
  id uuid primary key,
  display_id bigint not null,
  table_number text not null
    check (table_number in ('1', '2', '3')),
  status text not null default 'NEW'
    check (status in ('NEW', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED')),
  total numeric(10, 2) not null check (total >= 0),
  session_id uuid not null references public.sessions(id),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null,
  product_name text not null,
  price numeric(10, 2) not null check (price >= 0),
  quantity integer not null check (quantity > 0)
);

create index if not exists orders_created_at_idx
  on public.orders(created_at desc);
create index if not exists orders_status_idx
  on public.orders(status);
create index if not exists orders_session_id_idx
  on public.orders(session_id);
create index if not exists order_items_order_id_idx
  on public.order_items(order_id);
create index if not exists sessions_expires_at_idx
  on public.sessions(expires_at);

-- Enforce an exact one-hour lifetime for every new ordering session. NOT VALID
-- keeps this migration rerunnable even if an older demo row used a different
-- duration, while still enforcing the rule for every new row.
alter table public.sessions
  drop constraint if exists sessions_exact_one_hour;
alter table public.sessions
  add constraint sessions_exact_one_hour
  check (expires_at = created_at + interval '1 hour') not valid;

-- Creates the order and every order item in one transaction. It also verifies
-- the real Supabase session immediately before accepting the order.
create or replace function public.create_order(
  p_id uuid,
  p_display_id bigint,
  p_table_number text,
  p_session_id uuid,
  p_total numeric,
  p_items jsonb
)
returns table (
  id uuid,
  display_id bigint,
  table_number text,
  status text,
  total numeric,
  session_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  session_row public.sessions%rowtype;
  item jsonb;
  calculated_total numeric(10, 2) := 0;
begin
  if p_table_number not in ('1', '2', '3') then
    raise exception 'invalid_table';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'empty_order';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order';
  end if;

  select *
    into session_row
    from public.sessions
    where sessions.id = p_session_id
    for update;

  if not found or session_row.table_number <> p_table_number then
    raise exception 'invalid_session';
  end if;

  if not session_row.active or session_row.expires_at <= now() then
    raise exception 'session_expired';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce(item->>'product_id', '') = ''
      or coalesce(item->>'product_name', '') = ''
      or (item->>'price')::numeric < 0
      or (item->>'quantity')::integer <= 0 then
      raise exception 'invalid_order_item';
    end if;

    calculated_total := calculated_total
      + ((item->>'price')::numeric * (item->>'quantity')::integer);
  end loop;

  if round(calculated_total, 2) <> round(p_total, 2) then
    raise exception 'invalid_total';
  end if;

  insert into public.orders (
    id,
    display_id,
    table_number,
    status,
    total,
    session_id
  )
  values (
    p_id,
    p_display_id,
    p_table_number,
    'NEW',
    p_total,
    p_session_id
  );

  for item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id,
      product_id,
      product_name,
      price,
      quantity
    )
    values (
      p_id,
      item->>'product_id',
      item->>'product_name',
      (item->>'price')::numeric,
      (item->>'quantity')::integer
    );
  end loop;

  return query
    select
      orders.id,
      orders.display_id,
      orders.table_number,
      orders.status,
      orders.total,
      orders.session_id,
      orders.created_at
    from public.orders
    where orders.id = p_id;
end;
$$;

-- DEMO ONLY: remove or protect this function before a production rollout.
-- It intentionally leaves active orders and customer sessions intact and
-- never touches the six menu products stored in the application.
create or replace function public.reset_demo()
returns table (
  deleted_order_items bigint,
  deleted_orders bigint,
  deleted_sessions bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item_count bigint := 0;
  order_count bigint := 0;
  session_count bigint := 0;
begin
  delete from public.order_items
    where order_id in (
      select id
      from public.orders
      where status in ('COMPLETED', 'REJECTED')
    );
  get diagnostics item_count = row_count;

  delete from public.orders
    where status in ('COMPLETED', 'REJECTED');
  get diagnostics order_count = row_count;

  delete from public.sessions as session
    where (not session.active or session.expires_at <= now())
      and not exists (
        select 1
        from public.orders as active_order
        where active_order.session_id = session.id
      );
  get diagnostics session_count = row_count;

  return query
    select item_count, order_count, session_count;
end;
$$;

alter table public.sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "demo sessions can be read" on public.sessions;
create policy "demo sessions can be read"
  on public.sessions for select
  using (true);

drop policy if exists "demo sessions can be created" on public.sessions;
create policy "demo sessions can be created"
  on public.sessions for insert
  with check (
    table_number in ('1', '2', '3')
    and active = true
    and expires_at = created_at + interval '1 hour'
  );

drop policy if exists "demo sessions can be refreshed" on public.sessions;
create policy "demo sessions can be refreshed"
  on public.sessions for update
  using (true)
  with check (
    table_number in ('1', '2', '3')
    and expires_at = created_at + interval '1 hour'
  );

drop policy if exists "demo orders can be read" on public.orders;
create policy "demo orders can be read"
  on public.orders for select
  using (true);

drop policy if exists "staff can update demo orders" on public.orders;
create policy "staff can update demo orders"
  on public.orders for update
  using (true)
  with check (
    table_number in ('1', '2', '3')
    and status in ('NEW', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED')
  );

drop policy if exists "demo order items can be read" on public.order_items;
create policy "demo order items can be read"
  on public.order_items for select
  using (true);

-- Remove permissive legacy insert policies when this file is rerun. New
-- orders are created only through the validated create_order function.
drop policy if exists "demo orders can be created" on public.orders;
drop policy if exists "demo order items can be created" on public.order_items;

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.sessions to anon, authenticated;
grant select, update on public.orders to anon, authenticated;
grant select on public.order_items to anon, authenticated;
grant execute on function public.create_order(
  uuid,
  bigint,
  text,
  uuid,
  numeric,
  jsonb
) to anon, authenticated;
revoke all on function public.reset_demo() from public;
grant execute on function public.reset_demo() to anon, authenticated;

revoke insert on public.orders from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;

-- Supabase Realtime broadcasts committed order and item changes.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;
