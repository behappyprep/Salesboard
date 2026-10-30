-- GoodWorld verified government-source pipeline (2026-10-30).
-- Isolated from the retired media RSS syndication system.
create table if not exists public.goodworld_primary_sources(
 source_key text primary key, name text not null, feed_url text not null unique,
 host text not null, path_re text not null, category text not null,
 license_id text not null, license_url text not null, credit text not null,
 checked_at timestamptz not null default now(), enabled boolean not null default false
);
alter table public.goodworld_primary_sources enable row level security;
revoke all on public.goodworld_primary_sources from anon,authenticated;

create table if not exists public.goodworld_primary_candidates(
 id uuid primary key default gen_random_uuid(),
 source_key text not null references public.goodworld_primary_sources(source_key),
 url text not null unique, title text not null, excerpt text not null,
 source_published_at timestamptz not null, category text not null,
 government_owner_verified boolean not null default false,
 third_party_text_excluded boolean not null default false,
 status text not null default 'pending' check(status in ('pending','published','rejected')),
 story_id uuid references public.goodworld_stories(id) on delete set null,
 collected_at timestamptz not null default now()
);
alter table public.goodworld_primary_candidates enable row level security;
revoke all on public.goodworld_primary_candidates from anon,authenticated;
create index if not exists goodworld_primary_candidates_queue on public.goodworld_primary_candidates(status,source_published_at desc);

create table if not exists public.goodworld_primary_story_licenses(
 story_id uuid primary key references public.goodworld_stories(id) on delete cascade,
 candidate_id uuid unique references public.goodworld_primary_candidates(id) on delete set null,
 source_key text not null references public.goodworld_primary_sources(source_key),
 license_id text not null, license_url text not null, credit text not null,
 source_published_at timestamptz not null,
 content_type text not null check(content_type in('licensed_official_brief','original_editorial')),
 verified_at timestamptz not null default now()
);
alter table public.goodworld_primary_story_licenses enable row level security;
revoke all on public.goodworld_primary_story_licenses from anon,authenticated;

create table if not exists public.goodworld_primary_collection_logs(
 id bigint generated always as identity primary key,
 started_at timestamptz not null default now(),completed_at timestamptz,
 checked int not null default 0,added int not null default 0,
 errors int not null default 0,notes text
);
alter table public.goodworld_primary_collection_logs enable row level security;
revoke all on public.goodworld_primary_collection_logs from anon,authenticated;

create table if not exists public.goodworld_primary_publish_logs(
 slot timestamptz primary key,status text not null,story_id uuid references public.goodworld_stories(id) on delete set null,
 eligible_count int not null default 0,notes text,checked_at timestamptz not null default now()
);
alter table public.goodworld_primary_publish_logs enable row level security;
revoke all on public.goodworld_primary_publish_logs from anon,authenticated;

insert into public.goodworld_primary_sources(source_key,name,feed_url,host,path_re,category,license_id,license_url,credit,enabled)
values
('nasa-news','NASA','https://www.nasa.gov/news-release/feed/','www.nasa.gov',
 '^/(news-release|blogs/spacestation)/','Innovation','US-GOV-PD','https://www.nasa.gov/nasa-brand-center/images-and-media/',
 'NASA official information, U.S. public domain where agency-owned. NASA does not endorse GoodWorld.',true),
('nasa-tech','NASA','https://www.nasa.gov/technology/feed/','www.nasa.gov',
 '^/(news-release|technology|blogs/spacestation)/','Innovation','US-GOV-PD','https://www.nasa.gov/nasa-brand-center/images-and-media/',
 'NASA official information, U.S. public domain where agency-owned. NASA does not endorse GoodWorld.',true),
('noaa-news','NOAA','https://www.noaa.gov/rss.xml','www.noaa.gov',
 '^/(news-release|news)/','Nature & Planet','US-GOV-PD','https://oceanservice.noaa.gov/about/faq.html',
 'NOAA official information, U.S. public domain where agency-owned. NOAA does not endorse GoodWorld.',true),
('uk-defra','UK Department for Environment, Food & Rural Affairs',
'https://www.gov.uk/government/organisations/department-for-environment-food-rural-affairs.atom',
'www.gov.uk','^/government/news/','Nature & Planet','OGL-3.0',
'https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/',
'Contains public sector information licensed under the Open Government Licence v3.0; adapted by GoodWorld.',true)
on conflict(source_key) do update set enabled=excluded.enabled,checked_at=now(),
 feed_url=excluded.feed_url,host=excluded.host,path_re=excluded.path_re,category=excluded.category,
 license_id=excluded.license_id,license_url=excluded.license_url,credit=excluded.credit;

