-- Dispute & Chargeback Management
-- Creates persistent dispute records, audit trail, and evidence links.
-- No production data is modified.

create extension if not exists "uuid-ossp";

-- Dispute lifecycle states (Razorpay-aligned)
create type public.dispute_status as enum (
  'CREATED',
  'UNDER_REVIEW',
  'ACTION_REQUIRED',
  'WON',
  'LOST',
  'CLOSED'
);

-- Dispute reasons (Razorpay dispute reason codes)
create type public.dispute_reason as enum (
  'DUPLICATE',
  'FRAUD',
  'INCORRECT_AMOUNT',
  'PRODUCT_NOT_RECEIVED',
  'PRODUCT_NOT_AS_DESCRIBED',
  'CANCELLED_ORDER',
  'REFUND_NOT_PROCESSED',
  'OTHER'
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  payment_intent_id uuid references public.payment_intents(id) on delete set null,
  provider text not null check (provider in ('RAZORPAY', 'MOCK')),
  provider_dispute_id text,
  provider_payment_id text,
  provider_order_id text,
  amount_paise bigint not null check (amount_paise > 0),
  currency char(3) not null default 'INR' check (currency = 'INR'),
  reason public.dispute_reason not null,
  status public.dispute_status not null default 'CREATED',
  evidence_deadline timestamptz,
  evidence_submitted_at timestamptz,
  resolved_at timestamptz,
  resolution_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dispute_provider_dispute_id_unique unique (provider, provider_dispute_id)
);

create index disputes_order_idx on public.disputes (order_id, created_at desc);
create index disputes_payment_intent_idx on public.disputes (payment_intent_id);
create index disputes_status_idx on public.disputes (status, created_at desc);
create index disputes_provider_dispute_id_idx on public.disputes (provider, provider_dispute_id);

-- Dispute audit trail (immutable history)
create table public.dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  from_status public.dispute_status,
  to_status public.dispute_status not null,
  event_type text not null,
  actor_id uuid references public.profiles(id),
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index dispute_events_dispute_idx on public.dispute_events (dispute_id, created_at);

-- Dispute evidence (links to private Supabase Storage)
create table public.dispute_evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  uploaded_by uuid references public.profiles(id),
  description text,
  created_at timestamptz not null default now(),
  constraint dispute_evidence_path_unique unique (dispute_id, storage_path)
);

create index dispute_evidence_dispute_idx on public.dispute_evidence (dispute_id, created_at);

-- Updated-at trigger
create or replace function public.set_dispute_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
create trigger disputes_updated_at before update on public.disputes for each row execute function public.set_dispute_updated_at();

-- Dispute state transition validator
create or replace function public.enforce_dispute_transition()
returns trigger language plpgsql as $$
declare
  v_valid boolean;
begin
  if new.from_status is null then
    if new.to_status is null then
      raise exception 'dispute event must have a to_status';
    end if;
    return new;
  end if;

  case new.from_status
    when 'CREATED' then v_valid := new.to_status in ('UNDER_REVIEW', 'ACTION_REQUIRED', 'CLOSED');
    when 'UNDER_REVIEW' then v_valid := new.to_status in ('ACTION_REQUIRED', 'WON', 'LOST', 'CLOSED');
    when 'ACTION_REQUIRED' then v_valid := new.to_status in ('UNDER_REVIEW', 'WON', 'LOST', 'CLOSED');
    when 'WON' then v_valid := new.to_status = 'CLOSED';
    when 'LOST' then v_valid := new.to_status = 'CLOSED';
    when 'CLOSED' then v_valid := false;
    else v_valid := false;
  end case;
  if not v_valid then
    raise exception 'invalid dispute transition % -> %', new.from_status, new.to_status;
  end if;
  return new;
end;
$$;
create trigger dispute_event_transition before insert or update on public.dispute_events
for each row execute function public.enforce_dispute_transition();

-- ---------------------------------------------------------------------------
-- Row Level Security & Access Control
-- ---------------------------------------------------------------------------

alter table public.disputes enable row level security;
alter table public.dispute_events enable row level security;
alter table public.dispute_evidence enable row level security;

-- Disputes select policy: order participants and active admins
create policy disputes_select_participants on public.disputes for select to authenticated
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

-- Dispute events select policy: order participants and active admins
create policy dispute_events_select_participants on public.dispute_events for select to authenticated
  using (
    exists (
      select 1 from public.disputes d
      join public.orders o on o.id = d.order_id
      where d.id = dispute_id
        and (o.buyer_id = auth.uid() or o.traveller_id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.account_status = 'ACTIVE'
    )
  );

-- Dispute evidence select policy: order participants and active admins
create policy dispute_evidence_select_participants on public.dispute_evidence for select to authenticated
  using (
    exists (
      select 1 from public.disputes d
      join public.orders o on o.id = d.order_id
      where d.id = dispute_id
        and (o.buyer_id = auth.uid() or o.traveller_id = auth.uid())
    )
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.account_status = 'ACTIVE'
    )
  );

-- Grants
grant all on public.disputes to service_role;
grant select on public.disputes to anon, authenticated;

grant all on public.dispute_events to service_role;
grant select on public.dispute_events to anon, authenticated;

grant all on public.dispute_evidence to service_role;
grant select on public.dispute_evidence to anon, authenticated;

grant usage, select on all sequences in schema public to service_role;

-- Settlement block check: no ORDER_SETTLED ledger for disputed orders
-- (enforced by reconciliation service and API layer; no DB-level block to preserve flexibility)
