-- Portal core schema | Supabase PostgreSQL
-- Apply in Supabase SQL Editor. Service-role credentials must never reach the browser.

create extension if not exists pgcrypto;

create type public.portal_role as enum ('buyer', 'traveller', 'admin', 'compliance_reviewer');
create type public.account_status as enum ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');
create type public.kyc_status as enum ('NOT_SUBMITTED', 'SUBMITTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');
create type public.compliance_status as enum ('REVIEW_REQUIRED', 'APPROVED', 'REJECTED');
create type public.order_state as enum ('ACCEPTED', 'LOCKED', 'PURCHASED', 'LANDED', 'COMPLETED', 'FORFEITED', 'DISPUTED', 'EXPIRED');
create type public.payment_status as enum ('CREATING', 'CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone_e164 text,
  role public.portal_role not null default 'buyer',
  account_status public.account_status not null default 'PENDING',
  kyc_status public.kyc_status not null default 'NOT_SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_length check (char_length(full_name) <= 120),
  constraint profiles_phone_length check (phone_e164 is null or char_length(phone_e164) between 8 and 18)
);

-- Ignore client-provided role/KYC/status metadata on signup.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, account_status, kyc_status)
  values (
    new.id,
    coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''),
    'buyer', 'PENDING', 'NOT_SUBMITTED'
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  traveller_id uuid not null references public.profiles(id),
  origin_country char(2) not null,
  origin_airport_code char(3) not null,
  destination_country char(2) not null,
  destination_airport_code char(3) not null,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  capacity_kg numeric(7,2) not null default 0,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_airports_distinct check (origin_airport_code <> destination_airport_code),
  constraint trip_time_order check (arrival_at > departure_at),
  constraint trip_capacity_nonnegative check (capacity_kg >= 0)
);

create index trips_route_date_idx on public.trips (origin_airport_code, destination_airport_code, departure_at) where status = 'ACTIVE';
create index trips_traveller_idx on public.trips (traveller_id, created_at desc);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id),
  origin_country char(2) not null,
  origin_airport_code char(3) not null,
  destination_country char(2) not null,
  destination_airport_code char(3) not null,
  needed_by timestamptz not null,
  product_title text not null,
  product_category text not null,
  product_url text,
  quantity integer not null default 1,
  declared_value_minor bigint,
  declared_currency char(3),
  hs_code text,
  fulfilment_mode text not null default 'PASSENGER_BAGGAGE' check (fulfilment_mode in ('PASSENGER_BAGGAGE', 'FORMAL_IMPORT', 'LICENSED_COURIER', 'OTHER')),
  is_for_third_party boolean not null default true,
  compliance_status public.compliance_status not null default 'REVIEW_REQUIRED',
  compliance_reason text[] not null default array['Manual compliance review required before matching.']::text[],
  compliance_reviewed_by uuid references public.profiles(id),
  compliance_reviewed_at timestamptz,
  compliance_reference text,
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW', 'OPEN', 'MATCHED', 'CLOSED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_title_length check (char_length(product_title) between 2 and 180),
  constraint request_quantity_positive check (quantity between 1 and 100),
  constraint request_value_nonnegative check (declared_value_minor is null or declared_value_minor >= 0),
  constraint request_currency_code check (declared_currency is null or declared_currency ~ '^[A-Z]{3}$'),
  constraint request_hs_code_format check (hs_code is null or hs_code ~ '^[0-9]{6,10}$')
);

create index requests_buyer_idx on public.requests (buyer_id, created_at desc);
create index requests_matching_idx on public.requests (origin_airport_code, destination_airport_code, needed_by) where status = 'OPEN' and compliance_status = 'APPROVED';

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  trip_id uuid not null references public.trips(id),
  traveller_id uuid not null references public.profiles(id),
  item_price_minor bigint not null,
  item_currency char(3) not null,
  fx_rate numeric(18,6) not null,
  fx_source text not null,
  fx_timestamp timestamptz not null,
  indicative_duty_paise bigint,
  duty_source text,
  duty_reviewed_by uuid references public.profiles(id),
  duty_reviewed_at timestamptz,
  duty_assessment_reference text,
  note text,
  platform_fee_bps integer not null default 500,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint quote_price_positive check (item_price_minor > 0),
  constraint quote_fx_positive check (fx_rate > 0),
  constraint quote_duty_nonnegative check (indicative_duty_paise is null or indicative_duty_paise >= 0),
  constraint quote_fee_bps check (platform_fee_bps between 0 and 3000)
);

