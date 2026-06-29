-- HavoX Defect Logging fields for Excel-compatible import/export.
-- Safe to run more than once in Supabase SQL Editor.

alter table defects
  add column if not exists project_id uuid references projects(id) on delete cascade,
  add column if not exists module text,
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists severity text not null default 'medium',
  add column if not exists priority text not null default 'medium',
  add column if not exists status text not null default 'open',
  add column if not exists reporter text,
  add column if not exists issue_id text,
  add column if not exists reported_at date,
  add column if not exists attachment text,
  add column if not exists developer_notes text,
  add column if not exists merge_request text,
  add column if not exists qa_notes text,
  add column if not exists environment text,
  add column if not exists database_name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists defects_issue_id_idx
  on defects(issue_id);

create index if not exists defects_reported_at_idx
  on defects(reported_at desc);

create index if not exists defects_project_id_idx
  on defects(project_id);

create index if not exists defects_status_idx
  on defects(status);

create index if not exists defects_severity_idx
  on defects(severity);

notify pgrst, 'reload schema';
