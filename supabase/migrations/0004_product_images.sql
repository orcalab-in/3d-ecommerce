-- Multiple photos per catalog product (was a single image_path column).

alter table products add column if not exists image_paths text[] not null default '{}';

update products
set image_paths = array[image_path]
where image_path is not null and coalesce(array_length(image_paths, 1), 0) = 0;

alter table products drop column if exists image_path;