create index quotes_request_idx on public.quotes (request_id, status, expires_at);
create index quotes_traveller_idx on public.quotes (traveller_id, created_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id),
  quote_id uuid not null unique references public.quotes(id),
  buyer_id uuid not null references public.profiles(id),
  traveller_id uuid not null references public.profiles(id),
  state public.order_state not null default 'ACCEPTED',
  subtotal_paise bigint not null,
  platform_fee_paise bigint not null,
  total_paise bigint not null,
  deposit_paise bigint not null,
  currency char(3) not null default 'INR' check (currency = 'INR'),
  payment_deadline timestamptz not null,
  forfeit_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_amounts_nonnegative check (subtotal_paise > 0 and platform_fee_paise >= 0 and total_paise = subtotal_paise + platform_fee_paise and deposit_paise between 1 and total_paise),
  constraint order_version_positive check (version > 0)
);

create index orders_buyer_idx on public.orders (buyer_id, created_at desc);
create index orders_traveller_idx on public.orders (traveller_id, created_at desc);
create index orders_expiry_idx on public.orders (payment_deadline) where state = 'ACCEPTED';

create table public.payment_intents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  buyer_id uuid not null references public.profiles(id),
  provider text not null check (provider in ('MOCK', 'RAZORPAY')),
  provider_order_id text unique,
  provider_payment_id text unique,
  idempotency_key text not null unique,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  status public.payment_status not null default 'CREATING',
  raw_provider_reference jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_intents_order_idx on public.payment_intents (order_id, created_at desc);
create unique index payment_intents_one_open_per_order_idx on public.payment_intents (order_id) where status in ('CREATING', 'CREATED', 'AUTHORIZED');

-- A payment intent is permanently bound to the buyer and deposit amount on its order.
create or replace function public.enforce_payment_intent_order_binding()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = new.order_id;
  if not found then raise exception 'order not found for payment intent'; end if;
  if new.buyer_id <> v_order.buyer_id or new.amount_paise <> v_order.deposit_paise or new.currency <> 'INR' then
    raise exception 'payment intent does not match the order deposit';
  end if;
  if tg_op = 'UPDATE' and (
    new.order_id <> old.order_id or new.buyer_id <> old.buyer_id or new.provider <> old.provider or
    new.idempotency_key <> old.idempotency_key or new.amount_paise <> old.amount_paise or new.currency <> old.currency
  ) then
    raise exception 'payment intent binding fields are immutable';
  end if;
  return new;
end;
$$;
create trigger payment_intent_order_binding before insert or update on public.payment_intents
for each row execute function public.enforce_payment_intent_order_binding();

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id),
  event_type text not null,
  idempotency_key text not null unique,
  actor_id uuid references public.profiles(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.ledger_transactions(id),
  account_code text not null,
  direction text not null check (direction in ('DEBIT', 'CREDIT')),
  amount_paise bigint not null check (amount_paise > 0),
  created_at timestamptz not null default now()
);

create index ledger_entries_transaction_idx on public.ledger_entries (transaction_id);
create index ledger_entries_account_idx on public.ledger_entries (account_code, created_at desc);

