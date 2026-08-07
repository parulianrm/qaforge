-- HavoX Core MVP: recorder persistence.
-- Safe to run more than once.

create table if not exists recording_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  module text,
  title text not null,
  description text,
  target_url text,
  browser text,
  status text not null default 'RECORDED',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists recording_steps (
  id uuid primary key default gen_random_uuid(),
  recording_session_id uuid not null references recording_sessions(id) on delete cascade,
  step_order integer not null,
  action_type text not null,
  target_text text,
  locator_css text,
  locator_xpath text,
  value text,
  url text,
  screenshot_url text,
  timestamp timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists recording_sessions_project_id_idx
  on recording_sessions(project_id);

create index if not exists recording_sessions_created_at_idx
  on recording_sessions(created_at desc);

create index if not exists recording_steps_session_id_order_idx
  on recording_steps(recording_session_id, step_order);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_recording_sessions_updated_at on recording_sessions;
create trigger set_recording_sessions_updated_at
before update on recording_sessions
for each row
execute function set_updated_at();

alter table recording_sessions enable row level security;
alter table recording_steps enable row level security;

drop policy if exists "Authenticated users can read recording sessions"
  on recording_sessions;
create policy "Authenticated users can read recording sessions"
  on recording_sessions
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert recording sessions"
  on recording_sessions;
create policy "Authenticated users can insert recording sessions"
  on recording_sessions
  for insert
  to authenticated
  with check (auth.uid() = created_by or created_by is null);

drop policy if exists "Authenticated users can update recording sessions"
  on recording_sessions;
create policy "Authenticated users can update recording sessions"
  on recording_sessions
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete recording sessions"
  on recording_sessions;
create policy "Authenticated users can delete recording sessions"
  on recording_sessions
  for delete
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read recording steps"
  on recording_steps;
create policy "Authenticated users can read recording steps"
  on recording_steps
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert recording steps"
  on recording_steps;
create policy "Authenticated users can insert recording steps"
  on recording_steps
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from recording_sessions rs
      where rs.id = recording_steps.recording_session_id
    )
  );

drop policy if exists "Authenticated users can update recording steps"
  on recording_steps;
create policy "Authenticated users can update recording steps"
  on recording_steps
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete recording steps"
  on recording_steps;
create policy "Authenticated users can delete recording steps"
  on recording_steps
  for delete
  to authenticated
  using (true);
