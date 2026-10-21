-- Coordinates are optional so existing asset records remain available.
alter table public.assets
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.assets
  add constraint assets_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint assets_longitude_range check (longitude is null or longitude between -180 and 180),
  add constraint assets_coordinates_pair check ((latitude is null) = (longitude is null));
