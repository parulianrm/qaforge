-- HavoX Core MVP unified schema.
-- Keeps legacy columns where they exist, but makes the frontend contract explicit.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'active',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists test_cases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  tc_id text,
  test_case_code text,
  module_id uuid,
  module text not null default '',
  title text not null,
  precondition text,
  preconditions text,
  steps text,
  expected_result text,
  actual_result text,
  priority text not null default 'medium',
  status text not null default 'not_run',
  tester text,
  test_type text not null default 'UI',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table projects
  add column if not exists status text not null default 'active',
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists archived_at timestamptz;

alter table test_cases
  add column if not exists tc_id text,
  add column if not exists test_case_code text,
  add column if not exists module_id uuid,
  add column if not exists module text not null default '',
  add column if not exists precondition text,
  add column if not exists preconditions text,
  add column if not exists steps text,
  add column if not exists expected_result text,
  add column if not exists actual_result text,
  add column if not exists priority text not null default 'medium',
  add column if not exists status text not null default 'not_run',
  add column if not exists tester text,
  add column if not exists test_type text not null default 'UI',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

update projects
set
  created_by = coalesce(created_by, owner_id),
  owner_id = coalesce(owner_id, created_by),
  status = lower(coalesce(status, 'active'));

update test_cases
set
  tc_id = coalesce(tc_id, test_case_code),
  test_case_code = coalesce(test_case_code, tc_id),
  precondition = coalesce(precondition, preconditions),
  preconditions = coalesce(preconditions, precondition),
  module = coalesce(nullif(module, ''), 'General'),
  priority = case
    when lower(priority) in ('critical', 'high', 'medium', 'low') then lower(priority)
    when lower(priority) in ('blocker', 'major') then 'high'
    when lower(priority) in ('minor', 'trivial') then 'low'
    else 'medium'
  end,
  status = case
    when lower(status) in ('pass', 'passed') then 'pass'
    when lower(status) in ('fail', 'failed') then 'fail'
    when lower(status) in ('skip', 'skipped') then 'skip'
    else 'not_run'
  end,
  test_type = coalesce(nullif(test_type, ''), 'UI');

alter table defects
  add column if not exists reported_at date,
  add column if not exists issue_id text,
  add column if not exists attachment text,
  add column if not exists developer_notes text,
  add column if not exists merge_request text,
  add column if not exists qa_notes text,
  add column if not exists environment text,
  add column if not exists database_name text;

update defects
set
  priority = case
    when lower(coalesce(priority, severity)) in ('blocker', 'critical') then 'blocker'
    when lower(coalesce(priority, severity)) in ('high', 'major') then 'high'
    when lower(coalesce(priority, severity)) in ('low', 'minor', 'trivial') then 'low'
    else 'medium'
  end,
  severity = case
    when lower(coalesce(priority, severity)) in ('blocker', 'critical') then 'blocker'
    when lower(coalesce(priority, severity)) in ('high', 'major') then 'high'
    when lower(coalesce(priority, severity)) in ('low', 'minor', 'trivial') then 'low'
    else 'medium'
  end,
  status = case
    when lower(status) in ('in_progress', 'retest') then 'in_progress'
    when lower(status) in ('solved', 'resolved', 'fixed') then 'solved'
    when lower(status) = 'closed' then 'closed'
    else 'open'
  end;

create index if not exists projects_created_at_idx on projects(created_at desc);
create index if not exists test_cases_project_id_idx on test_cases(project_id);
create index if not exists test_cases_created_at_idx on test_cases(created_at desc);
create index if not exists test_cases_status_idx on test_cases(status);
create index if not exists test_cases_tc_id_idx on test_cases(tc_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_projects_updated_at on projects;
create trigger set_projects_updated_at
before update on projects
for each row
execute function set_updated_at();

drop trigger if exists set_test_cases_updated_at on test_cases;
create trigger set_test_cases_updated_at
before update on test_cases
for each row
execute function set_updated_at();

alter table projects enable row level security;
alter table test_cases enable row level security;

drop policy if exists "Authenticated users can read projects" on projects;
create policy "Authenticated users can read projects"
  on projects for select to authenticated using (true);

drop policy if exists "Authenticated users can insert projects" on projects;
create policy "Authenticated users can insert projects"
  on projects for insert to authenticated
  with check (auth.uid() = created_by or auth.uid() = owner_id or created_by is null);

drop policy if exists "Authenticated users can update projects" on projects;
create policy "Authenticated users can update projects"
  on projects for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete projects" on projects;
create policy "Authenticated users can delete projects"
  on projects for delete to authenticated using (true);

drop policy if exists "Authenticated users can read test cases" on test_cases;
create policy "Authenticated users can read test cases"
  on test_cases for select to authenticated using (true);

drop policy if exists "Authenticated users can insert test cases" on test_cases;
create policy "Authenticated users can insert test cases"
  on test_cases for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update test cases" on test_cases;
create policy "Authenticated users can update test cases"
  on test_cases for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete test cases" on test_cases;
create policy "Authenticated users can delete test cases"
  on test_cases for delete to authenticated using (true);

notify pgrst, 'reload schema';
