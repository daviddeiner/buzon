-- Sustituye CAMBIA_ESTE_SECRETO por el mismo secreto largo y aleatorio de Edge Functions.
-- No guardes este archivo con el secreto real en GitHub.
do $$
declare s text := 'CAMBIA_ESTE_SECRETO'; sid uuid;
begin
 if s='CAMBIA_ESTE_SECRETO' or length(s)<32 then raise exception 'Configura un secreto aleatorio de al menos 32 caracteres'; end if;
 select id into sid from vault.secrets where name='buzon_cron_secret' limit 1;
 if sid is null then perform vault.create_secret(s,'buzon_cron_secret'); else perform vault.update_secret(sid,s); end if;
end $$;
select cron.schedule('cupissa-buzon-programados','* * * * *', $job$
 select net.http_post(url:='https://lkdxtesgwqoizobxaawp.supabase.co/functions/v1/cupissa-buzon',headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrZHh0ZXNnd3FvaXpvYnhhYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwODMxNjIsImV4cCI6MjEwNzY1OTE2Mn0.rDQ8n8O6I9uHY6z4goQCTFfRjE8zExkifIRWFbBLycE','apikey',eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrZHh0ZXNnd3FvaXpvYnhhYXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwODMxNjIsImV4cCI6MjEwNzY1OTE2Mn0.rDQ8n8O6I9uHY6z4goQCTFfRjE8zExkifIRWFbBLycE','x-buzon-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='buzon_cron_secret' limit 1)),body:='{"action":"run_scheduled"}'::jsonb,timeout_milliseconds:=30000);
$job$);
