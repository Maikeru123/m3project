-- Construction Asset Management System: one assets table and a public photo bucket.
-- The policy statements are deliberately replay-safe for a previously created table.
create table if not exists public.assets (
  building_id text primary key,
  building_name text not null,
  condition text not null check (condition in ('Good', 'Minor Repair', 'Major Repair')),
  estimated_repair_cost numeric(15,2) not null default 0 check (estimated_repair_cost >= 0),
  photo_path text
);

alter table public.assets enable row level security;

drop policy if exists "Public can read demonstration assets" on public.assets;
drop policy if exists "Asset administrators can insert assets" on public.assets;
drop policy if exists "Asset administrators can update assets" on public.assets;
drop policy if exists "Asset administrators can delete assets" on public.assets;

create policy "Public can read demonstration assets" on public.assets for select using (true);
create policy "Asset administrators can insert assets" on public.assets for insert to authenticated with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'asset_admin');
create policy "Asset administrators can update assets" on public.assets for update to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'asset_admin') with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'asset_admin');
create policy "Asset administrators can delete assets" on public.assets for delete to authenticated using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'asset_admin');

insert into storage.buckets (id, name, public) values ('asset-photos', 'asset-photos', true) on conflict (id) do update set public = true;

drop policy if exists "Public can read asset photographs" on storage.objects;
drop policy if exists "Asset administrators can upload photographs" on storage.objects;
drop policy if exists "Asset administrators can update photographs" on storage.objects;
drop policy if exists "Asset administrators can delete photographs" on storage.objects;

create policy "Public can read asset photographs" on storage.objects for select using (bucket_id = 'asset-photos');
create policy "Asset administrators can upload photographs" on storage.objects for insert to authenticated with check (bucket_id = 'asset-photos' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'asset_admin');
create policy "Asset administrators can update photographs" on storage.objects for update to authenticated using (bucket_id = 'asset-photos' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'asset_admin') with check (bucket_id = 'asset-photos' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'asset_admin');
create policy "Asset administrators can delete photographs" on storage.objects for delete to authenticated using (bucket_id = 'asset-photos' and (auth.jwt() -> 'app_metadata' ->> 'role') = 'asset_admin');
