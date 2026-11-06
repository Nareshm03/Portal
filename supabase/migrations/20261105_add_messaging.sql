-- Messaging system for Portal | Supabase PostgreSQL
-- Buyer-Traveler real-time messaging with proper RLS and conversation management

-- Conversations table: represents a channel between a buyer and traveler for a specific request
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  traveller_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Ensure one conversation per request-buyer-traveller combination
  unique (request_id, buyer_id, traveller_id)
);

create index conversations_buyer_idx on public.conversations (buyer_id, updated_at desc);
create index conversations_traveller_idx on public.conversations (traveller_id, updated_at desc);
create index conversations_request_idx on public.conversations (request_id);

comment on table public.conversations is 'Conversation channels between buyers and travellers for specific product requests';

-- Messages table: stores individual messages within conversations
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint message_content_not_empty check (trim(content) <> '')
);

create index messages_conversation_idx on public.messages (conversation_id, created_at asc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);
create index messages_receiver_unread_idx on public.messages (receiver_id, read_at) where read_at is null;

comment on table public.messages is 'Individual messages within buyer-traveller conversations';

-- Updated_at trigger for conversations
create trigger conversations_updated_at before update on public.conversations 
for each row execute function public.set_updated_at();

-- Auto-update conversation timestamp when a message is sent
create or replace function public.update_conversation_timestamp()
returns trigger language plpgsql as $$
begin
  update public.conversations 
  set updated_at = new.created_at 
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger message_updates_conversation after insert on public.messages
for each row execute function public.update_conversation_timestamp();

-- Enable RLS
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- RLS Policies for conversations
-- Buyers can see conversations they are part of
create policy conversations_select_buyer on public.conversations
  for select to authenticated
  using (buyer_id = auth.uid());

-- Travellers can see conversations they are part of
create policy conversations_select_traveller on public.conversations
  for select to authenticated
  using (traveller_id = auth.uid());

-- RLS Policies for messages
-- Users can see messages in conversations they participate in
create policy messages_select_participants on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.traveller_id = auth.uid())
    )
  );

-- Users can only insert messages they are the sender of
create policy messages_insert_own on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
      and (c.buyer_id = auth.uid() or c.traveller_id = auth.uid())
    )
  );

-- Users can only update (mark as read) messages they are the receiver of
create policy messages_update_receiver on public.messages
  for update to authenticated
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());

-- Enable Realtime for messages (must also be enabled in Supabase dashboard)
-- This allows clients to subscribe to message inserts in real-time
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- Helper function to get or create conversation
-- This ensures conversations are created consistently and prevents duplicates
create or replace function public.get_or_create_conversation(
  p_request_id uuid,
  p_buyer_id uuid,
  p_traveller_id uuid
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_request public.requests;
begin
  -- Verify the request exists and the buyer owns it
  select * into v_request from public.requests 
  where id = p_request_id and buyer_id = p_buyer_id;
  
  if not found then
    raise exception 'Request not found or buyer mismatch';
  end if;
  
  -- Verify traveller exists
  if not exists (
    select 1 from public.profiles 
    where id = p_traveller_id and role = 'traveller'
  ) then
    raise exception 'Traveller not found';
  end if;
  
  -- Try to find existing conversation
  select id into v_conversation_id
  from public.conversations
  where request_id = p_request_id
    and buyer_id = p_buyer_id
    and traveller_id = p_traveller_id;
  
  -- Create if not exists
  if v_conversation_id is null then
    insert into public.conversations (request_id, buyer_id, traveller_id)
    values (p_request_id, p_buyer_id, p_traveller_id)
    returning id into v_conversation_id;
  end if;
  
  return v_conversation_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.get_or_create_conversation(uuid, uuid, uuid) to authenticated;

-- Helper function to mark messages as read
create or replace function public.mark_messages_read(
  p_conversation_id uuid,
  p_user_id uuid
) returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
begin
  -- Verify user is part of the conversation
  if not exists (
    select 1 from public.conversations
    where id = p_conversation_id
    and (buyer_id = p_user_id or traveller_id = p_user_id)
  ) then
    raise exception 'Unauthorized';
  end if;
  
  -- Mark unread messages as read
  update public.messages
  set read_at = now()
  where conversation_id = p_conversation_id
    and receiver_id = p_user_id
    and read_at is null;
  
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_messages_read(uuid, uuid) to authenticated;

-- Function to get unread count for a user
create or replace function public.get_unread_message_count(p_user_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.messages
  where receiver_id = p_user_id
    and read_at is null;
  
  return v_count;
end;
$$;

grant execute on function public.get_unread_message_count(uuid) to authenticated;
