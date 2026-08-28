# Yapa Café

A premium, mobile-first QR café ordering MVP built with the Next.js App Router surface, TypeScript, React, Tailwind CSS, Framer Motion, and Supabase Realtime.

## What is included

- Arabic-first, RTL customer menu at `/menu/[table]`
- Six supplied Yapa product photos, copied from `data/` into `public/products/`
- Animated category browsing, product details, ingredient reveal, cart, and order status
- One-hour table ordering session with expiry protection
- Duplicate-submission guard and confirmed order creation
- Responsive realtime staff dashboard at `/staff`
- Supabase PostgreSQL schema and Realtime subscriptions
- Automatic local demo mode when Supabase variables are not configured

## Install and run

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open:

- Customer: [http://localhost:3000/menu/12](http://localhost:3000/menu/12)
- Staff: [http://localhost:3000/staff](http://localhost:3000/staff)

Change `12` in the customer URL to the table number encoded by a QR code. For example, table 7 should point to `/menu/7`.

## Local demo mode

The app works immediately without credentials. Orders are kept in browser storage and synchronized between customer and staff tabs with `BroadcastChannel` and storage events.

For the complete demo, keep `/menu/12` and `/staff` open in two tabs in the same browser. Create an order in the customer tab and update it in the staff tab; the customer status changes without a refresh.

Local demo data is browser-specific. Use Supabase for shared, persistent orders across devices.

## Supabase setup

1. Create a Supabase project.
2. Open its SQL Editor.
3. Run [`supabase/schema.sql`](supabase/schema.sql). It creates the four tables, seeds the six products, enables demo RLS policies, and adds Realtime publication entries.
4. Copy `.env.example` to `.env.local`.
5. Add the project URL and anon key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

6. Restart the development server.

Do not commit `.env.local`, and do not put a Supabase service-role key in any `NEXT_PUBLIC_` variable.

## Database model

- `products`: menu data and structured ingredient arrays
- `sessions`: table session ID, creation time, and one-hour expiry
- `orders`: table number, total, status, session, and timestamp
- `order_items`: immutable product name, unit price, and quantity snapshots

Order statuses follow:

`NEW → PREPARING → READY → COMPLETED`

Staff can also mark a request as `REJECTED`.

## Production note

The included Supabase policies are intentionally open for a no-login café demo. Before a production rollout, add staff authentication and restrict staff order reads and status updates to authenticated staff roles.

## Build

```bash
npm run build
```