create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  from_state public.order_state,
  to_state public.order_state not null,
  actor_id uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  event_type text not null,
  payload_hash text not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create table public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  recipient_user_id uuid not null references public.profiles(id),
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index otp_order_recipient_idx on public.otp_challenges (order_id, recipient_user_id, expires_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger trips_updated_at before update on public.trips for each row execute function public.set_updated_at();
create trigger requests_updated_at before update on public.requests for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payment_intents_updated_at before update on public.payment_intents for each row execute function public.set_updated_at();

-- Immutable evidence and money tables: correction means a new compensating row, never an UPDATE/DELETE.
create or replace function public.reject_mutation()
returns trigger language plpgsql as $$ begin raise exception 'append-only table: updates and deletes are prohibited'; end; $$;
create trigger ledger_transactions_immutable before update or delete on public.ledger_transactions for each row execute function public.reject_mutation();
create trigger ledger_entries_immutable before update or delete on public.ledger_entries for each row execute function public.reject_mutation();
create trigger order_events_immutable before update or delete on public.order_events for each row execute function public.reject_mutation();
create trigger audit_logs_immutable before update or delete on public.audit_logs for each row execute function public.reject_mutation();

-- A client cannot promote itself, mark its KYC verified, or change account status.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql as $$
begin
  if current_user <> 'postgres' and coalesce(auth.role(), '') <> 'service_role' then
    if new.role <> old.role or new.account_status <> old.account_status or new.kyc_status <> old.kyc_status then
      raise exception 'role, account_status and kyc_status are server-managed';
    end if;
  end if;
  return new;
end;
$$;
create trigger protect_profile_privileges before update on public.profiles for each row execute function public.protect_profile_privileges();

-- Admin-only, auditable role provisioning. Users can never self-promote.
create or replace function public.provision_profile_role(
  p_profile_id uuid,
  p_new_role public.portal_role,
  p_actor_id uuid
) returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles a where a.id = p_actor_id and a.role = 'admin' and a.account_status = 'ACTIVE') then
    raise exception 'active admin required' using errcode = '42501';
  end if;
  if p_new_role not in ('buyer'::public.portal_role, 'traveller'::public.portal_role) then raise exception 'only buyer or traveller roles may be assigned here'; end if;
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found then raise exception 'profile not found'; end if;
  if v_profile.role in ('admin', 'compliance_reviewer') then raise exception 'privileged roles cannot be changed through this endpoint'; end if;

  update public.profiles set role = p_new_role,
    account_status = case when p_new_role = 'buyer' then 'ACTIVE'::public.account_status else 'PENDING'::public.account_status end,
    kyc_status = 'NOT_SUBMITTED', updated_at = now()
    where id = p_profile_id returning * into v_profile;
  insert into public.audit_logs(actor_id, action, target_type, target_id, metadata)
  values (p_actor_id, 'PROFILE_ROLE_PROVISIONED', 'profile', p_profile_id,
    jsonb_build_object('newRole', p_new_role, 'accountStatus', v_profile.account_status));
  return v_profile;
end;
$$;
revoke all on function public.provision_profile_role(uuid, public.portal_role, uuid) from public, anon, authenticated;
grant execute on function public.provision_profile_role(uuid, public.portal_role, uuid) to service_role;

-- Admin-only, auditable KYC decision. No client can set VERIFIED.
create or replace function public.review_traveller_kyc(
  p_profile_id uuid,
  p_decision public.kyc_status,
  p_provider_reference text,
  p_actor_id uuid
) returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if not exists (select 1 from public.profiles a where a.id = p_actor_id and a.role = 'admin' and a.account_status = 'ACTIVE') then
    raise exception 'active admin required' using errcode = '42501';
  end if;
  if p_decision not in ('VERIFIED'::public.kyc_status, 'REJECTED'::public.kyc_status) then raise exception 'invalid KYC decision'; end if;
  if p_provider_reference is null or length(trim(p_provider_reference)) < 6 or length(p_provider_reference) > 160 then raise exception 'valid KYC provider reference required'; end if;
  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found or v_profile.role <> 'traveller' then raise exception 'traveller profile not found'; end if;
  if v_profile.kyc_status not in ('SUBMITTED', 'PENDING_REVIEW') then raise exception 'traveller KYC is not awaiting review'; end if;
  update public.profiles set kyc_status = p_decision,
    account_status = case when p_decision = 'VERIFIED' then 'ACTIVE'::public.account_status else 'SUSPENDED'::public.account_status end,
    updated_at = now()
    where id = p_profile_id returning * into v_profile;
  insert into public.audit_logs(actor_id, action, target_type, target_id, metadata)
  values (p_actor_id, 'TRAVELLER_KYC_REVIEWED', 'profile', p_profile_id,
    jsonb_build_object('decision', p_decision, 'providerReference', p_provider_reference));
  return v_profile;
