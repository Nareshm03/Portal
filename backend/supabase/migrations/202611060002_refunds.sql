-- Portal refunds and cancellation | Supabase PostgreSQL
-- Forward-only additive migration. Run AFTER 202611060001_phone_verification.sql.
-- Adds CANCELLED and REFUNDED to the order_state enum, creates a dedicated
-- refunds table, and extends the transition_order RPC to support cancellation
-- and refund state transitions.
-- Apply in the Supabase SQL Editor. Service-role credentials must never reach the browser.

-- ---------------------------------------------------------------------------
-- 1. Extend order_state enum with CANCELLED and REFUNDED
-- ---------------------------------------------------------------------------

alter type public.order_state add value 'CANCELLED';
alter type public.order_state add value 'REFUNDED';

-- ---------------------------------------------------------------------------
-- 2. Create refunds table
-- ---------------------------------------------------------------------------

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  payment_intent_id uuid references public.payment_intents(id),
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  provider text not null check (provider in ('MOCK', 'RAZORPAY')),
  provider_refund_id text unique,
  idempotency_key text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVERSED')),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index refunds_order_idx on public.refunds (order_id, created_at desc);
create index refunds_payment_intent_idx on public.refunds (payment_intent_id);
create index refunds_status_idx on public.refunds (status, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------------

alter table public.refunds enable row level security;

create policy refunds_select_participants on public.refunds for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.buyer_id = auth.uid() or o.traveller_id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.account_status = 'ACTIVE'
    )
  );

-- Least privilege: the API server (service role) performs all writes.
-- Clients (anon/authenticated) receive no INSERT/UPDATE/DELETE grants here.
grant all on public.refunds to service_role;
grant select on public.refunds to anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

comment on table public.refunds is 'Refund records for cancelled orders. Immutable: corrections use compensating rows.';

-- ---------------------------------------------------------------------------
-- 4. Extend transition_order RPC to support CANCELLED and REFUNDED transitions
-- ---------------------------------------------------------------------------

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
    (v_from = 'ACCEPTED' and p_to_state in ('LOCKED', 'EXPIRED', 'CANCELLED')) or
    (v_from = 'LOCKED' and p_to_state in ('PURCHASED', 'DISPUTED', 'CANCELLED', 'REFUNDED')) or
    (v_from = 'PURCHASED' and p_to_state in ('LANDED', 'DISPUTED', 'CANCELLED')) or
    (v_from = 'LANDED' and p_to_state in ('COMPLETED', 'DISPUTED', 'FORFEITED'))
  ) then
    raise exception 'invalid transition: % -> %', v_from, p_to_state using errcode = '23514';
  end if;

  if p_to_state = 'LOCKED' then
    if v_role <> 'service_role' and p_actor_id <> v_order.buyer_id then
      raise exception 'only buyer can lock order' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.payment_intents pi
      where pi.order_id = p_order_id and pi.status = 'CAPTURED'
        and pi.amount_paise = v_order.upfront_paise and pi.currency = 'INR'
    ) then
      raise exception 'matching captured upfront collection required before lock' using errcode = '23514';
    end if;
  elsif p_to_state in ('PURCHASED', 'LANDED') then
    if p_actor_id <> v_order.traveller_id and v_role <> 'service_role' then
      raise exception 'only traveller can perform this transition' using errcode = '42501';
    end if;
  elsif p_to_state = 'COMPLETED' then
    if p_actor_id <> v_order.buyer_id and v_role <> 'service_role' then
      raise exception 'only buyer can complete the order' using errcode = '42501';
    end if;
  elsif p_to_state = 'DISPUTED' then
    if p_actor_id not in (v_order.buyer_id, v_order.traveller_id) and v_role <> 'service_role' then
      raise exception 'only order participants can dispute' using errcode = '42501';
    end if;
  elsif p_to_state = 'CANCELLED' then
    if p_actor_id not in (v_order.buyer_id, v_order.traveller_id) and v_role <> 'service_role' then
      raise exception 'only order participants can cancel' using errcode = '42501';
    end if;
  elsif p_to_state = 'REFUNDED' then
    if p_actor_id not in (v_order.buyer_id, v_order.traveller_id) and v_role <> 'service_role' then
      raise exception 'only order participants can refund' using errcode = '42501';
    end if;
  elsif p_to_state in ('FORFEITED', 'EXPIRED') and v_role <> 'service_role' then
    raise exception 'system role required' using errcode = '42501';
  end if;

  if p_to_state = 'EXPIRED' then
    if v_order.payment_deadline > now() then
      raise exception 'payment window has not elapsed';
    end if;
    if exists (
      select 1 from public.payment_intents pi
      where pi.order_id = p_order_id and pi.status = 'CAPTURED'
    ) then
      raise exception 'captured payment must be reconciled before expiry';
    end if;
    if exists (
      select 1 from public.payment_intents pi
      where pi.order_id = p_order_id and pi.provider <> 'MOCK'
        and pi.status in ('CREATING', 'CREATED', 'AUTHORIZED')
    ) then
      raise exception 'provider payment must be reconciled before expiry';
    end if;
  elsif p_to_state = 'FORFEITED' then
    if v_from <> 'LANDED' or v_order.forfeit_at is null or v_order.forfeit_at > now() then
      raise exception 'handover forfeiture deadline has not elapsed';
    end if;
  end if;

  update public.orders set state = p_to_state, version = version + 1,
    forfeit_at = case
      when p_to_state = 'LANDED' then now() + interval '72 hours'
      when p_to_state in ('COMPLETED', 'DISPUTED', 'FORFEITED', 'EXPIRED') then null
      else forfeit_at
    end
    where id = p_order_id returning * into v_order;
  insert into public.order_events(order_id, from_state, to_state, actor_id, note)
  values (p_order_id, v_from, p_to_state, p_actor_id, left(p_note, 500));
  return v_order;
end;
$$;
revoke all on function public.transition_order(uuid, public.order_state, uuid, text) from public, anon, authenticated;
grant execute on function public.transition_order(uuid, public.order_state, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Extend post_ledger_transaction RPC to support PAYMENT_REFUNDED event type
-- ---------------------------------------------------------------------------

-- The existing post_ledger_transaction already accepts any p_event_type text,
-- so PAYMENT_REFUNDED works without changes. The idempotency key uniqueness
-- on ledger_transactions prevents duplicate reversal postings.
