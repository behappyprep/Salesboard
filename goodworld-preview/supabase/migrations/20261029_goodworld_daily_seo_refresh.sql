-- GoodWorld nightly SEO static rebuild, prepared 2026-10-29.
-- Source: Supabase cron; destination: the existing GoodWorld Render static site.
-- The secret deploy-hook URL must be stored privately in Supabase Vault by owner.
-- IMPORTANT: Never write actual deploy hook URLs into source code, SQL commits, or chat.
--
-- To enable, in Render Settings copy the unmodified Deploy Hook URL, and save
-- to Supabase Vault under the exact name goodworld_render_deploy_hook.
-- Until the secret exists, the scheduled job does nothing (not an error).
--
-- UTC 03:30 daily (04:30 Bratislava winter, 05:30 summer).

select cron.schedule(
 'goodworld-seo-refresh-daily',
 '30 3 * * *',
 $sql$
   select net.http_post(
     url := (select decrypted_secret from vault.decrypted_secrets
              where name='goodworld_render_deploy_hook' limit 1),
     headers := '{"Content-Type":"application/json"}'::jsonb,
     body := '{}'::jsonb,
     timeout_milliseconds := 10000
   ) as request_id
   where exists (
      select 1 from vault.decrypted_secrets
      where name='goodworld_render_deploy_hook'
        and decrypted_secret like 'https://api.render.com/deploy/srv-dbbtbitpkucs73eel9u0?key=%'
        and decrypted_secret not like '%&ref=%'
   );
 $sql$
);

-- Verification (does not reveal the hook URL):
-- select jobname, schedule, active from cron.job where jobname='goodworld-seo-refresh-daily';
-- select exists(select 1 from vault.secrets where name='goodworld_render_deploy_hook') as has_hook;
-- select j.jobname,r.start_time,r.status,r.return_message from cron.job_run_details r
-- join cron.job j on j.jobid=r.jobid where j.jobname='goodworld-seo-refresh-daily'
-- order by r.start_time desc limit 8;
-- Confirm success from Render service deploy logs and latest generated Sitemap.
