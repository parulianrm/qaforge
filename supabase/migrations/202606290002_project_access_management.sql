-- HavoX project-level access management for test cases and defects.
-- Grants are email-based so sharing can be prepared before a user signs in.

create table if not exists project_access (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_email text not null,
  role text not null default 'viewer' check (role in ('viewer', 'editor', 'owner')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, user_email)
);

create index if not exists project_access_project_id_idx
  on project_access(project_id);

create index if not exists project_access_user_email_idx
  on project_access(lower(user_email));

create or replace function set_updated_at()
returns trigger
language plpgsql
as $havox_set_updated_at$
begin
  new.updated_at = now();
  return new;
end;
$havox_set_updated_at$;

create or replace function current_user_email()
returns text
language sql
stable
as $havox_current_user_email$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$havox_current_user_email$;

create or replace function is_project_owner(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $havox_is_project_owner$
  select exists (
    select 1
    from projects p
    where p.id = target_project_id
      and (p.owner_id = auth.uid() or p.created_by = auth.uid())
  );
$havox_is_project_owner$;

create or replace function has_project_access(
  target_project_id uuid,
  allowed_roles text[] default array['viewer', 'editor', 'owner']
)
returns boolean
language sql
stable
security definer
set search_path = public
as $havox_has_project_access$
  select
    is_project_owner(target_project_id)
    or exists (
      select 1
      from project_access pa
      where pa.project_id = target_project_id
        and lower(pa.user_email) = current_user_email()
        and pa.role = any(allowed_roles)
    );
$havox_has_project_access$;

drop trigger if exists set_project_access_updated_at on project_access;
create trigger set_project_access_updated_at
before update on project_access
for each row
execute function set_updated_at();

alter table project_access enable row level security;

drop policy if exists "Project members can read access grants" on project_access;
create policy "Project members can read access grants"
  on project_access for select to authenticated
  using (has_project_access(project_id));

drop policy if exists "Project owners can insert access grants" on project_access;
create policy "Project owners can insert access grants"
  on project_access for insert to authenticated
  with check (is_project_owner(project_id));

drop policy if exists "Project owners can update access grants" on project_access;
create policy "Project owners can update access grants"
  on project_access for update to authenticated
  using (is_project_owner(project_id))
  with check (is_project_owner(project_id));

drop policy if exists "Project owners can delete access grants" on project_access;
create policy "Project owners can delete access grants"
  on project_access for delete to authenticated
  using (is_project_owner(project_id));

drop policy if exists "Authenticated users can read projects" on projects;
create policy "Project members can read projects"
  on projects for select to authenticated
  using (has_project_access(id));

drop policy if exists "Authenticated users can insert projects" on projects;
create policy "Authenticated users can create owned projects"
  on projects for insert to authenticated
  with check (auth.uid() = created_by or auth.uid() = owner_id);

drop policy if exists "Authenticated users can update projects" on projects;
create policy "Project owners can update projects"
  on projects for update to authenticated
  using (is_project_owner(id))
  with check (is_project_owner(id));

drop policy if exists "Authenticated users can delete projects" on projects;
create policy "Project owners can delete projects"
  on projects for delete to authenticated
  using (is_project_owner(id));

drop policy if exists "Authenticated users can read test cases" on test_cases;
create policy "Project members can read test cases"
  on test_cases for select to authenticated
  using (has_project_access(project_id));

drop policy if exists "Authenticated users can insert test cases" on test_cases;
create policy "Project editors can insert test cases"
  on test_cases for insert to authenticated
  with check (has_project_access(project_id, array['editor', 'owner']));

drop policy if exists "Authenticated users can update test cases" on test_cases;
create policy "Project editors can update test cases"
  on test_cases for update to authenticated
  using (has_project_access(project_id, array['editor', 'owner']))
  with check (has_project_access(project_id, array['editor', 'owner']));

drop policy if exists "Authenticated users can delete test cases" on test_cases;
create policy "Project editors can delete test cases"
  on test_cases for delete to authenticated
  using (has_project_access(project_id, array['editor', 'owner']));

drop policy if exists "Authenticated users can read defects" on defects;
create policy "Project members can read defects"
  on defects for select to authenticated
  using (project_id is null or has_project_access(project_id));

drop policy if exists "Authenticated users can insert defects" on defects;
create policy "Project editors can insert defects"
  on defects for insert to authenticated
  with check (project_id is not null and has_project_access(project_id, array['editor', 'owner']));

drop policy if exists "Authenticated users can update defects" on defects;
create policy "Project editors can update defects"
  on defects for update to authenticated
  using (project_id is not null and has_project_access(project_id, array['editor', 'owner']))
  with check (project_id is not null and has_project_access(project_id, array['editor', 'owner']));

drop policy if exists "Authenticated users can delete defects" on defects;
create policy "Project editors can delete defects"
  on defects for delete to authenticated
  using (project_id is not null and has_project_access(project_id, array['editor', 'owner']));

notify pgrst, 'reload schema';
