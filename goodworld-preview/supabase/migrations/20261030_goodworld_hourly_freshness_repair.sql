-- GoodWorld reliability repair: 2026-10-30.
-- Earlier hourly collector succeeded but publisher rejected 11 consecutive time slots:
-- positive_score >= 23 with a narrow 6h window produced zero eligible entries.
-- This update retains hard safety exclusions and source attribution, broadens
-- positive-result recognition, and allows a 72-hour source backlog.
-- Never backdate GoodWorld published_at or publish invented material.

CREATE OR REPLACE FUNCTION goodworld_private.positive_score(
 p_title text,p_excerpt text,p_source text,p_category text
) RETURNS integer
 LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $function$
select case
 when length(trim(coalesce(p_title,'')))<20 or length(trim(coalesce(p_excerpt,'')))<55 then -100
 when p_category='Science & Health' then -100
 when position('?' in coalesce(p_title,''))>0 then -100
 when lower(coalesce(p_title,'')) ~
 '(^|[^a-z])(dead|died|death|fatal|killed|murder|shooting|attack|war|suicide|cancer|dementia|crisis|fraud|scam|lawsuit|violence|abuse|tragedy|victims|disaster|warning|warns|risk|dangers|threat|politics|election|controversy|injured|injury|outbreak|deforestation|dying|explosion|collapsed|severe|shortage|epidemic|invasive|damaged|decline|conflict|toxic|investigations|illegal|scourge|exploitation|loophole|housefire)([^a-z]|$)' then -100
 when lower(coalesce(p_title,'')) ~
 '(^|[^a-z])(could|might|may|perhaps|possible|potential|suggests|suggest|linked|predicts|prediction|should|opinion|tips|why|how|what|aspirations|hopes|planned|planning|rumors)([^a-z]|$)' then -100
 when lower(coalesce(p_title,'')) ~
 '(cracks? down|you won.t believe|shocking|unbelievable|is it true|doctors warn|scientists warn|falls short|struggl|failing|fails|hinder|not enough|calls for|need to|needs to|fears|faces challenges|never won|joydrops|good news in history|what went right this week|weekly roundup|new podcast|newsletter)' then -100
 else
 (case when p_source in('Good News Network','Good Good Good','Positive News','Reasons to be Cheerful','The Optimist Daily') then 9
       when p_source in('Upworthy','YES! Magazine','Fix The News') then 6 else 3 end)
 +(case when lower(p_title) ~
 '(rescu|sav(ed|es|ing)|reunit|restor|recover|reviv|rebound|protect|conserv|reintroduc|donat|volunteer|fundrais|adopt|planted|reforest|prevent|eliminat|cleans? up|clean-up|breakthrough|achiev|awards?|successful|success|improv|born|birth|surviv|opening|opened|free (meal|health|food)|historic win|pledges?|donated?|delivered|returned|installed|deployed|developed|built|supported|safer|gives?|gifted|pays?|paid|unlocks?|shines a light|first (woman|known|ever)|new.*(tool|method|technology|reserve|park)|help(s|ed)? (farmers|students|scientists|community|families|people|children|wildlife|corals)|discov|uncover|reveals?|invented|inventors?)'
   then 17 else 0 end)
 +(case when lower(p_title) ~ '(scientists?|researchers?|nasa|fossils?|paleontologists?|discov|breakthrough|new (species|technology|method|tool)|first known)' then 7 else 0 end)
 +(case when lower(p_title) ~ '(community|children|family|wildlife|nature|species|animals|ocean|river|forest|solar|renewable|education|school|village|tech|science|birds?|planet|ecosystem|garden|people)' then 4 else 0 end)
 +(case when lower(coalesce(p_excerpt,'')) ~ '(helped|saved|rescued|protected|restored|improved|recovered|raised|donated|success|progress|grew|increased|launched|found|created|delivered|celebrated|deployed|discovered|developed)' then 3 else 0 end)
 -(case when lower(p_title) ~ '(amazing|look!|secret)' then 9 else 0 end)
