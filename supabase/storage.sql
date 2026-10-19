-- Private storage bucket for original photos, generated STLs, and preview
-- images. Run after 0001_init.sql. Everything is private (no public read);
-- the app issues short-lived signed URLs from the server when needed.

insert into storage.buckets (id, name, public, file_size_limit)
values ('lithophane-files', 'lithophane-files', false, 104857600) -- 100MB headroom for generated STLs
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- No storage.objects policies are added for anon/authenticated roles, so
-- only the service-role key (used server-side only) can read or write.
