-- The old unlicensed RSS cron jobs remain intentionally DISABLED.
select cron.alter_job(job_id := 2,active := false);
select cron.alter_job(job_id := 3,active := false);
select cron.schedule('goodworld-primary-collector-hourly','5 * * * *',
$$select net.http_post(
 url:='https://jdmpmrhyjitmjyjuhtds.supabase.co/functions/v1/goodworld-primary-collector',
 headers:=jsonb_build_object('Content-Type','application/json',
  'apikey',(select decrypted_secret from vault.decrypted_secrets where name='goodworld_scheduled_anon_jwt'),
  'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='goodworld_scheduled_anon_jwt')),
 body:='{}'::jsonb,timeout_milliseconds:=60000
)$$);
select cron.schedule('goodworld-primary-publish-hourly','15 * * * *',
$$select goodworld_private.publish_primary_hourly();$$);
