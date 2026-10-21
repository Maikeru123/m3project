-- Fields from the single-page building registration form. Keep them nullable for older records.
alter table public.assets
  add column if not exists region text,
  add column if not exists implementing_office text,
  add column if not exists building_group text,
  add column if not exists lot_status text,
  add column if not exists building_status text,
  add column if not exists lot_area_sqm numeric(14,2),
  add column if not exists total_floor_area_sqm numeric(14,2),
  add column if not exists bir_zonal_value_per_sqm numeric(15,2),
  add column if not exists number_of_storeys integer,
  add column if not exists construction_type text,
  add column if not exists year_of_construction integer,
  add column if not exists book_value numeric(15,2),
  add column if not exists appraised_value numeric(15,2),
  add column if not exists estimated_cost numeric(15,2),
  add column if not exists include_agency_inventory boolean not null default false,
  add column if not exists property_number text,
  add column if not exists company text,
  add column if not exists project_head text,
  add column if not exists client_info text;

-- The checkbox creates an Agency Inventory entry from the same saved building.
-- A view keeps that entry in sync when its source building changes.
create or replace view public.agency_inventory_entries
with (security_invoker = true) as
select building_id, region, managing_agency, building_name, location,
       lot_area_sqm, total_floor_area_sqm, number_of_storeys,
       construction_type, year_of_construction, book_value, appraised_value
from public.assets
where include_agency_inventory = true;

grant select on public.agency_inventory_entries to anon, authenticated;
