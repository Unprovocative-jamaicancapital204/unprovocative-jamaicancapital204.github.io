-- heylivo: Rechte für die Server-Rolle (Edge Functions send-reminders und später der
-- Stripe-Webhook). Weil "Automatically expose new tables" aus ist, bekommt auch
-- service_role neue Tabellen nicht automatisch - ohne diese Zeile: "permission denied".
-- Darf mehrfach ausgeführt werden.

grant select, insert, update, delete
  on public.deadlines, public.push_subscriptions, public.plans, public.usage
  to service_role;

select table_name, string_agg(privilege_type, ', ' order by privilege_type) as rechte
from information_schema.role_table_grants
where grantee = 'service_role' and table_schema = 'public'
group by table_name order by table_name;
