-- HavoX: User Access Management (UAM).
-- Adds system-level roles (which pages a user may open) on top of the
-- existing project-level access model (project_access: viewer/editor/owner).
--
-- - roles: admin-configurable roles + a page-permission matrix (jsonb).
-- - profiles: mirrors auth.users for every user who has signed in at least
--   once, plus the system role assigned to them.
-- - pending_invites: users an admin added before they ever signed in. When
--   someone signs in with a matching email, handle_login() promotes the
--   invite into a real profile and removes it.
--
-- Bootstrapping note: the very first person to sign in gets the default
-- 'user' role (there is no one to promote them yet). After you sign in once,
-- promote yourself manually from the Supabase SQL editor:
--   update profiles set role_id = 'super-admin' where email = 'you@example.com';

create table if not exists roles (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  accent text not null default 'slate'
    check (accent in ('indigo', 'sky', 'violet', 'teal', 'amber', 'rose', 'slate')),
  is_system boolean not null default false,
  description text,
  permissions jsonb not null default '{
    "dashboard": true, "testcases": true, "defects": true,
    "templates": true, "recorder": true,
    "manage_access": false, "manage_roles": false
  }'::jsonb,
  created_at timestamptz not null default now()
);

insert into roles (id, name, accent, is_system, description, permissions) values
  ('super-admin', 'Super Admin', 'indigo', true,
   'Akses penuh ke semua halaman, termasuk pengaturan role. Tidak bisa dihapus.',
   '{"dashboard":true,"testcases":true,"defects":true,"templates":true,"recorder":true,"manage_access":true,"manage_roles":true}'::jsonb),
  ('user', 'User', 'slate', true,
   'Role default untuk user baru yang login lewat Google.',
   '{"dashboard":true,"testcases":true,"defects":true,"templates":true,"recorder":true,"manage_access":false,"manage_roles":false}'::jsonb)
on conflict (id) do nothing;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role_id text not null default 'user' references roles(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'disabled')),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_email_idx on profiles (lower(email));
create index if not exists profiles_role_id_idx on profiles (role_id);

create table if not exists pending_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role_id text not null default 'user' references roles(id) on delete restrict,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists pending_invites_email_idx on pending_invites (lower(email));
create index if not exists pending_invites_role_id_idx on pending_invites (role_id);

-- ── Guardrails ────────────────────────────────────────────────────────────

create or replace function prevent_invite_for_existing_profile()
returns trigger
language plpgsql
as $havox_prevent_invite_dup$
begin
  if exists (select 1 from profiles where lower(email) = lower(new.email)) then
    raise exception 'User dengan email % sudah terdaftar.', new.email;
  end if;
  return new;
end;
$havox_prevent_invite_dup$;

drop trigger if exists trg_prevent_invite_dup on pending_invites;
create trigger trg_prevent_invite_dup
before insert on pending_invites
for each row
execute function prevent_invite_for_existing_profile();

create or replace function prevent_unsafe_role_delete()
returns trigger
language plpgsql
as $havox_prevent_role_delete$
begin
  if old.is_system then
    raise exception 'Role sistem "%" tidak bisa dihapus.', old.name;
  end if;
  if exists (select 1 from profiles where role_id = old.id)
     or exists (select 1 from pending_invites where role_id = old.id) then
    raise exception 'Role "%" masih dipakai oleh user, tidak bisa dihapus.', old.name;
  end if;
  return old;
end;
$havox_prevent_role_delete$;

drop trigger if exists trg_prevent_unsafe_role_delete on roles;
create trigger trg_prevent_unsafe_role_delete
before delete on roles
for each row
execute function prevent_unsafe_role_delete();

create or replace function prevent_super_admin_lockout()
returns trigger
language plpgsql
as $havox_prevent_lockout$
begin
  if old.id = 'super-admin' then
    if new.name is distinct from old.name then
      raise exception 'Nama role Super Admin tidak bisa diubah.';
    end if;
    new.permissions = jsonb_set(
      jsonb_set(new.permissions, '{manage_access}', 'true'),
      '{manage_roles}', 'true'
    );
  end if;
  return new;
end;
$havox_prevent_lockout$;

drop trigger if exists trg_prevent_super_admin_lockout on roles;
create trigger trg_prevent_super_admin_lockout
before update on roles
for each row
execute function prevent_super_admin_lockout();

-- ── Permission helpers ──────────────────────────────────────────────────────

create or replace function is_current_user_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $havox_is_active$
  select coalesce((select status = 'active' from profiles where id = auth.uid()), true);
$havox_is_active$;

create or replace function current_role_id()
returns text
language sql
stable
security definer
set search_path = public
as $havox_current_role_id$
  select role_id from profiles where id = auth.uid();
$havox_current_role_id$;

