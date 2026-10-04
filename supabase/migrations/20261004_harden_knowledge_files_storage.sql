-- Already applied to the live project on 2026-10-04 (kept here so the repo matches production).
-- The old knowledge-files policies only checked bucket_id, letting any signed-in user read,
-- overwrite or delete other users' files. These enforce per-user folders ({user_id}/...).
drop policy if exists "Users can delete their own files 1du4dpk_0" on storage.objects;
drop policy if exists "Users can delete their own files 1du4dpk_1" on storage.objects;
drop policy if exists "Users can upload their own files 1du4dpk_0" on storage.objects;
drop policy if exists "Users can view their own files 1du4dpk_0" on storage.objects;

create policy "knowledge_files_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'knowledge-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "knowledge_files_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'knowledge-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "knowledge_files_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'knowledge-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

update storage.buckets set file_size_limit = 26214400 where id = 'knowledge-files';
