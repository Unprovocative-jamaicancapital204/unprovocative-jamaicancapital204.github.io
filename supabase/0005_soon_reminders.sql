-- heylivo: Erinnerung kurz vor einem Termin mit Uhrzeit (z. B. 15 Minuten vorher).
-- remind_min = so viele Minuten vor due + due_time (leer = keine), tz = Zeitzone des
-- Geräts beim Speichern, time_notified_for = "JJJJ-MM-TT HH:MM", für den schon erinnert wurde.
-- Dazu ein zweiter Cron-Job, der jede Minute send-reminders mit action "soon" aufruft.
-- Darf mehrfach ausgeführt werden. Das Geheimnis kommt aus dem Vault (siehe 0003).

alter table public.deadlines add column if not exists remind_min int check (remind_min between 1 and 1440);
alter table public.deadlines add column if not exists tz text not null default 'Europe/Berlin' check (char_length(tz) <= 64);
alter table public.deadlines add column if not exists time_notified_for text;

select cron.schedule(
  'livo-soon',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://fkhngrvqxlpqxpllrnoj.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'sb_publishable_Ya83flK2efxCxi1WecSCwA_wbC_njXD',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'livo_cron_secret')
    ),
    body := '{"action":"soon"}'::jsonb
  ) as request_id;
  $job$
);

select jobname, schedule, active from cron.job where jobname in ('livo-reminders', 'livo-soon') order by jobname;
