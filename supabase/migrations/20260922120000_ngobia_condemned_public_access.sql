-- NGOBIA demonstration update: remove Auth requirements for fictional demonstration data.
alter table public.assets enable row level security;

drop policy if exists "Public can read demonstration assets" on public.assets;
drop policy if exists "Asset administrators can insert assets" on public.assets;
drop policy if exists "Asset administrators can update assets" on public.assets;
drop policy if exists "Asset administrators can delete assets" on public.assets;
drop policy if exists "Public can insert demonstration assets" on public.assets;

create policy "Public can read demonstration assets"
  on public.assets for select
  to anon, authenticated
  using (true);

create policy "Public can insert demonstration assets"
  on public.assets for insert
  to anon, authenticated
  with check (
    condition in ('Good', 'Minor Repair', 'Major Repair', 'Condemned')
    and estimated_repair_cost >= 0
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'asset-photos',
  'asset-photos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read asset photographs" on storage.objects;
drop policy if exists "Asset administrators can upload photographs" on storage.objects;
drop policy if exists "Asset administrators can update photographs" on storage.objects;
drop policy if exists "Asset administrators can delete photographs" on storage.objects;
drop policy if exists "Public can upload asset photographs" on storage.objects;

create policy "Public can read asset photographs"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'asset-photos');

create policy "Public can upload asset photographs"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'asset-photos'
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  );
