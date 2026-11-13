# VermiSense Dashboard 🌱

Web dashboard for the VermiSense IoT vermiculture project. ESP32 sensor nodes write readings
(temperature, humidity, moisture, water valve and aeration fan state) to Supabase, and the
dashboard shows them live.

## Features

- **Farm administrator login** – the dashboard is only available after signing in.
  Visitors who are not logged in are always sent to `/login`.
- **Readings** – the latest 5 readings, updated in real time as the ESP32s report.
- **Beds** – one card per bed with its most recent reading. The administrator can
  **add extra beds to monitor** (Bed ID, optional name and location) and remove them again.
- **History** – every past reading in a table, filterable by bed and time period
  (24 hours / 7 days / 30 days / all time), with paging.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` with your Supabase project settings:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

3. (Recommended) Create the beds table so beds added on the dashboard are stored in
   Supabase and shared across devices: open the Supabase SQL editor and run
   [`supabase/vermiculture_beds.sql`](supabase/vermiculture_beds.sql).
   Until the table exists, added beds are saved in the administrator's browser only.

4. Start the development server and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

## Administrator login

The farm administrator signs in with the username and password agreed with the project lead.
The password itself is **not** stored in this repository: only a public key derived from it is
kept in `lib/auth.ts`, so the public code cannot be used to recover it or to forge a login.

To change the login, set these in `.env.local` (or in your hosting provider's settings) and
restart the server:

```bash
ADMIN_USERNAME=farmadmin
ADMIN_PASSWORD=<new password>
```

A login lasts 12 hours, after which the administrator must sign in again.
Use **Log out** (top right) on shared computers.

## Project structure

| Path | Purpose |
| --- | --- |
| `proxy.ts` | Sends visitors without a valid session to `/login` |
| `lib/auth.ts`, `lib/session.ts` | Password check and signed session cookie |
| `app/login/` | Login page |
| `app/actions/auth.ts` | Login / logout Server Actions |
| `app/page.tsx` | Dashboard page (checks the session on the server) |
| `app/dashboard.tsx` | Dashboard state, Supabase data loading and real-time updates |
| `components/` | Readings, Beds and History views |
| `lib/dashboard-data.ts` | Data types and helpers |
| `supabase/vermiculture_beds.sql` | Table for beds added by the administrator |

## Scripts

- `npm run dev` – development server
- `npm run build` – production build
- `npm run start` – run the production build
- `npm run lint` – ESLint
