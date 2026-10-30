-- Strict outcome-based guard on open-government hourly publishing.
-- Prevents staffing updates, previews, speculative posts, and thin content.
CREATE OR REPLACE FUNCTION goodworld_private.publish_primary_hourly()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
 and lower(c.title) ~ '(installed|complet|successful|restored|rescued|saved|discovered|launched|built|delivered|extended|improved|recovered|protects|protected|conserves|conserved|deployed|solar array|power saving|reaches|opened|boosted|expanded|funded|oyster reef|new habitat|breakthrough|achieves|first ever)'
 and lower(c.title) !~ '(dead|death|died|fatal|war|weapon|shoot|kill|crime|fraud|lawsuit|disease|cancer|virus|vaccine|disaster|storm|flood|quake|typhoon|cyclone|threat|violence|election|politic|president|opinion|podcast|newsletter|protest|controversy|injur|gun|terror)'
 and lower(c.title) !~ '(may |might |could |suggest|hope |should |plan to |prepare to |set to |aims to |names |named |appoint|director|administrator|announces|invites|begins|begin |starts |prep|briefing|meeting|scheduled|will |potential|future |preview|upcoming|how to |what |why |opinion|campaign|target|expected|proposes|seeks |call for|recruit)'
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
$function$
;
revoke all on function goodworld_private.publish_primary_hourly() from public,anon,authenticated;
