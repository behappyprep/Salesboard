-- GoodWorld copyright review 2026-10-30. Intentional pause of unlicensed feeds.
-- Collector v5 is inert; all earlier feeds were removed from live source code.
-- Publishing is disabled server-side even if a scheduled/manual call occurs.
select cron.alter_job(job_id := 2, active := false);
select cron.alter_job(job_id := 3, active := false);

create or replace function goodworld_private.publish_hourly()
returns jsonb language sql set search_path to ''
as $function$
 select jsonb_build_object(
  'disabled',true,
  'reason','All inherited RSS sources require individual license and article rights verification before publication'
 );
$function$;
revoke all on function goodworld_private.publish_hourly() from public,anon,authenticated;
-- The separate daily SEO sitemap rebuild remains enabled as it generates no new news.
