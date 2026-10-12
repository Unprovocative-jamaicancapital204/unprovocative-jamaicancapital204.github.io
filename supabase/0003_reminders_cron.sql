-- heylivo: jeden Morgen um 6:00 UTC (7:00/8:00 Uhr deutscher Zeit) die Edge Function
-- send-reminders aufrufen. Der Aufruf trägt das Geheimnis CRON_SECRET aus dem Vault,
-- damit niemand von außen Erinnerungen auslösen kann.
-- <CRON_SECRET> durch denselben Wert ersetzen, der als Function-Secret CRON_SECRET gesetzt ist
-- (der echte Wert steht nie im Repo). Darf mehrfach ausgeführt werden.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'livo_cron_secret') then
    perform vault.create_secret('<CRON_SECRET>', 'livo_cron_secret');
  end if;
end $$;

-- cron.schedule mit einem vorhandenen Namen ersetzt den Job
select cron.schedule(
  'livo-reminders',
  '0 6 * * *',
  $job$
  select net.http_post(
    url := 'https://fkhngrvqxlpqxpllrnoj.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_Ya83flK2efxCxi1WecSCwA_wbC_njXD',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'livo_cron_secret')
    ),
    body := '{"action":"run"}'::jsonb
  ) as request_id;
  $job$
);

-- Kontrolle: der Job und ob das Geheimnis im Vault liegt
select jobname, schedule, active,
       (select count(*) from vault.secrets where name = 'livo_cron_secret') as geheimnis_im_vault
from cron.job where jobname = 'livo-reminders';
