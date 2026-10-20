-- GoodWorld: persistent story catalog and one-like-per-account voting.
-- Intended for Supabase free project. Apply once in its SQL editor/connector.
-- Deliberately does not grant browser clients permission to publish stories.
create extension if not exists pgcrypto;

create table if not exists public.goodworld_stories (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique,
 title text not null check (char_length(title) between 10 and 180),
 summary text not null check (char_length(summary) between 20 and 500),
 category text not null,
 image_url text,
 source_url text not null,
 source_name text not null,
 body text not null default '',
 status text not null default 'draft' check (status in ('draft','published')),
 published_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public.goodworld_likes (
 story_id uuid not null references public.goodworld_stories(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (story_id, user_id)
);

create index if not exists goodworld_stories_public_idx
 on public.goodworld_stories (status, published_at desc);
create index if not exists goodworld_likes_day_idx
 on public.goodworld_likes (created_at desc, story_id);

alter table public.goodworld_stories enable row level security;
alter table public.goodworld_likes enable row level security;

-- Public can read published stories only. No public write policies.
drop policy if exists "read published goodworld stories" on public.goodworld_stories;
create policy "read published goodworld stories" on public.goodworld_stories
 for select to anon,authenticated using (status = 'published');

-- Users cannot access other people's raw like rows.
drop policy if exists "read own goodworld likes" on public.goodworld_likes;
create policy "read own goodworld likes" on public.goodworld_likes
 for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "insert own goodworld likes" on public.goodworld_likes;
create policy "insert own goodworld likes" on public.goodworld_likes
 for insert to authenticated with check (
   (select auth.uid()) = user_id and
   exists(select 1 from public.goodworld_stories s where s.id = story_id and s.status = 'published')
 );

drop policy if exists "delete own goodworld likes" on public.goodworld_likes;
create policy "delete own goodworld likes" on public.goodworld_likes
 for delete to authenticated using ((select auth.uid()) = user_id);

-- SECURITY DEFINER is needed to expose only aggregate counts,
-- not every user's raw voting history.
create or replace function public.get_goodworld_feed(p_order text default 'top')
returns table (
 id uuid, slug text, title text, summary text, category text,
 image_url text, source_url text, source_name text, body text,
 published_at timestamptz, likes_today bigint, likes_total bigint,
 liked_by_me boolean
)
language sql stable security definer set search_path = ''
as $$
 select s.id, s.slug, s.title, s.summary, s.category,
        s.image_url, s.source_url, s.source_name, s.body,
        s.published_at,
        count(l.story_id) filter (
          where l.created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
        )::bigint as likes_today,
        count(l.story_id)::bigint as likes_total,
        coalesce(bool_or(l.user_id = auth.uid()), false) as liked_by_me
 from public.goodworld_stories s
 left join public.goodworld_likes l on l.story_id = s.id
 where s.status = 'published'
 group by s.id
 order by
  case when p_order = 'top' then
   count(l.story_id) filter (
    where l.created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')
   )
  end desc nulls last,
  s.published_at desc nulls last
 limit 60;
$$;

revoke all on function public.get_goodworld_feed(text) from public;
grant execute on function public.get_goodworld_feed(text) to anon,authenticated;

-- Toggle as separate insert/delete operations with RLS from authenticated clients.
-- A single user has at most one like per story (enforced by composite PK).
-- App-level rate limiting and verified email policy should be added before public launch.