create or replace function has_page_permission(page_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $havox_has_page_permission$
  select is_current_user_active() and coalesce(
    (select (permissions ->> page_key)::boolean from roles where id = current_role_id()),
    false
  );
$havox_has_page_permission$;

-- Disabled accounts lose access everywhere: fold the active-status check into
-- the two functions every existing project_access/projects/test_cases/... policy
-- already depends on (from 202606290002_project_access_management.sql).
create or replace function is_project_owner(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $havox_is_project_owner$
  select is_current_user_active() and exists (
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
  select is_current_user_active() and (
    is_project_owner(target_project_id)
    or exists (
      select 1
      from project_access pa
      where pa.project_id = target_project_id
        and lower(pa.user_email) = current_user_email()
        and pa.role = any(allowed_roles)
    )
  );
$havox_has_project_access$;

-- ── Login provisioning ──────────────────────────────────────────────────────
-- Called by the client right after a successful sign-in. Runs as the function
-- owner (bypasses RLS) so it can create/claim the caller's own profile row.

create or replace function handle_login()
returns void
language plpgsql
security definer
set search_path = public
as $havox_handle_login$
declare
  v_invite pending_invites%rowtype;
  v_name text := coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', auth.jwt() -> 'user_metadata' ->> 'name');
  v_avatar text := auth.jwt() -> 'user_metadata' ->> 'avatar_url';
begin
  if auth.uid() is null then
    return;
  end if;

  if not exists (select 1 from profiles where id = auth.uid()) then
    select * into v_invite from pending_invites where lower(email) = current_user_email() limit 1;

    insert into profiles (id, email, full_name, avatar_url, role_id, status, last_sign_in_at)
    values (
      auth.uid(),
      current_user_email(),
      v_name,
      v_avatar,
      coalesce(v_invite.role_id, 'user'),
      'active',
      now()
    );

    if found then
      delete from pending_invites where id = v_invite.id;
    end if;
  else
    update profiles
    set last_sign_in_at = now(),
        full_name = coalesce(v_name, full_name),
        avatar_url = coalesce(v_avatar, avatar_url)
    where id = auth.uid();
  end if;
end;
$havox_handle_login$;

grant execute on function handle_login() to authenticated;
grant execute on function has_page_permission(text) to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────

alter table roles enable row level security;

drop policy if exists "Authenticated users can read roles" on roles;
create policy "Authenticated users can read roles"
  on roles for select to authenticated
  using (true);

drop policy if exists "Role managers can insert roles" on roles;
create policy "Role managers can insert roles"
  on roles for insert to authenticated
  with check (has_page_permission('manage_roles'));

drop policy if exists "Role managers can update roles" on roles;
create policy "Role managers can update roles"
  on roles for update to authenticated
  using (has_page_permission('manage_roles'))
  with check (has_page_permission('manage_roles'));

drop policy if exists "Role managers can delete roles" on roles;
create policy "Role managers can delete roles"
  on roles for delete to authenticated
  using (has_page_permission('manage_roles'));

alter table profiles enable row level security;

drop policy if exists "Users can read own profile or admins read all" on profiles;
create policy "Users can read own profile or admins read all"
  on profiles for select to authenticated
  using (id = auth.uid() or has_page_permission('manage_access'));

drop policy if exists "Admins can update profiles" on profiles;
create policy "Admins can update profiles"
  on profiles for update to authenticated
  using (has_page_permission('manage_access'))
  with check (has_page_permission('manage_access'));

alter table pending_invites enable row level security;

drop policy if exists "Admins can read pending invites" on pending_invites;
create policy "Admins can read pending invites"
  on pending_invites for select to authenticated
  using (has_page_permission('manage_access'));

drop policy if exists "Admins can insert pending invites" on pending_invites;
create policy "Admins can insert pending invites"
  on pending_invites for insert to authenticated
  with check (has_page_permission('manage_access'));

drop policy if exists "Admins can update pending invites" on pending_invites;
create policy "Admins can update pending invites"
  on pending_invites for update to authenticated
  using (has_page_permission('manage_access'))
  with check (has_page_permission('manage_access'));

drop policy if exists "Admins can delete pending invites" on pending_invites;
create policy "Admins can delete pending invites"
  on pending_invites for delete to authenticated
  using (has_page_permission('manage_access'));

-- Let platform admins (manage_access permission) manage project access and
-- see all projects even when they're not the project owner — previously only
-- the project owner could grant/revoke access (202606290002).

drop policy if exists "Project members can read access grants" on project_access;
create policy "Project members or admins can read access grants"
  on project_access for select to authenticated
  using (has_project_access(project_id) or has_page_permission('manage_access'));

drop policy if exists "Project owners can insert access grants" on project_access;
create policy "Project owners or admins can insert access grants"
  on project_access for insert to authenticated
  with check (is_project_owner(project_id) or has_page_permission('manage_access'));

drop policy if exists "Project owners can update access grants" on project_access;
create policy "Project owners or admins can update access grants"
  on project_access for update to authenticated
  using (is_project_owner(project_id) or has_page_permission('manage_access'))
  with check (is_project_owner(project_id) or has_page_permission('manage_access'));

drop policy if exists "Project owners can delete access grants" on project_access;
create policy "Project owners or admins can delete access grants"
  on project_access for delete to authenticated
  using (is_project_owner(project_id) or has_page_permission('manage_access'));

drop policy if exists "Project members can read projects" on projects;
create policy "Project members or admins can read projects"
  on projects for select to authenticated
  using (has_project_access(id) or has_page_permission('manage_access'));

notify pgrst, 'reload schema';
