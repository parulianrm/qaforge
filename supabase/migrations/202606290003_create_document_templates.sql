-- HavoX document template master for QAD and future generated documents.

create table if not exists document_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document_type text not null default 'QAD',
  description text,
  content_html text not null,
  is_default boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_templates_type_idx
  on document_templates(document_type);

create index if not exists document_templates_created_at_idx
  on document_templates(created_at desc);

drop trigger if exists set_document_templates_updated_at on document_templates;
create trigger set_document_templates_updated_at
before update on document_templates
for each row
execute function set_updated_at();

alter table document_templates enable row level security;

drop policy if exists "Authenticated users can read document templates"
  on document_templates;
create policy "Authenticated users can read document templates"
  on document_templates for select to authenticated using (true);

drop policy if exists "Authenticated users can insert document templates"
  on document_templates;
create policy "Authenticated users can insert document templates"
  on document_templates for insert to authenticated with check (true);

drop policy if exists "Authenticated users can update document templates"
  on document_templates;
create policy "Authenticated users can update document templates"
  on document_templates for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated users can delete document templates"
  on document_templates;
create policy "Authenticated users can delete document templates"
  on document_templates for delete to authenticated using (true);

notify pgrst, 'reload schema';
