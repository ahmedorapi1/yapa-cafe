# Yapa Café

A premium, mobile-first QR café ordering MVP built with the Next.js App Router surface, TypeScript, React, Tailwind CSS, Framer Motion, and Supabase Realtime.

## What is included

- Arabic-first, RTL customer menus for Tables 1, 2, and 3
- Six supplied Yapa product photos, copied from `data/` into `public/products/`
- Animated category browsing, product details, ingredient reveal, cart, and order status
- One-hour table ordering session with expiry protection
- Duplicate-submission guard and atomic order creation
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

- Table 1: [http://localhost:3000/menu/1](http://localhost:3000/menu/1)
- Table 2: [http://localhost:3000/menu/2](http://localhost:3000/menu/2)
- Table 3: [http://localhost:3000/menu/3](http://localhost:3000/menu/3)
- Staff: [http://localhost:3000/staff](http://localhost:3000/staff)
- QR codes: [http://localhost:3000/qr](http://localhost:3000/qr)

Any customer table route other than `/menu/1`, `/menu/2`, or `/menu/3` is rejected.

## Local demo mode

The app works immediately without credentials. Orders are kept in browser storage and synchronized between customer and staff tabs with `BroadcastChannel` and storage events.

For a same-browser demo, keep `/menu/2` and `/staff` open in two tabs. Create an order in the customer tab and update it in the staff tab; the customer status changes without a refresh.

Local demo data is browser-specific. Use Supabase for shared, persistent orders across devices.

## Supabase setup

1. Create a Supabase project.
2. Open its SQL Editor.
3. Run [`supabase/schema.sql`](supabase/schema.sql). It creates the three data tables, the atomic order function, demo RLS policies, and Realtime publication entries.
4. Copy `.env.example` to `.env.local`.
5. Add the project URL and anon key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://yapa-cafe-f3fb.vercel.app
```

6. Restart the development server.

Do not commit `.env.local`, and do not put a Supabase service-role key in any `NEXT_PUBLIC_` variable.

## QR codes

Set `NEXT_PUBLIC_APP_URL` to the production domain, then run:

```bash
npm run qr:generate
```

The command creates PNG files for Tables 1, 2, and 3 under `public/qrs`. View and download them at `/qr`. The generator rejects localhost because another device cannot open a localhost QR URL.

## Database model

- `sessions`: table session ID, creation time, and one-hour expiry
- `orders`: table number, total, status, session, and timestamp
- `order_items`: immutable product name, unit price, and quantity snapshots

The six products stay in the existing application data. Supabase stores an immutable snapshot of each ordered item.

Order statuses follow:

`NEW → PREPARING → READY → COMPLETED`

Staff can also mark a request as `REJECTED`.

## Production note

The included Supabase policies are intentionally open for a no-login café demo. Before a production rollout, add staff authentication and restrict staff order reads and status updates to authenticated staff roles.

## Build

```bash
npm run build
```
