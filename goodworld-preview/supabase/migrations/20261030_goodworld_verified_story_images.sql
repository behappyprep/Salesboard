-- GoodWorld rights-vetted agency photography, 2026-10-30.
-- Every displayed image must have a recorded, reviewed source and credit.
-- Note: this metadata only governs images we have individually checked.
create table if not exists public.goodworld_story_images (
 story_id uuid primary key references public.goodworld_stories(id) on delete cascade,
 image_url text not null,
 credit text not null,
 credit_url text not null,
 alt_text text not null,
 rights_basis text not null,
 rights_url text not null,
 reviewed_at timestamptz not null default now(),
 constraint goodworld_story_image_https check(
  image_url ~ '^https://(www\.nasa\.gov/wp-content/uploads/|science\.nasa\.gov/wp-content/uploads/|www\.fisheries\.noaa\.gov/s3/)'
 ),
 constraint goodworld_story_image_source_https check(credit_url ~ '^https://'),
 constraint goodworld_story_image_rights_https check(rights_url ~ '^https://'),
 constraint goodworld_story_image_credit_present check(length(trim(credit))>=3),
 constraint goodworld_story_image_alt_present check(length(trim(alt_text))>=20)
);
alter table public.goodworld_story_images enable row level security;
revoke all on table public.goodworld_story_images from anon,authenticated;
grant select on table public.goodworld_story_images to anon,authenticated;
drop policy if exists "Read checked photo attribution for published stories" on public.goodworld_story_images;
create policy "Read checked photo attribution for published stories"
 on public.goodworld_story_images
 for select to anon,authenticated using (
 exists(
  select 1 from public.goodworld_stories s
  where s.id=story_id and s.status='published'
 )
);
