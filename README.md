# Yapa Café

A premium, mobile-first QR café ordering MVP built with the Next.js App Router surface, TypeScript, React, Tailwind CSS, Framer Motion, and Supabase Realtime.

## What is included

- Arabic-first, RTL customer menus for Tables 1, 2, and 3
- Six supplied Yapa product photos, copied from `data/` into `public/products/`
- Animated category browsing, product details, ingredient reveal, cart, and order status
- Server-validated table QR tokens and 15-minute ordering sessions
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

Without Supabase credentials, the menu and staff UI still render and existing
browser-local demo orders remain available. Secure QR token validation and new
ordering sessions require Supabase; localStorage is not allowed to mint or
renew customer sessions.

## Supabase setup

1. Create a Supabase project.
2. Open its SQL Editor.
3. Run [`supabase/schema.sql`](supabase/schema.sql). It creates the four data tables, token/session RPCs, the atomic order function, demo RLS policies, and Realtime publication entries.
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

The command creates a cryptographically random table token when one is not
already present in the ignored `.env.local`, regenerates the three PNG files
under `public/qrs`, and writes hash-only database seed SQL to
`supabase/table-qr-token-seed.sql`. The raw tokens are embedded only in the QR
images and the ignored local environment file; `/qr` displays a masked preview.

After generating or rotating the QR tokens, run `supabase/schema.sql` and then
`supabase/table-qr-token-seed.sql` in the Supabase SQL Editor before deploying
the matching QR images. A clean `/menu/1`, `/menu/2`, or `/menu/3` URL can
restore an existing valid 15-minute session, but it cannot create a new one.

## Database model

- `cafe_tables`: table number, active flag, and SHA-256 QR token hash
- `sessions`: table session ID, creation time, and 15-minute expiry
- `orders`: table number, total, status, session, and timestamp
- `order_items`: immutable product name, unit price, and quantity snapshots

The six products stay in the existing application data. Supabase stores an immutable snapshot of each ordered item.

Order statuses follow:

`NEW → PREPARING → READY → SERVED → PAID`

Staff can also mark a request as `REJECTED`.

## Production note

The included Supabase policies are intentionally open for a no-login café demo. Before a production rollout, add staff authentication and restrict staff order reads and status updates to authenticated staff roles.

## Build

```bash
npm run build
```
