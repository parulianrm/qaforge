-- HavoX: add "Handled By" (assignee) to defects for the defect report export.

alter table defects
  add column if not exists handled_by text;
