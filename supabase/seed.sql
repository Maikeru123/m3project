-- Fictional mock data. Safe to rerun: it inserts only IDs that do not yet exist.
insert into public.assets (building_id, building_name, condition, estimated_repair_cost, photo_path) values
  ('MOCK-GOV-001', 'Mock Municipal Hall', 'Good', 0, null),
  ('MOCK-GOV-002', 'Mock Public Library', 'Minor Repair', 185000.00, null),
  ('MOCK-GOV-003', 'Mock Community Health Center', 'Major Repair', 720000.00, null)
on conflict (building_id) do nothing;
