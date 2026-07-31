-- HavoX: close the RLS gap on recorder tables.
-- recording_sessions/recording_steps were left with "using (true)" policies
-- from 202606210001, so any authenticated user could read/update/delete any
-- other project's recorder data. Bring them in line with the per-project
-- access model introduced in 202606290002_project_access_management.sql.

drop policy if exists "Authenticated users can read recording sessions"
  on recording_sessions;
create policy "Project members can read recording sessions"
  on recording_sessions for select to authenticated
  using (project_id is null or has_project_access(project_id));

drop policy if exists "Authenticated users can insert recording sessions"
  on recording_sessions;
create policy "Project editors can insert recording sessions"
  on recording_sessions for insert to authenticated
  with check (
    project_id is not null
    and has_project_access(project_id, array['editor', 'owner'])
  );

drop policy if exists "Authenticated users can update recording sessions"
  on recording_sessions;
create policy "Project editors can update recording sessions"
  on recording_sessions for update to authenticated
  using (
    project_id is not null
    and has_project_access(project_id, array['editor', 'owner'])
  )
  with check (
    project_id is not null
    and has_project_access(project_id, array['editor', 'owner'])
  );

drop policy if exists "Authenticated users can delete recording sessions"
  on recording_sessions;
create policy "Project editors can delete recording sessions"
  on recording_sessions for delete to authenticated
  using (
    project_id is not null
    and has_project_access(project_id, array['editor', 'owner'])
  );

drop policy if exists "Authenticated users can read recording steps"
  on recording_steps;
create policy "Project members can read recording steps"
  on recording_steps for select to authenticated
  using (
    exists (
      select 1
      from recording_sessions rs
      where rs.id = recording_steps.recording_session_id
        and (rs.project_id is null or has_project_access(rs.project_id))
    )
  );

drop policy if exists "Authenticated users can insert recording steps"
  on recording_steps;
create policy "Project editors can insert recording steps"
  on recording_steps for insert to authenticated
  with check (
    exists (
      select 1
      from recording_sessions rs
      where rs.id = recording_steps.recording_session_id
        and rs.project_id is not null
        and has_project_access(rs.project_id, array['editor', 'owner'])
    )
  );

drop policy if exists "Authenticated users can update recording steps"
  on recording_steps;
create policy "Project editors can update recording steps"
  on recording_steps for update to authenticated
  using (
    exists (
      select 1
      from recording_sessions rs
      where rs.id = recording_steps.recording_session_id
        and rs.project_id is not null
        and has_project_access(rs.project_id, array['editor', 'owner'])
    )
  )
  with check (
    exists (
      select 1
      from recording_sessions rs
      where rs.id = recording_steps.recording_session_id
        and rs.project_id is not null
        and has_project_access(rs.project_id, array['editor', 'owner'])
    )
  );

drop policy if exists "Authenticated users can delete recording steps"
  on recording_steps;
create policy "Project editors can delete recording steps"
  on recording_steps for delete to authenticated
  using (
    exists (
      select 1
      from recording_sessions rs
      where rs.id = recording_steps.recording_session_id
        and rs.project_id is not null
        and has_project_access(rs.project_id, array['editor', 'owner'])
    )
  );

notify pgrst, 'reload schema';
