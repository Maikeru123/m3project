-- Safely extend the existing condition check without recreating the table or changing asset rows.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select distinct constraint_record.conname
    from pg_constraint as constraint_record
    join pg_attribute as attribute_record
      on attribute_record.attrelid = constraint_record.conrelid
      and attribute_record.attnum = any (constraint_record.conkey)
    where constraint_record.conrelid = 'public.assets'::regclass
      and constraint_record.contype = 'c'
      and attribute_record.attname = 'condition'
  loop
    execute format('alter table public.assets drop constraint %I', constraint_name);
  end loop;

  alter table public.assets
    add constraint assets_condition_check
    check (condition in ('Good', 'Minor Repair', 'Major Repair', 'Condemned'));
end $$;
