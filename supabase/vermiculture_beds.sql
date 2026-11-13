-- Beds added by the farm administrator from the dashboard ("Beds" tab).
--
-- Run this once in the Supabase SQL editor. Until the table exists, the
-- dashboard keeps added beds in the administrator's browser only.

create table if not exists public.vermiculture_beds (
  id bigint generated always as identity primary key,
  bed_id text not null unique,          -- same value the bed's ESP32 sends as bed_id
  name text,
  location text,
  created_at timestamptz not null default now()
);

alter table public.vermiculture_beds enable row level security;

-- The dashboard talks to Supabase with the public (anon) key, exactly like it
-- does for vermiculture_readings, so that key needs to read and manage beds.
create policy "Dashboard can read beds"
  on public.vermiculture_beds for select
  to anon
  using (true);

create policy "Dashboard can add beds"
  on public.vermiculture_beds for insert
  to anon
  with check (true);

create policy "Dashboard can remove beds"
  on public.vermiculture_beds for delete
  to anon
  using (true);
