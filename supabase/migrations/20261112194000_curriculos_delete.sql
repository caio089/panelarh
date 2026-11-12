-- RH pode apagar o PDF do storage quando a candidatura sai do painel.
drop policy if exists curriculos_delete on storage.objects;
create policy curriculos_delete
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'curriculos');
