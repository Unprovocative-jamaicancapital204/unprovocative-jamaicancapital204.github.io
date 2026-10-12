-- heylivo: 30 Tage Testphase ab der ersten gespeicherten Frist, danach nur mit Livo Plus.
-- Nach dem Test ohne Plus: Fristen ansehen und löschen ja, neu anlegen und ändern nein.
-- Ersetzt die Regel "5 Fristen gratis". Darf mehrfach ausgeführt werden.

-- Pro Nutzer: Beginn der Testphase und wie viele Fristen je angelegt wurden.
-- Nur die Datenbank schreibt hier, Nutzer dürfen ihre eigene Zeile nur lesen.
create table if not exists public.usage (
  user_id uuid primary key references auth.users (id) on delete cascade,
  deadlines_created int not null default 0
);
alter table public.usage add column if not exists trial_started date;
alter table public.usage enable row level security;
drop policy if exists "read own usage" on public.usage;
create policy "read own usage" on public.usage for select to authenticated
  using (user_id = (select auth.uid()));
grant select on public.usage to authenticated;

-- Wer schon Fristen hat, startet seine Testphase heute
insert into public.usage (user_id, deadlines_created, trial_started)
select user_id, count(*), current_date from public.deadlines group by user_id
on conflict (user_id) do update set trial_started = coalesce(public.usage.trial_started, current_date);

-- Alte Regel (höchstens 5 Fristen) entfernen
drop trigger if exists deadlines_free_limit on public.deadlines;
drop function if exists public.enforce_free_limit();

-- Vor jedem Anlegen oder Ändern: Testphase oder Livo Plus nötig.
-- Beim ersten Anlegen startet die Testphase. Ohne Nutzer (Erinnerungs-Job, SQL-Editor) keine Prüfung.
create or replace function public.livo_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  started date;
begin
  if uid is null then return new; end if;
  select trial_started into started from public.usage where user_id = uid;
  if started is not null and started + 30 < current_date
     and not exists (select 1 from public.plans where user_id = uid and plus_until >= current_date) then
    raise exception 'trial_over' using hint = 'Die 30 Tage Testphase sind vorbei – weiter mit Livo Plus.';
  end if;
  if tg_op = 'INSERT' then
    insert into public.usage (user_id, deadlines_created, trial_started) values (uid, 1, current_date)
    on conflict (user_id) do update set
      deadlines_created = public.usage.deadlines_created + 1,
      trial_started = coalesce(public.usage.trial_started, current_date);
  end if;
  return new;
end $$;
drop trigger if exists deadlines_guard on public.deadlines;
create trigger deadlines_guard before insert or update on public.deadlines
  for each row execute function public.livo_guard();

-- Selbsttest mit einem vorhandenen Nutzer. Alles wird danach zurückgenommen.
create temp table if not exists livo_test (pruefung text, ergebnis text);
truncate livo_test;
do $$
declare u uuid;
begin
  select id into u from auth.users limit 1;
  if u is null then insert into livo_test values ('Testnutzer', 'keiner vorhanden'); return; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  begin
    insert into public.usage (user_id, deadlines_created, trial_started) values (u, 1, current_date - 5)
      on conflict (user_id) do update set trial_started = current_date - 5;
    insert into public.deadlines (user_id, title, due) values (u, 'Selbsttest', current_date);
    raise exception 'ok_rollback';
  exception when others then
    insert into livo_test values ('Tag 5 der Testphase: neue Frist',
      case when sqlerrm = 'ok_rollback' then 'klappt ✓' else 'FEHLER: ' || sqlerrm end);
  end;
  begin
    insert into public.usage (user_id, deadlines_created, trial_started) values (u, 1, current_date - 40)
      on conflict (user_id) do update set trial_started = current_date - 40;
    insert into public.deadlines (user_id, title, due) values (u, 'Selbsttest', current_date);
    raise exception 'not_blocked';
  exception when others then
    insert into livo_test values ('Tag 40, ohne Plus: neue Frist',
      case when sqlerrm = 'trial_over' then 'blockiert ✓' else 'FEHLER: ' || sqlerrm end);
  end;
end $$;
select * from livo_test;