end;
$$;
revoke all on function public.review_traveller_kyc(uuid, public.kyc_status, text, uuid) from public, anon, authenticated;
grant execute on function public.review_traveller_kyc(uuid, public.kyc_status, text, uuid) to service_role;

-- Atomic, row-locked transition. A verified captured payment must exist before LOCKED.
create or replace function public.transition_order(
  p_order_id uuid,
  p_to_state public.order_state,
  p_actor_id uuid,
  p_note text default null
) returns public.orders
language plpgsql security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_from public.order_state;
  v_role text := coalesce(auth.role(), '');
begin
  if v_role <> 'service_role' and auth.uid() is distinct from p_actor_id then
    raise exception 'actor mismatch' using errcode = '42501';
  end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'order not found' using errcode = 'P0002'; end if;
  v_from := v_order.state;
  -- Safe idempotency for concurrent webhook/client retries; no duplicate event is written.
  if v_from = p_to_state then return v_order; end if;

  if not (
    (v_from = 'ACCEPTED' and p_to_state in ('LOCKED', 'EXPIRED')) or
    (v_from = 'LOCKED' and p_to_state in ('PURCHASED', 'DISPUTED')) or
    (v_from = 'PURCHASED' and p_to_state in ('LANDED', 'DISPUTED')) or
    (v_from = 'LANDED' and p_to_state in ('COMPLETED', 'DISPUTED', 'FORFEITED'))
  ) then
    raise exception 'invalid transition: % -> %', v_from, p_to_state using errcode = '23514';
  end if;

  if p_to_state = 'LOCKED' then
    if v_role <> 'service_role' and p_actor_id <> v_order.buyer_id then raise exception 'only buyer can lock order' using errcode = '42501'; end if;
    if not exists (
      select 1 from public.payment_intents pi
      where pi.order_id = p_order_id and pi.status = 'CAPTURED'
        and pi.amount_paise = v_order.deposit_paise and pi.currency = 'INR'
    ) then
      raise exception 'matching captured deposit required before lock' using errcode = '23514';
    end if;
  elsif p_to_state in ('PURCHASED', 'LANDED') then
    if p_actor_id <> v_order.traveller_id and v_role <> 'service_role' then raise exception 'only traveller can perform this transition' using errcode = '42501'; end if;
  elsif p_to_state = 'COMPLETED' then
    if p_actor_id <> v_order.buyer_id and v_role <> 'service_role' then raise exception 'only buyer can complete the order' using errcode = '42501'; end if;
  elsif p_to_state = 'DISPUTED' then
    if p_actor_id not in (v_order.buyer_id, v_order.traveller_id) and v_role <> 'service_role' then raise exception 'only order participants can dispute' using errcode = '42501'; end if;
  elsif p_to_state in ('FORFEITED', 'EXPIRED') and v_role <> 'service_role' then
    raise exception 'system role required' using errcode = '42501';
  end if;

  if p_to_state = 'EXPIRED' then
    if v_order.payment_deadline > now() then raise exception 'payment window has not elapsed'; end if;
    if exists (select 1 from public.payment_intents pi where pi.order_id = p_order_id and pi.status = 'CAPTURED') then
      raise exception 'captured payment must be reconciled before expiry';
    end if;
    if exists (select 1 from public.payment_intents pi where pi.order_id = p_order_id and pi.provider <> 'MOCK' and pi.status in ('CREATING', 'CREATED', 'AUTHORIZED')) then
      raise exception 'provider payment must be reconciled before expiry';
    end if;
  elsif p_to_state = 'FORFEITED' then
    if v_from <> 'LANDED' or v_order.forfeit_at is null or v_order.forfeit_at > now() then
      raise exception 'handover forfeiture deadline has not elapsed';
    end if;
  end if;

  update public.orders set state = p_to_state, version = version + 1,
    forfeit_at = case when p_to_state = 'LANDED' then now() + interval '72 hours' when p_to_state in ('COMPLETED', 'DISPUTED', 'FORFEITED', 'EXPIRED') then null else forfeit_at end
    where id = p_order_id returning * into v_order;
  insert into public.order_events(order_id, from_state, to_state, actor_id, note)
  values (p_order_id, v_from, p_to_state, p_actor_id, left(p_note, 500));
  return v_order;
