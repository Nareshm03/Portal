-- Portal live-database inspection (READ-ONLY).
-- Safe to run in the Supabase SQL Editor. Contains ONLY SELECT / catalog reads.
-- No INSERT/UPDATE/DELETE/DDL. Run this BEFORE applying any migration.
-- Expected project ref: cnlramgfxqaxdcegggmj

-- ==== 0. Connection identity ====
select current_database() as database_name,
       current_schema()   as current_schema,
       current_user        as database_user;

-- ==== 1. All public tables ====
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- ==== 2. Expected Portal tables (PRESENT / MISSING) ====
select t.tbl as table_name, coalesce(to_regclass('public.'||t.tbl)::text,'MISSING') as status
from (values
  ('profiles'),('trips'),('requests'),('quotes'),('orders'),('payment_intents'),
  ('ledger_transactions'),('ledger_entries'),('order_events'),('webhook_events'),
  ('otp_challenges'),('audit_logs'),
  ('conversations'),('conversation_messages'),('conversation_read_states'),('order_evidence')
) as t(tbl)
order by t.tbl;

-- ==== 3. Expected enum types ====
select t.typ as type_name,
       case when exists (select 1 from pg_type where typname=t.typ and typnamespace='public'::regnamespace)
            then 'PRESENT' else 'MISSING' end as status
from (values
  ('portal_role'),('account_status'),('kyc_status'),('compliance_status'),('order_state'),('payment_status')
) as t(typ)
order by t.typ;

-- ==== 4. Expected functions ====
select t.fn as function_name,
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where n.nspname='public' and p.proname=t.fn) then 'PRESENT' else 'MISSING' end as status
from (values
  ('handle_new_user'),('enforce_payment_intent_order_binding'),('set_updated_at'),('reject_mutation'),
  ('protect_profile_privileges'),('provision_profile_role'),('review_traveller_kyc'),('transition_order'),
  ('post_ledger_transaction'),('accept_quote'),
  ('enforce_conversation_participants'),('enforce_message_sender_participant'),('set_conversation_read_state_updated_at')
) as t(fn)
order by t.fn;

-- ==== 5a. Columns for core tables ====
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema='public'
  and table_name in ('profiles','trips','requests','quotes','orders','payment_intents')
order by table_name, ordinal_position;

-- ==== 5b. Constraints for core tables ====
select conrelid::regclass as table_name, conname as constraint_name, contype as type, pg_get_constraintdef(oid) as definition
from pg_constraint
where connamespace='public'::regnamespace
  and conrelid in ('profiles'::regclass,'trips'::regclass,'requests'::regclass,'quotes'::regclass,'orders'::regclass,'payment_intents'::regclass)
order by conrelid::regclass::text, conname;

-- ==== 6. RLS status (enabled / forced) for all public tables ====
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;

-- ==== 7. RLS policies ====
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname='public'
order by tablename, policyname;

-- ==== 8. Table grants (anon / authenticated / service_role / PUBLIC) ====
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema='public'
  and grantee in ('anon','authenticated','service_role','PUBLIC')
group by table_name, grantee
order by table_name, grantee;

-- ==== 9. Function execution grants ====
select p.proname as function_name,
       (aclexplode(p.proacl)).grantee::regrole::text as grantee,
       (aclexplode(p.proacl)).privilege_type as privilege
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proacl is not null
order by p.proname, grantee;

-- ==== 10. Storage buckets ====
select id, name, public, versioned from storage.buckets order by id;

-- ==== 11. Migration history (only if Supabase CLI tracking table exists) ====
-- If this returns no rows or the table does not exist, migrations were applied
-- via the SQL Editor (not the CLI): that is normal and means no CLI history exists.
select case when to_regclass('supabase_migrations.schema_migrations') is null
           then 'NO_CLI_MIGRATION_HISTORY'::text
           else (select string_agg(version||' '||name, E'\n' order by version)
                 from supabase_migrations.schema_migrations) end as migration_history;