end
$function$;
revoke all on function goodworld_private.positive_score(text,text,text,text) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION goodworld_private.publish_hourly()
RETURNS jsonb LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare
 v_slot timestamptz:=date_trunc('hour',now() at time zone 'UTC') at time zone 'UTC'-interval '1 hour';
 v_c public.goodworld_candidates%rowtype;
 v_score int;
 v_count int;
 v_story_id uuid;
 v_excerpt text;
 v_summary text;
begin
 insert into public.goodworld_hourly_runs(slot,status)
 values(v_slot,'running') on conflict(slot) do nothing;
 if not found then
  return jsonb_build_object('slot',v_slot,'skipped','already processed');
 end if;

 -- Source articles may be up to 72 hours old, but were only just chosen
 -- for GoodWorld. The original source date remains explicitly attributed.
 select count(*) into v_count
 from public.goodworld_candidates c
 where c.status='pending'
   and c.published_at <= now()+interval '5 minutes'
   and c.published_at >= now()-interval '72 hours'
   and not exists(select 1 from public.goodworld_stories s where s.source_url=c.source_url);

 select c.* into v_c
 from public.goodworld_candidates c
 where c.status='pending'
   and c.published_at <= now()+interval '5 minutes'
   and c.published_at >= now()-interval '72 hours'
   and not exists(select 1 from public.goodworld_stories s where s.source_url=c.source_url)
   and goodworld_private.positive_score(c.original_title,c.original_excerpt,c.source_name,c.category)>=23
   and not exists (
    select 1 from public.goodworld_stories s
    where lower(regexp_replace(s.title,'[^a-z0-9]','','g'))=
          lower(regexp_replace(c.original_title,'[^a-z0-9]','','g'))
   )
 order by
   -- Prefer newly reported events when possible, then editorial positivity.
   case when c.published_at>=now()-interval '24 hours' then 0 else 1 end,
   goodworld_private.positive_score(c.original_title,c.original_excerpt,c.source_name,c.category) desc,
   c.published_at desc
 limit 1;

 if not found then
  update public.goodworld_hourly_runs
  set status='skipped',candidates_considered=v_count,
      reason='No verified positive candidate met safety score or source-recentness rules (72-hour backlog)'
  where slot=v_slot;
  return jsonb_build_object('slot',v_slot,'status','skipped','candidates',v_count);
 end if;

 v_score:=goodworld_private.positive_score(v_c.original_title,v_c.original_excerpt,v_c.source_name,v_c.category);
 v_excerpt:=trim(regexp_replace(left(coalesce(v_c.original_excerpt,''),220),'\s+\S*$',''));
 if length(v_excerpt)<35 then v_excerpt:=left(v_c.original_excerpt,220);end if;
 v_summary:=left(v_c.source_name||' reports: '||v_excerpt||
   (case when right(v_excerpt,1)~'[.!?]' then '' else '…' end),500);

 insert into public.goodworld_stories(
 slug,title,summary,body,category,image_url,source_url,source_name,status,published_at
 ) values(
 'auto-'||replace(v_c.id::text,'-',''),
 left(v_c.original_title,180),
 v_summary,
 'GoodWorld automatically selected this source-linked positive news brief from '||v_c.source_name||
 '. The original report was published on '||to_char(v_c.published_at at time zone 'UTC','YYYY-MM-DD HH24:MI')||
 ' UTC. This is a short attributed excerpt, not independent verification. Please read the original reporting for context.',
 v_c.category,null,v_c.source_url,v_c.source_name,'published',now()
 ) returning id into v_story_id;

 update public.goodworld_candidates set status='published',reviewed_at=now(),published_story_id=v_story_id
 where id=v_c.id and status='pending';

 update public.goodworld_hourly_runs
 set status='published',score=v_score,story_id=v_story_id,
     source_url=v_c.source_url,candidates_considered=v_count,reason=null
 where slot=v_slot;
 return jsonb_build_object('slot',v_slot,'status','published','score',v_score,'source',v_c.source_name,'title',v_c.original_title);
end
$function$;
revoke all on function goodworld_private.publish_hourly() from public,anon,authenticated;
