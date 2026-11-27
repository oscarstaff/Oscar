-- Christmas activity "Guess the Childhood Picture": private photo collection.
-- Run once in the Supabase SQL editor. Safe to run again.
--
-- Privacy: photos live in the PRIVATE storage bucket xmas-photos. Each person can only see, add and delete their OWN photos.
-- Only the organiser (xmas_is_organiser() below) can see everyone's photos and who joined or counted themselves out.
-- That is deliberately NOT every hub admin, because the invite promised that only the organiser sees who is taking part.
-- (Anyone who opens the Supabase dashboard itself can still see the data; that cannot be changed from inside the app.)
-- Limits: 5 photos per person, 5 MB each, JPEG / PNG / WebP only.
-- When the activity is over, use "Delete everything" in the organiser view (or drop these objects).

-- who the organiser is: change the name here if it ever needs to be someone else
create or replace function public.xmas_is_organiser() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.current_staff_name() = 'Sanskar Pokharel', false)
$$;
revoke all on function public.xmas_is_organiser() from public, anon;
grant execute on function public.xmas_is_organiser() to authenticated;

-- 1. the private bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('xmas-photos', 'xmas-photos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- 2. one row per photo (this is what the 5-photo limit counts) and one row per person who counted themselves out
create table if not exists public.xmas_photos (
  id          uuid primary key default gen_random_uuid(),
  staff_name  text not null,
  path        text not null unique,                       -- <auth uid>/<random>.jpg inside the bucket
  size_bytes  int  not null check (size_bytes > 0 and size_bytes <= 5242880),
  created_at  timestamptz not null default now()
);
create index if not exists xmas_photos_staff on public.xmas_photos (staff_name);
create table if not exists public.xmas_optout (
  staff_name  text primary key,
  created_at  timestamptz not null default now()
);

alter table public.xmas_photos enable row level security;
alter table public.xmas_optout enable row level security;
revoke all on table public.xmas_photos, public.xmas_optout from anon, public, authenticated;
grant select, insert, delete on table public.xmas_photos, public.xmas_optout to authenticated;

drop policy if exists xmas_photos_sel on public.xmas_photos;
create policy xmas_photos_sel on public.xmas_photos for select to authenticated
  using (staff_name = (select public.current_staff_name()) or (select public.xmas_is_organiser()));
drop policy if exists xmas_photos_ins on public.xmas_photos;
create policy xmas_photos_ins on public.xmas_photos for insert to authenticated
  with check (staff_name = (select public.current_staff_name()) and path like ((select auth.uid())::text || '/%'));
drop policy if exists xmas_photos_del on public.xmas_photos;
create policy xmas_photos_del on public.xmas_photos for delete to authenticated
  using (staff_name = (select public.current_staff_name()) or (select public.xmas_is_organiser()));

drop policy if exists xmas_optout_sel on public.xmas_optout;
create policy xmas_optout_sel on public.xmas_optout for select to authenticated
  using (staff_name = (select public.current_staff_name()) or (select public.xmas_is_organiser()));
drop policy if exists xmas_optout_ins on public.xmas_optout;
create policy xmas_optout_ins on public.xmas_optout for insert to authenticated
  with check (staff_name = (select public.current_staff_name()));
drop policy if exists xmas_optout_del on public.xmas_optout;
create policy xmas_optout_del on public.xmas_optout for delete to authenticated
  using (staff_name = (select public.current_staff_name()) or (select public.xmas_is_organiser()));

-- 3. the limit: at most 5 photos per person, and none after counting out. A lock per person stops five uploads sent at the same moment from slipping past the count.
create or replace function public.xmas_photo_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext('xmas:' || new.staff_name));
  if exists (select 1 from public.xmas_optout where staff_name = new.staff_name) then
    raise exception 'You counted yourself out of this activity.';
  end if;
  if (select count(*) from public.xmas_photos where staff_name = new.staff_name) >= 5 then
    raise exception 'You can add up to 5 photos.';
  end if;
  return new;
end $$;
drop trigger if exists xmas_photo_guard on public.xmas_photos;
create trigger xmas_photo_guard before insert on public.xmas_photos for each row execute function public.xmas_photo_guard();

-- 4. who can touch the files: a photo can only be uploaded into your own folder AND only if its row (which the limit above counted) already exists.
drop policy if exists xmas_files_ins on storage.objects;
create policy xmas_files_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'xmas-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.xmas_photos p where p.path = objects.name and p.staff_name = (select public.current_staff_name())));
drop policy if exists xmas_files_sel on storage.objects;
create policy xmas_files_sel on storage.objects for select to authenticated
  using (bucket_id = 'xmas-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.xmas_is_organiser())));
drop policy if exists xmas_files_del on storage.objects;
create policy xmas_files_del on storage.objects for delete to authenticated
  using (bucket_id = 'xmas-photos' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.xmas_is_organiser())));
