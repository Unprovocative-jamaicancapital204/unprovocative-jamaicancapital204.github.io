-- heylivo: Livo Plus wird über einen Stripe-Zahlungslink gekauft (1 Jahr, ohne
-- automatische Verlängerung). Der Stripe-Webhook (Edge Function stripe-webhook) schreibt
-- hier, welche Zahlung zuletzt verbucht wurde (gegen doppelte Zustellung) und die
-- E-Mail aus dem Kauf (damit Plus später wiederhergestellt werden kann).
-- Darf mehrfach ausgeführt werden.

alter table public.plans add column if not exists stripe_session_id text;
alter table public.plans add column if not exists email text;
alter table public.plans add column if not exists updated_at timestamptz not null default now();

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'plans' order by ordinal_position;
