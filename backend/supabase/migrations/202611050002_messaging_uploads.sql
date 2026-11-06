-- Portal messaging + secure evidence uploads | Supabase PostgreSQL
-- Forward-only additive migration. Run AFTER 202611050001_portal_core.sql.
-- Does NOT touch financial tables, payment functions, ledger or the order state machine.
-- Apply in the Supabase SQL Editor. Service-role credentials must never reach the browser.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Messaging: one conversation per quote, buyer + traveller participants only.
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id),
  traveller_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint conversation_participants_distinct check (buyer_id <> traveller_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, created_at desc);
create index conversations_traveller_idx on public.conversations (traveller_id, created_at desc);

-- Defense in depth: a conversation's participants must match the quote's request
-- buyer and the quote's traveller, regardless of what the application sends.
create or replace function public.enforce_conversation_participants()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_quote public.quotes;
  v_request public.requests;
begin
  select * into v_quote from public.quotes where id = new.quote_id;
  if not found then raise exception 'quote not found'; end if;
  select * into v_request from public.requests where id = v_quote.request_id;
  if not found then raise exception 'request not found'; end if;
  if new.buyer_id is distinct from v_request.buyer_id then
    raise exception 'conversation buyer must own the request' using errcode = '42501';
  end if;
  if new.traveller_id is distinct from v_quote.traveller_id then
    raise exception 'conversation traveller must own the quote' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists conversation_participants_check on public.conversations;
create trigger conversation_participants_check before insert on public.conversations
for each row execute function public.enforce_conversation_participants();

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null,
  seq bigint generated always as identity,
  created_at timestamptz not null default now(),
  constraint conversation_message_body_length check (char_length(body) between 1 and 2000)
);

create index conversation_messages_conversation_seq_idx on public.conversation_messages (conversation_id, seq desc);

-- Defense in depth: only a conversation participant can be the sender of a message.
create or replace function public.enforce_message_sender_participant()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation from public.conversations where id = new.conversation_id;
  if not found then raise exception 'conversation not found'; end if;
  if new.sender_id is distinct from v_conversation.buyer_id
     and new.sender_id is distinct from v_conversation.traveller_id then
    raise exception 'sender is not a conversation participant' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists conversation_message_sender_participant on public.conversation_messages;
create trigger conversation_message_sender_participant before insert on public.conversation_messages
for each row execute function public.enforce_message_sender_participant();

-- Per-user read cursor. unread = incoming messages with seq > last_read_seq.
create table public.conversation_read_states (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  last_read_seq bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create or replace function public.set_conversation_read_state_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists conversation_read_state_updated_at on public.conversation_read_states;
create trigger conversation_read_state_updated_at before update on public.conversation_read_states
for each row execute function public.set_conversation_read_state_updated_at();

-- ---------------------------------------------------------------------------
-- Evidence uploads metadata. The binary itself lives in a private Storage bucket.
-- ---------------------------------------------------------------------------

create table public.order_evidence (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id),
  category text not null check (category in ('PURCHASE_RECEIPT','PRODUCT_PHOTO','SERIAL_EVIDENCE','ADDITIONAL_EVIDENCE','ARRIVAL_PROOF','HANDOVER_EVIDENCE')),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (char_length(mime_type) between 3 and 100),
  size_bytes bigint not null check (size_bytes > 0),
  storage_path text not null,
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','FAILED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint order_evidence_size_limit check (size_bytes <= 10485760)
);

create index order_evidence_order_idx on public.order_evidence (order_id, created_at desc);
create index order_evidence_uploader_idx on public.order_evidence (uploader_id, created_at desc);
create unique index order_evidence_storage_path_idx on public.order_evidence (storage_path);

-- ---------------------------------------------------------------------------
-- Private Storage bucket. No public/client policies are created: the backend
-- (service role, bypasses RLS) issues short-lived signed URLs for upload/download.
-- Clients never receive a public URL and cannot read objects directly.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('order_evidence', 'order_evidence', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security. Writes are mediated by the authenticated API server using
-- the service role (bypasses RLS). These SELECT policies add defense in depth so
-- a leaked anon/authenticated key still cannot read another user's conversations
-- or order evidence.
-- ---------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.conversation_read_states enable row level security;
alter table public.order_evidence enable row level security;

create policy conversations_select_participants on public.conversations for select to authenticated
  using (buyer_id = auth.uid() or traveller_id = auth.uid());

create policy conversation_messages_select_participants on public.conversation_messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and (c.buyer_id = auth.uid() or c.traveller_id = auth.uid())
  ));

create policy conversation_read_states_select_own on public.conversation_read_states for select to authenticated
  using (user_id = auth.uid());

create policy order_evidence_select_participants on public.order_evidence for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.traveller_id = auth.uid()))
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.account_status = 'ACTIVE')
  );

-- Least privilege: the API server (service role) performs all writes. Clients
-- (anon/authenticated) receive no INSERT/UPDATE/DELETE grants here.
grant all on public.conversations, public.conversation_messages, public.conversation_read_states, public.order_evidence to service_role;
grant select on public.conversations, public.conversation_messages, public.conversation_read_states, public.order_evidence to anon, authenticated;
grant usage, select on all sequences in schema public to service_role;

comment on table public.conversations is 'One conversation per quote. Participants are the request buyer and the quote traveller only.';
comment on table public.order_evidence is 'Evidence metadata. Binaries live in the private order_evidence Storage bucket; access is via short-lived signed URLs only.';