create or replace function goodworld_private.publish_primary_hourly()
returns jsonb language plpgsql set search_path to ''
as $function$
declare
 v_slot timestamptz := date_trunc('hour',now())-interval '1 hour';
 v record;
 v_story uuid;
 v_total int;
 v_date text;
 v_excerpt text;
 v_body text;
begin
 if exists(select 1 from public.goodworld_primary_publish_logs where slot=v_slot) then
  return jsonb_build_object('status','already_processed','slot',v_slot);
 end if;
 select count(*) into v_total
 from public.goodworld_primary_candidates c
 join public.goodworld_primary_sources p on p.source_key=c.source_key
 where p.enabled and c.status='pending' and c.government_owner_verified and c.third_party_text_excluded
 and c.source_published_at between now()-interval '120 hours' and now()+interval '5 minutes';
 select c.*,p.name,p.license_id,p.license_url,p.credit
 into v
 from public.goodworld_primary_candidates c
 join public.goodworld_primary_sources p on p.source_key=c.source_key
 where p.enabled and c.status='pending' and c.government_owner_verified and c.third_party_text_excluded
 and c.source_published_at between now()-interval '120 hours' and now()+interval '5 minutes'
 and length(c.title) between 28 and 165 and length(c.excerpt)>=85
 and lower(c.title) ~ '(install|complet|success|restore|protect|conserv|discover|reveal|launch|build|built|opened|deliver|fund|award|power|extend|improv|recover|rescu|save|new|expand|boost|spacewalk|voyager|green|habitat|oyster|forest|solar|satellite|technology|research)'
 and lower(c.title) !~ '(dead|death|died|fatal|war|weapon|shoot|kill|crime|fraud|lawsuit|disease|cancer|virus|vaccine|disaster|storm|flood|quake|typhoon|cyclone|threat|violence|election|politic|president|opinion|podcast|newsletter|protest|controversy|injur|gun|terror)'
 and lower(c.title) !~ '(may |might |could |suggest|hope |should |plan to |prepare to |set to |aims to )'
 and lower(c.excerpt) !~ '(copyright|all rights reserved|getty|reuters|associated press|ap photo|shutterstock|guest author|contributed by|third.party)'
 and not exists(select 1 from public.goodworld_stories s where s.source_url=c.url)
 order by c.source_published_at desc,c.collected_at desc
 limit 1;
 if not found then
  insert into public.goodworld_primary_publish_logs(slot,status,eligible_count,notes)
  values(v_slot,'skipped',v_total,'No sufficiently positive, licensed official update met all rules');
  return jsonb_build_object('status','skipped','slot',v_slot,'considered',v_total);
 end if;
 v_date:=to_char(v.source_published_at at time zone 'UTC','Mon DD, YYYY');
 v_excerpt:=trim(regexp_replace(left(v.excerpt,260),'\s+\S*$',''));
 if length(v_excerpt)<85 then v_excerpt:=left(v.excerpt,260);end if;
 v_body:='GoodWorld is sharing a sourced government announcement published by '||v.name||' on '||v_date||
 '. The following short passage is from the official source and is used with attribution under '||v.license_id||
 ': '||v_excerpt||'. This is a licensed primary-source news brief, not independent GoodWorld reporting. '||
 v.credit||' Read the original release for the full context. Reuse terms: '||v.license_url;
 insert into public.goodworld_stories(slug,title,summary,body,category,image_url,source_url,source_name,status,published_at)
 values('gov-'||replace(v.id::text,'-',''),left(v.title,165),
 'Official '||v.name||' update ('||v_date||'): '||v_excerpt,
 v_body,v.category,null,v.url,v.name,'published',now())
 returning id into v_story;
 insert into public.goodworld_primary_story_licenses(story_id,candidate_id,source_key,license_id,license_url,credit,source_published_at,content_type)
 values(v_story,v.id,v.source_key,v.license_id,v.license_url,v.credit,v.source_published_at,'licensed_official_brief');
 update public.goodworld_primary_candidates set status='published',story_id=v_story where id=v.id;
 insert into public.goodworld_primary_publish_logs(slot,status,story_id,eligible_count)
 values(v_slot,'published',v_story,v_total);
 return jsonb_build_object('status','published','story_id',v_story,'title',v.title,'source',v.name,'slot',v_slot);
end
$function$;
revoke all on function goodworld_private.publish_primary_hourly() from public,anon,authenticated;
