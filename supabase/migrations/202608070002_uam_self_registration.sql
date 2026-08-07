-- HavoX: allow email/password self-registration as an alternative to Google
-- sign-in, gated by admin approval instead of an email-confirmation link.
--
-- New profiles.status value: 'pending_approval' — set automatically when
-- someone signs up via the email/password provider with no matching
-- pending_invites row. is_current_user_active() already treats anything
-- other than 'active' as inactive, so a pending_approval account can log in
-- but every RLS-gated read/write is blocked until an admin approves them
-- from Manage Access.
--
-- Accounts that sign in via an OAuth provider (Google) are trusted
-- immediately and stay 'active', same as before. Accounts pre-invited by an
-- admin (a matching pending_invites row) are also trusted immediately,
-- regardless of provider, since an admin already vouched for that email.

alter table profiles drop constraint if exists profiles_status_check;
alter table profiles add constraint profiles_status_check
  check (status in ('active', 'disabled', 'pending_approval'));

alter table profiles add column if not exists provider text;

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
  v_provider text := auth.jwt() -> 'app_metadata' ->> 'provider';
  v_status text;
begin
  if auth.uid() is null then
    return;
  end if;

  if not exists (select 1 from profiles where id = auth.uid()) then
    select * into v_invite from pending_invites where lower(email) = current_user_email() limit 1;

    if v_invite.id is not null then
      v_status := 'active';
    elsif v_provider = 'email' then
      v_status := 'pending_approval';
    else
      v_status := 'active';
    end if;

    insert into profiles (id, email, full_name, avatar_url, role_id, status, provider, last_sign_in_at)
    values (
      auth.uid(),
      current_user_email(),
      v_name,
      v_avatar,
      coalesce(v_invite.role_id, 'user'),
      v_status,
      v_provider,
      now()
    );

    if v_invite.id is not null then
      delete from pending_invites where id = v_invite.id;
    end if;
  else
    update profiles
    set last_sign_in_at = now(),
        full_name = coalesce(v_name, full_name),
        avatar_url = coalesce(v_avatar, avatar_url),
        provider = coalesce(provider, v_provider)
    where id = auth.uid();
  end if;
end;
$havox_handle_login$;

notify pgrst, 'reload schema';