end;
$$;
revoke all on function public.transition_order(uuid, public.order_state, uuid, text) from public, anon, authenticated;
grant execute on function public.transition_order(uuid, public.order_state, uuid, text) to service_role;

-- Balanced, append-only ledger posting with unique idempotency key and atomic DB transaction.
create or replace function public.post_ledger_transaction(
  p_order_id uuid,
  p_event_type text,
  p_idempotency_key text,
  p_actor_id uuid,
  p_metadata jsonb,
  p_entries jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_transaction_id uuid;
  v_debits numeric := 0;
  v_credits numeric := 0;
  v_entry jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 120 then raise exception 'invalid idempotency key'; end if;
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 2 then raise exception 'at least two ledger entries required'; end if;

  insert into public.ledger_transactions(order_id, event_type, idempotency_key, actor_id, metadata)
  values (p_order_id, left(p_event_type, 80), p_idempotency_key, p_actor_id, coalesce(p_metadata, '{}'::jsonb))
  on conflict (idempotency_key) do nothing
  returning id into v_transaction_id;

  if v_transaction_id is null then
    select id into v_transaction_id from public.ledger_transactions where idempotency_key = p_idempotency_key;
    return v_transaction_id;
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries) loop
    if (v_entry->>'amountPaise') !~ '^[1-9][0-9]*$' then raise exception 'invalid ledger amount'; end if;
    if v_entry->>'direction' not in ('DEBIT', 'CREDIT') then raise exception 'invalid ledger direction'; end if;
    if coalesce(v_entry->>'accountCode', '') = '' then raise exception 'missing ledger account code'; end if;
    if (v_entry->>'direction') = 'DEBIT' then v_debits := v_debits + (v_entry->>'amountPaise')::numeric;
    else v_credits := v_credits + (v_entry->>'amountPaise')::numeric; end if;
    insert into public.ledger_entries(transaction_id, account_code, direction, amount_paise)
    values (v_transaction_id, left(v_entry->>'accountCode', 80), v_entry->>'direction', (v_entry->>'amountPaise')::bigint);
  end loop;
  if v_debits <> v_credits then raise exception 'unbalanced ledger transaction'; end if;
  return v_transaction_id;
end;
$$;
revoke all on function public.post_ledger_transaction(uuid, text, text, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.post_ledger_transaction(uuid, text, text, uuid, jsonb, jsonb) to service_role;

-- RLS: frontend access is deny-by-default. Sensitive writes go through authenticated API server.
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.requests enable row level security;
alter table public.quotes enable row level security;
alter table public.orders enable row level security;
alter table public.payment_intents enable row level security;
alter table public.ledger_transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.order_events enable row level security;
alter table public.webhook_events enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_own_safe on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy trips_select_active on public.trips for select to authenticated using (status = 'ACTIVE' or traveller_id = auth.uid());
create policy requests_select_own on public.requests for select to authenticated using (buyer_id = auth.uid());
create policy quotes_select_participants on public.quotes for select to authenticated using (
  traveller_id = auth.uid() or exists (select 1 from public.requests r where r.id = request_id and r.buyer_id = auth.uid())
);
create policy orders_select_participants on public.orders for select to authenticated using (buyer_id = auth.uid() or traveller_id = auth.uid());
create policy order_events_select_participants on public.order_events for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.traveller_id = auth.uid()))
);

-- Payment, ledger, OTP, webhooks and audit data are server-only.
-- No authenticated/anon write policies are intentionally created.
comment on table public.ledger_transactions is 'Append-only money journal. Never treat as a regulated escrow account.';
comment on table public.requests is 'Matching is prohibited unless compliance_status=APPROVED and status=OPEN.';
comment on table public.profiles is 'User role, account status and KYC status are server-managed.';

