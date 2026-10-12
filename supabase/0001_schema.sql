-- heylivo: Fristen, Push-Abos und Tarif.
-- Darf mehrfach ausgeführt werden. Jeder Nutzer (auch ohne Anmeldung = anonym)
-- sieht und ändert nur seine eigenen Zeilen.

create table if not exists public.deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tpl text not null default 'eigene',
  title text not null check (char_length(title) between 1 and 120),
  due date not null,
  due_time time,
  every_months int not null default 0 check (every_months between 0 and 240),
  from_done boolean not null default false,
  lead_days int not null default 14 check (lead_days between 0 and 365),
  renew boolean not null default false,
  notified_for date,
  created_at timestamptz not null default now()
);
create index if not exists deadlines_user_idx on public.deadlines (user_id);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

-- Livo Plus: wird später nur vom Stripe-Webhook (Service-Rolle) geschrieben
create table if not exists public.plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  plus_until date
);

alter table public.deadlines enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.plans enable row level security;

drop policy if exists "own deadlines" on public.deadlines;
create policy "own deadlines" on public.deadlines for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "read own plan" on public.plans;
create policy "read own plan" on public.plans for select to authenticated
  using (user_id = (select auth.uid()));

-- "Automatically expose new tables" ist aus, deshalb die Rechte ausdrücklich
grant select, insert, update, delete on public.deadlines to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select on public.plans to authenticated;

-- Gratis: höchstens 5 Fristen, mit Livo Plus unbegrenzt
create or replace function public.enforce_free_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.deadlines where user_id = new.user_id) >= 5
     and not exists (select 1 from public.plans where user_id = new.user_id and plus_until >= current_date) then
    raise exception 'free_limit' using hint = 'Gratis sind bis zu 5 Fristen möglich.';
  end if;
  return new;
end $$;
drop trigger if exists deadlines_free_limit on public.deadlines;
create trigger deadlines_free_limit before insert on public.deadlines
  for each row execute function public.enforce_free_limit();

-- Kontrolle: drei Zeilen mit je 0 = alles angelegt
select 'deadlines' as tabelle, count(*) as anzahl from public.deadlines
union all select 'push_subscriptions', count(*) from public.push_subscriptions
union all select 'plans', count(*) from public.plans;
