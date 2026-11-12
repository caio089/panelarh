-- Currículos da candidatura pública. Candidatos antigos não têm arquivo; a coluna já existia.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'curriculos',
  'curriculos',
  true,
  5242880,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists curriculos_insert on storage.objects;
drop policy if exists curriculos_select on storage.objects;

create policy curriculos_insert
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'curriculos');

create policy curriculos_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'curriculos');