-- Quote acceptance is atomic: one buyer can accept one active quote, only after compliance approval.
create or replace function public.accept_quote(
  p_quote_id uuid,
  p_buyer_id uuid,
  p_subtotal_paise bigint,
  p_platform_fee_paise bigint,
  p_total_paise bigint,
  p_deposit_paise bigint,
  p_payment_deadline timestamptz
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_quote public.quotes;
  v_request public.requests;
  v_trip public.trips;
  v_buyer public.profiles;
  v_traveller public.profiles;
  v_order_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'service role required' using errcode = '42501'; end if;
  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then raise exception 'quote not found'; end if;
  select * into v_request from public.requests where id = v_quote.request_id for update;
  if not found then raise exception 'request not found'; end if;
  select * into v_trip from public.trips where id = v_quote.trip_id for update;
  select * into v_buyer from public.profiles where id = p_buyer_id;
  select * into v_traveller from public.profiles where id = v_quote.traveller_id;

  if v_trip.id is null or v_buyer.id is null or v_traveller.id is null then raise exception 'related record missing'; end if;
  if v_request.buyer_id <> p_buyer_id then raise exception 'buyer mismatch' using errcode = '42501'; end if;
  if v_request.compliance_status <> 'APPROVED' or v_request.status <> 'OPEN' then raise exception 'request is not approved and open'; end if;
  if v_quote.status <> 'ACTIVE' or v_quote.expires_at <= now() then raise exception 'quote is not active'; end if;
  if v_quote.indicative_duty_paise is null then raise exception 'duty review required'; end if;
  if v_trip.status <> 'ACTIVE' then raise exception 'trip is not active'; end if;
  if v_trip.origin_country <> v_request.origin_country or v_trip.origin_airport_code <> v_request.origin_airport_code or v_trip.destination_country <> v_request.destination_country or v_trip.destination_airport_code <> v_request.destination_airport_code or v_trip.departure_at > v_request.needed_by or v_trip.arrival_at > v_request.needed_by then raise exception 'trip route/date mismatch'; end if;
  if v_buyer.account_status <> 'ACTIVE' or v_buyer.role <> 'buyer' then raise exception 'buyer account is not active'; end if;
  if v_traveller.account_status <> 'ACTIVE' or v_traveller.role <> 'traveller' or v_traveller.kyc_status <> 'VERIFIED' then raise exception 'traveller is not cleared'; end if;
  if p_subtotal_paise <= 0 or p_platform_fee_paise < 0 or p_total_paise <> p_subtotal_paise + p_platform_fee_paise or p_deposit_paise <= 0 or p_deposit_paise > p_total_paise then raise exception 'invalid order amounts'; end if;
  if p_payment_deadline <= now() or p_payment_deadline > now() + interval '2 hours' then raise exception 'invalid payment deadline'; end if;
  if exists (select 1 from public.orders where quote_id = p_quote_id) then raise exception 'quote already accepted'; end if;

  insert into public.orders(request_id, quote_id, buyer_id, traveller_id, state, subtotal_paise, platform_fee_paise, total_paise, deposit_paise, payment_deadline)
  values (v_request.id, v_quote.id, p_buyer_id, v_quote.traveller_id, 'ACCEPTED', p_subtotal_paise, p_platform_fee_paise, p_total_paise, p_deposit_paise, p_payment_deadline)
  returning id into v_order_id;
  update public.quotes set status = 'ACCEPTED' where id = p_quote_id;
  update public.requests set status = 'MATCHED' where id = v_request.id;
  insert into public.order_events(order_id, from_state, to_state, actor_id, note)
  values (v_order_id, null, 'ACCEPTED', p_buyer_id, 'Quote accepted. Awaiting initial deposit.');
  return v_order_id;
end;
$$;
revoke all on function public.accept_quote(uuid, uuid, bigint, bigint, bigint, bigint, timestamptz) from public, anon, authenticated;
grant execute on function public.accept_quote(uuid, uuid, bigint, bigint, bigint, bigint, timestamptz) to service_role;
