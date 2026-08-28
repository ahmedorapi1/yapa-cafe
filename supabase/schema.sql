-- Yapa Café MVP schema
-- Run this file in the Supabase SQL Editor, then add the two public env values.

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null check (category in ('hot', 'fresh', 'cold')),
  description text not null,
  price numeric(10, 2) not null check (price >= 0),
  image_path text not null,
  ingredients jsonb not null default '[]'::jsonb,
  active boolean not null default true
);

create table if not exists public.sessions (
  id uuid primary key,
  table_number text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true
);

create table if not exists public.orders (
  id uuid primary key,
  display_id bigint not null,
  table_number text not null,
  status text not null default 'NEW'
    check (status in ('NEW', 'PREPARING', 'READY', 'COMPLETED', 'REJECTED')),
  total numeric(10, 2) not null check (total >= 0),
  session_id uuid not null references public.sessions(id),
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  product_name text not null,
  price numeric(10, 2) not null check (price >= 0),
  quantity integer not null check (quantity > 0)
);

create index if not exists orders_created_at_idx on public.orders(created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists sessions_expires_at_idx on public.sessions(expires_at);

insert into public.products (id, name, category, description, price, image_path, ingredients)
values
  ('classic-tea', 'Classic Tea', 'hot', 'شاي كلاسيك ساخن بطعم غني وبسيط.', 45, '/products/1.png', '["Black Tea", "Hot Water"]'),
  ('turkish-coffee', 'Turkish Coffee', 'hot', 'قهوة تركي بطعم قوي ورائحة غنية.', 60, '/products/2.png', '["Turkish Coffee", "Water"]'),
  ('fresh-orange', 'Fresh Orange', 'fresh', 'عصير برتقال فريش منعش.', 80, '/products/3.png', '["Fresh Orange Juice", "Ice"]'),
  ('lemon-mint', 'Lemon Mint', 'fresh', 'ليمون بالنعناع بطعم فريش ومنعش.', 75, '/products/4.png', '["Fresh Lemon", "Mint", "Ice"]'),
  ('iced-spanish-latte', 'Iced Spanish Latte', 'cold', 'سبانيش لاتيه بارد، كريمي ومتوازن.', 110, '/products/5.png', '["Espresso", "Milk", "Sweetened Milk", "Ice"]'),
  ('mangolita', 'Mangolita', 'cold', 'مكس مانجا وفراولة مع صودا ونعناع ولمسة برتقال.', 100, '/products/6.png', '["Mango Juice", "Strawberry Juice", "Soda", "Ice", "Mint", "Orange Slice"]')
on conflict (id) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  price = excluded.price,
  image_path = excluded.image_path,
  ingredients = excluded.ingredients;

alter table public.products enable row level security;
alter table public.sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "menu products are public" on public.products;
create policy "menu products are public" on public.products for select using (active = true);

drop policy if exists "demo sessions can be created" on public.sessions;
create policy "demo sessions can be created" on public.sessions for insert with check (expires_at > created_at);
drop policy if exists "demo sessions can be refreshed" on public.sessions;
create policy "demo sessions can be refreshed" on public.sessions for update using (true) with check (expires_at > created_at);

drop policy if exists "demo orders can be read" on public.orders;
create policy "demo orders can be read" on public.orders for select using (true);
drop policy if exists "demo orders can be created" on public.orders;
create policy "demo orders can be created" on public.orders for insert with check (status = 'NEW');
drop policy if exists "staff can update demo orders" on public.orders;
create policy "staff can update demo orders" on public.orders for update using (true) with check (true);

drop policy if exists "demo order items can be read" on public.order_items;
create policy "demo order items can be read" on public.order_items for select using (true);
drop policy if exists "demo order items can be created" on public.order_items;
create policy "demo order items can be created" on public.order_items for insert with check (true);

grant usage on schema public to anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update on public.sessions to anon, authenticated;
grant select, insert, update on public.orders to anon, authenticated;
grant select, insert on public.order_items to anon, authenticated;
grant usage, select on sequence public.order_items_id_seq to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'order_items'
  ) then
    alter publication supabase_realtime add table public.order_items;
  end if;
end $$;
