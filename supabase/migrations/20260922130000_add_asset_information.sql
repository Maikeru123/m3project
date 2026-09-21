-- Add NGOBIA asset details without recreating the table or changing existing records.
-- Columns remain nullable so legacy rows continue to be valid until they are backfilled.
alter table public.assets
  add column if not exists managing_agency text,
  add column if not exists ownership_status text,
  add column if not exists location text,
  add column if not exists last_inspected_date date;
