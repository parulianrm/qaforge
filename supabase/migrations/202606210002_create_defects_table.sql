-- HavoX Core MVP: defect foundation.
-- Safe to run more than once in Supabase SQL Editor.

create table if not exists defects (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  module text,
  title text not null,
  description text,
  expected_result text,
  actual_result text,
  severity text not null default 'MINOR',
  priority text not null default 'MEDIUM',
  status text not null default 'OPEN',
  reporter text,
  assigned_to text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists defects_project_id_idx
  on defects(project_id);

create index if not exists defects_status_idx
  on defects(status);

create index if not exists defects_severity_idx
  on defects(severity);

create index if not exists defects_created_at_idx
  on defects(created_at desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_defects_updated_at on defects;
create trigger set_defects_updated_at
before update on defects
for each row
execute function set_updated_at();

alter table defects enable row level security;

drop policy if exists "Authenticated users can read defects"
  on defects;
create policy "Authenticated users can read defects"
  on defects
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert defects"
  on defects;
create policy "Authenticated users can insert defects"
  on defects
  for insert
  to authenticated
  with check (auth.uid() = created_by or created_by is null);

drop policy if exists "Authenticated users can update defects"
  on defects;
create policy "Authenticated users can update defects"
  on defects
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete defects"
  on defects;
create policy "Authenticated users can delete defects"
  on defects
  for delete
  to authenticated
  using (true);
