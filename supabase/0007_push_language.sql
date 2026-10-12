-- heylivo: Push-Nachrichten in der Sprache der App. Jedes Gerät merkt sich beim
-- Einschalten der Erinnerungen die App-Sprache (de, en, …); send-reminders schreibt
-- die Nachricht dann in dieser Sprache. Darf mehrfach ausgeführt werden.

alter table public.push_subscriptions add column if not exists lang text not null default 'de'
  check (char_length(lang) between 2 and 5);

select lang, count(*) as geraete from public.push_subscriptions group by lang;
