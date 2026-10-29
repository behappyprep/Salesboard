-- GoodWorld hourly positive-news automation.
-- Snapshot of production Postgres functions created on 2026-10-29.
-- Requires the RSS collector Edge Function and existing Vault secret
-- goodworld_scheduled_anon_jwt. Never commit actual tokens.
-- Idempotent when applied on the intended GoodWorld Supabase project.

create schema if not exists goodworld_private;
revoke all on schema goodworld_private from public, anon, authenticated;

create table if not exists public.goodworld_hourly_runs (
 slot timestamptz primary key,
 checked_at timestamptz not null default now(),
 status text not null default 'running' check (status in ('running','published','skipped')),
 candidates_considered integer not null default 0,
 score integer,
 source_url text,
 story_id uuid references public.goodworld_stories(id),
 reason text
);
alter table public.goodworld_hourly_runs enable row level security;
revoke all on public.goodworld_hourly_runs from public, anon, authenticated;

CREATE OR REPLACE FUNCTION goodworld_private.positive_score(p_title text, p_excerpt text, p_source text, p_category text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
select case
 when length(trim(coalesce(p_title,''))) < 20 or length(trim(coalesce(p_excerpt,''))) < 55 then -100
 when p_category='Science & Health' then -100
 when lower(p_title) ~ '(^|[^a-z])(dead|died|death|fatal|killed|murder|shooting|attack|war|suicide|cancer|dementia|crisis|fraud|scam|lawsuit|violence|abuse|tragedy|victims|disaster|warning|warns|risk|dangers|threat|politics|election|controversy)([^a-z]|$)' then -100
 when lower(p_title) ~ '(^|[^a-z])(could|might|may|perhaps|possible|potential|suggests|linked|predicts|prediction|should|opinion|tips|why|how|what|aspirations|hopes|planned|planning|rumors)([^a-z]|$)' then -100
 when lower(p_title) ~ '(cracks? down|you won.t believe|shocking|unbelievable|is it true|doctors warn|scientists warn)' then -100
 else
  (case when p_source in ('Good News Network','Good Good Good','Positive News','Reasons to be Cheerful','The Optimist Daily') then 9
        when p_source in ('Upworthy','YES! Magazine') then 6
        else 3 end)
  +(case when lower(p_title) ~ '(rescu|sav(ed|es|ing)|reunit|restor|recover|reviv|rebound|protect|conserv|reintroduc|donat|volunteer|fundrais|adopt|planted|reforest|prevent|eliminat|cleans? up|clean-up|breakthrough|achiev|award|successful|success|improv|endangered.*increas|born|birth|surviv|opening|opened|free (meal|health|food)|record.*(good|high))' then 15 else 0 end)
  +(case when lower(p_title) ~ '(people|community|children|family|wildlife|nature|species|animals|ocean|river|forest|solar|renewable|health|education|school)' then 4 else 0 end)
  +(case when lower(p_excerpt) ~ '(helped|saved|rescued|protected|restored|improved|recovered|raised|donated|success|progress|grew|increased)' then 3 else 0 end)
  -(case when lower(p_title) ~ '(amazing|look!|secret)' then 9 else 0 end)
end
$function$

revoke all on function goodworld_private.positive_score(text,text,text,text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION goodworld_private.publish_hourly()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v_slot timestamptz := date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC' - interval '1 hour';
 v_c public.goodworld_candidates%rowtype;
 v_score int;
 v_count int;
 v_story_id uuid;
 v_excerpt text;
 v_summary text;
begin
 insert into public.goodworld_hourly_runs(slot,status)
 values(v_slot,'running') on conflict (slot) do nothing;
 if not found then
   return jsonb_build_object('slot',v_slot,'skipped','already processed');
 end if;

 select count(*) into v_count
 from public.goodworld_candidates c
 where c.status='pending'
   and c.published_at >= v_slot - interval '5 hours' and c.published_at < v_slot + interval '1 hour'
   and not exists(select 1 from public.goodworld_stories s where s.source_url=c.source_url);

 select c.* into v_c
 from public.goodworld_candidates c
 where c.status='pending'
   and c.published_at >= v_slot - interval '5 hours' and c.published_at < v_slot + interval '1 hour'
   and not exists(select 1 from public.goodworld_stories s where s.source_url=c.source_url)
   and goodworld_private.positive_score(c.original_title,c.original_excerpt,c.source_name,c.category)>=23
 order by goodworld_private.positive_score(c.original_title,c.original_excerpt,c.source_name,c.category) desc,
          c.published_at desc
 limit 1;

 if not found then
   update public.goodworld_hourly_runs set status='skipped',candidates_considered=v_count,
      reason='No sufficiently positive, previously unpublished source found in the preceding six-hour freshness window'
   where slot=v_slot;
   return jsonb_build_object('slot',v_slot,'status','skipped','candidates',v_count);
 end if;
 v_score:=goodworld_private.positive_score(v_c.original_title,v_c.original_excerpt,v_c.source_name,v_c.category);

 v_excerpt:=trim(regexp_replace(left(coalesce(v_c.original_excerpt,''),220),'\s+\S*$',''));
 if length(v_excerpt)<35 then v_excerpt:=left(v_c.original_excerpt,220);end if;
 v_summary:=left(v_c.source_name||' reports: '||v_excerpt||
    (case when right(v_excerpt,1) ~ '[.!?]' then '' else '…' end),500);

 insert into public.goodworld_stories(
 slug,title,summary,body,category,image_url,source_url,source_name,status,published_at
 ) values (
 'auto-'||replace(v_c.id::text,'-',''),
 left(v_c.original_title,180),
 v_summary,
 'GoodWorld automatically selected this positive news brief from '||v_c.source_name||
 '. Its source article was published on '||to_char(v_c.published_at at time zone 'UTC','YYYY-MM-DD HH24:MI')||
 ' UTC. We show a short attributed excerpt only. Please follow the original source link for details and context.',
 v_c.category,null,v_c.source_url,v_c.source_name,'published',now()
 ) returning id into v_story_id;

 update public.goodworld_candidates set status='published',reviewed_at=now(),published_story_id=v_story_id
 where id=v_c.id and status='pending';

 update public.goodworld_hourly_runs set status='published',score=v_score,story_id=v_story_id,
 source_url=v_c.source_url,candidates_considered=v_count where slot=v_slot;
 return jsonb_build_object('slot',v_slot,'status','published','score',v_score,'title',v_c.original_title,'source',v_c.source_name);
end
$function$

revoke all on function goodworld_private.publish_hourly() from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_goodworld_collection_hourly()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_slot timestamptz:=date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC';
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 insert into public.goodworld_collection_runs(slot) values(v_slot) on conflict do nothing;
 return found;
end
$function$

revoke all on function public.claim_goodworld_collection_hourly() from public, anon, authenticated;
grant execute on function public.claim_goodworld_collection_hourly() to service_role;

CREATE OR REPLACE FUNCTION public.finish_goodworld_collection_hourly(p_added integer, p_errors integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_slot timestamptz:=date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC';
begin
 if (select auth.jwt()->>'role') is distinct from 'service_role' then
  raise exception 'Service role required' using errcode='42501';
 end if;
 update public.goodworld_collection_runs set finished_at=now(),
  added_count=greatest(0,least(10000,coalesce(p_added,0))),
  error_count=greatest(0,least(1000,coalesce(p_errors,0)))
 where slot=v_slot;
end
$function$

revoke all on function public.finish_goodworld_collection_hourly(integer,integer) from public, anon, authenticated;
grant execute on function public.finish_goodworld_collection_hourly(integer,integer) to service_role;
-- Operational jobs use UTC.
select cron.schedule(
 'goodworld-rss-discovery-hourly','5 * * * *',
 $$ select net.http_post(
  url := 'https://jdmpmrhyjitmjyjuhtds.supabase.co/functions/v1/goodworld-news-collector',
  headers := jsonb_build_object(
   'Content-Type','application/json',
   'apikey',(select decrypted_secret from vault.decrypted_secrets where name='goodworld_scheduled_anon_jwt'),
   'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='goodworld_scheduled_anon_jwt')
  ),
  body := '{}'::jsonb,timeout_milliseconds:=60000
 ) as request_id; $$
);
select cron.schedule('goodworld-hourly-positive-news','15 * * * *',
 'select goodworld_private.publish_hourly();');
