-- A building is registered once; every site visit is a separate inspection.
create table if not exists public.inspections (
  id uuid primary key default gen_random_uuid(),
  building_id text not null references public.assets(building_id) on update cascade on delete cascade,
  condition text not null check (condition in ('Good', 'Minor Repair', 'Major Repair', 'Total Rehabilitation', 'Demolished', 'Condemned')),
  condition_as_printed text,
  visit_date date,
  inspector_name text not null check (length(trim(inspector_name)) > 0),
  remarks text,
  entry_notes text,
  created_at timestamptz not null default now()
);

create index if not exists inspections_building_latest_idx
  on public.inspections (building_id, visit_date desc nulls last, created_at desc);

create table if not exists public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  view_key text not null check (view_key in ('front', 'right', 'left', 'rear')),
  storage_path text not null,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  constraint inspection_photos_coordinate_pair check ((latitude is null) = (longitude is null)),
  unique (inspection_id, view_key)
);

-- Preserve the condition already displayed for each existing building.
insert into public.inspections (building_id, condition, visit_date, inspector_name, entry_notes)
select a.building_id, a.condition, a.last_inspected_date, 'Imported record',
       'Condition carried forward from the original building record.'
from public.assets a
where a.condition is not null
  and not exists (select 1 from public.inspections i where i.building_id = a.building_id);

alter table public.assets alter column condition drop not null;

drop policy if exists "Public can insert demonstration assets" on public.assets;
drop policy if exists "Public can update demonstration assets" on public.assets;
create policy "Public can insert demonstration assets" on public.assets for insert to anon, authenticated
  with check (length(trim(building_id)) > 0 and length(trim(building_name)) > 0
    and length(trim(managing_agency)) > 0 and length(trim(location)) > 0 and estimated_repair_cost >= 0);
create policy "Public can update demonstration assets" on public.assets for update to anon, authenticated
  using (true) with check (length(trim(building_id)) > 0 and length(trim(building_name)) > 0
    and length(trim(managing_agency)) > 0 and length(trim(location)) > 0 and estimated_repair_cost >= 0);

alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
create policy "Read inspections" on public.inspections for select to anon, authenticated using (true);
create policy "Add inspections" on public.inspections for insert to anon, authenticated with check (true);
create policy "Update inspections" on public.inspections for update to anon, authenticated using (true) with check (true);
create policy "Delete inspections" on public.inspections for delete to anon, authenticated using (true);
create policy "Read inspection photos" on public.inspection_photos for select to anon, authenticated using (true);
create policy "Add inspection photos" on public.inspection_photos for insert to anon, authenticated with check (true);
create policy "Delete inspection photos" on public.inspection_photos for delete to anon, authenticated using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inspection-photos', 'inspection-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create policy "Read inspection photo files" on storage.objects for select to anon, authenticated
  using (bucket_id = 'inspection-photos');
create policy "Upload inspection photo files" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'inspection-photos' and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp'));
create policy "Delete inspection photo files" on storage.objects for delete to anon, authenticated
  using (bucket_id = 'inspection-photos');

create or replace view public.latest_building_inspections with (security_invoker = true) as
select distinct on (building_id) id, building_id, condition, condition_as_printed, visit_date,
       inspector_name, remarks, entry_notes, created_at
from public.inspections
order by building_id, visit_date desc nulls last, created_at desc, id desc;
grant select on public.latest_building_inspections to anon, authenticated;

create or replace view public.report_by_agency with (security_invoker = true) as
select coalesce(a.managing_agency, 'Unassigned') as agency,
       count(*)::integer as total_buildings,
       count(*) filter (where i.condition = 'Good')::integer as good,
       count(*) filter (where i.condition = 'Minor Repair')::integer as minor_repair,
       count(*) filter (where i.condition = 'Major Repair')::integer as major_repair,
       count(*) filter (where i.condition = 'Total Rehabilitation')::integer as total_rehabilitation,
       count(*) filter (where i.condition = 'Demolished')::integer as demolished,
       count(*) filter (where i.condition = 'Condemned')::integer as condemned,
       count(*) filter (where i.id is null)::integer as not_inspected,
       coalesce(sum(a.estimated_cost), 0) as total_estimated_cost,
       coalesce(sum(a.book_value), 0) as total_book_value,
       coalesce(sum(a.appraised_value), 0) as total_appraised_value
from public.assets a
left join public.latest_building_inspections i on i.building_id = a.building_id
where a.include_agency_inventory = true
group by coalesce(a.managing_agency, 'Unassigned');
grant select on public.report_by_agency to anon, authenticated;

create or replace view public.report_by_inspection_year with (security_invoker = true) as
select coalesce(extract(year from i.visit_date)::integer::text, 'Undated') as calendar_year,
       count(*)::integer as total_buildings,
       count(*) filter (where i.condition = 'Good')::integer as good,
       count(*) filter (where i.condition = 'Minor Repair')::integer as minor_repair,
       count(*) filter (where i.condition = 'Major Repair')::integer as major_repair,
       count(*) filter (where i.condition = 'Total Rehabilitation')::integer as total_rehabilitation,
       count(*) filter (where i.condition = 'Demolished')::integer as demolished,
       count(*) filter (where i.condition = 'Condemned')::integer as condemned,
       count(*) filter (where i.id is null)::integer as not_inspected,
       coalesce(sum(a.estimated_cost), 0) as total_estimated_cost
from public.assets a
left join public.latest_building_inspections i on i.building_id = a.building_id
group by coalesce(extract(year from i.visit_date)::integer::text, 'Undated');
grant select on public.report_by_inspection_year to anon, authenticated;
