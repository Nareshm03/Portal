import { Router } from 'express';
import { z } from 'zod';
import { getSupabase } from '../config/supabase.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import {
  assertParticipant,
  isParticipant,
  otherParticipantId,
  clampLimit,
  shapeMessagePage,
  markReadByRecipient,
  buildConversationList,
  validateMessageBody,
  MESSAGE_PAGE_MAX,
  // Demo store
  demoCreateConversation,
  demoGetConversation,
  demoGetConversationByQuote,
  demoListConversations,
  demoGetMessages,
  demoSendMessage,
  demoGetReadState,
  demoSetReadState,
  demoReset,
} from '../services/conversations.js';

export const conversationRouter = Router();
const supabase = () => getSupabase();
const useDemo = () => env.MOCK_MESSAGING === true;

// ---------------------------------------------------------------------------
// Demo-mode wrappers. When MOCK_MESSAGING is true, all messaging IO goes
// through the in-memory store; Supabase is never touched for conversations.
// ---------------------------------------------------------------------------

async function demoGetConversationOr404(conversationId) {
  const convo = demoGetConversation(conversationId);
  if (!convo) throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  return convo;
}

async function demoListConversationsForUser(userId) {
  const convos = demoListConversations(userId);
  const result = [];
  for (const c of convos) {
    const messages = demoGetMessages(c.id, 1).messages;
    const readState = demoGetReadState(c.id, userId);
    const incomingMsgs = messages.filter((m) => m.sender_id !== userId);
    const lastReadSeq = Number(readState.last_read_seq ?? 0);
    const unreadCount = incomingMsgs.filter((m) => Number(m.seq) > lastReadSeq).length;
    result.push({
      id: c.id,
      quoteId: c.quote_id,
      buyerId: c.buyer_id,
      travellerId: c.traveller_id,
      otherParticipantId: otherParticipantId(c, userId),
      lastReadSeq: Number(readState.last_read_seq ?? 0),
      unreadCount,
      lastMessage: messages[0]
        ? { seq: messages[0].seq, senderId: messages[0].sender_id, body: messages[0].body, createdAt: messages[0].created_at }
        : null,
      createdAt: c.created_at,
    });
  }
  return result;
}

async function demoGetMessagesForConversation(conversationId, userId, limit, beforeSeq) {
  const convo = await demoGetConversationOr404(conversationId);
  assertParticipant(convo, userId);

  const { messages, nextCursor, hasMore } = demoGetMessages(conversationId, limit, beforeSeq);
  const otherId = otherParticipantId(convo, userId);
  const readState = demoGetReadState(conversationId, userId);
  const annotated = markReadByRecipient(messages, Number(readState.last_read_seq ?? 0), userId);
  return { messages: annotated, nextCursor, hasMore };
}

async function demoSendMessageToConversation(conversationId, senderId, body) {
  const convo = await demoGetConversationOr404(conversationId);
  assertParticipant(convo, senderId);
  return demoSendMessage(conversationId, senderId, body);
}

async function demoMarkConversationRead(conversationId, userId) {
  const convo = await demoGetConversationOr404(conversationId);
  assertParticipant(convo, userId);
  const messages = demoGetMessages(conversationId, 1).messages;
  const lastReadSeq = messages[0]?.seq ?? 0;
  return demoSetReadState(conversationId, userId, lastReadSeq);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Open (or return) the single conversation for a quote. Participants are derived
// from the quote/request on the server; a client cannot open a conversation for
// users it does not represent.
conversationRouter.post('/quotes/:quoteId/conversation', requireAuth, requireRole('buyer', 'traveller'), async (req, res) => {
  const quoteId = z.string().uuid().parse(req.params.quoteId);

  if (useDemo()) {
    // In demo mode we don't have quote/request data in Supabase. Build a minimal
    // quote record from the existing demo store or synthesize one.
    // The caller must already be a participant; we look up any existing conversation
    // for this quoteId first.
    const existing = demoGetConversationByQuote(quoteId);
    if (existing) {
      assertParticipant(existing, req.user.id);
      return res.json({ data: existing });
    }
    // Synthesize: caller is the buyer, and we need a traveller. Use a deterministic
    // demo traveller id derived from the quote id so the same quote always maps to
    // the same conversation.
    const travellerId = `demo-traveller-${quoteId}`;
    const convo = demoCreateConversation(quoteId, req.user.id, travellerId);
    return res.status(201).json({ data: convo });
  }

  const { data: quote, error } = await supabase().from('quotes')
    .select('id, traveller_id, request:requests(id, buyer_id)').eq('id', quoteId).single();
  if (error || !quote) throw new HttpError(404, 'QUOTE_NOT_FOUND', 'Quote not found.');
  const buyerId = quote.request?.buyer_id;
  const travellerId = quote.traveller_id;
  if (!buyerId || !travellerId) throw new HttpError(409, 'QUOTE_INCOMPLETE', 'This quote is missing participant information.');
  if (req.user.id !== buyerId && req.user.id !== travellerId) {
    throw new HttpError(403, 'FORBIDDEN', 'Only the buyer and traveller for this quote can open a conversation.');
  }

  const { data: existing } = await supabase().from('conversations').select('*').eq('quote_id', quoteId).maybeSingle();
  if (existing) return res.json({ data: existing });

  const { data: convo, error: insertError } = await supabase().from('conversations')
    .insert({ quote_id: quoteId, buyer_id: buyerId, traveller_id: travellerId }).select('*').single();
  if (insertError) {
    // Race: another request created it. Return the existing one.
    if (insertError.code === '23505') {
      const { data: race } = await supabase().from('conversations').select('*').eq('quote_id', quoteId).maybeSingle();
      if (race) return res.json({ data: race });
    }
    throw insertError;
  }
  res.status(201).json({ data: convo });
});

// List the caller's conversations with unread counts and a latest-message preview.
conversationRouter.get('/conversations', requireAuth, requireRole('buyer', 'traveller'), async (req, res) => {
  if (useDemo()) {
    const data = await demoListConversationsForUser(req.user.id);
    return res.json({ data });
  }

  const { data: convos, error } = await supabase().from('conversations')
    .select('*').or(`buyer_id.eq.${req.user.id},traveller_id.eq.${req.user.id}`)
    .order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  if (!convos?.length) return res.json({ data: [] });

  const ids = convos.map((c) => c.id);
  const [readRes, msgRes] = await Promise.all([
    supabase().from('conversation_read_states').select('conversation_id, last_read_seq')
      .eq('user_id', req.user.id).in('conversation_id', ids),
    supabase().from('conversation_messages')
      .select('conversation_id, sender_id, body, seq, created_at')
      .in('conversation_id', ids).order('seq', { ascending: false }).limit(2000)
  ]);
  if (readRes.error) throw readRes.error;
  if (msgRes.error) throw msgRes.error;

  res.json({ data: buildConversationList(convos, msgRes.data ?? [], readRes.data ?? [], req.user.id) });
});

// Paginated messages for a conversation (newest-first, cursor = seq).
conversationRouter.get('/conversations/:id/messages', requireAuth, requireRole('buyer', 'traveller'), async (req, res) => {
  const conversationId = z.string().uuid().parse(req.params.id);
  const limit = clampLimit(req.query.limit);
  const before = req.query.before != null && req.query.before !== '' ? Number(req.query.before) : null;
  if (before != null && !Number.isFinite(before)) throw new HttpError(400, 'INVALID_CURSOR', 'before must be a message seq number.');

  if (useDemo()) {
    const { messages, nextCursor, hasMore } = await demoGetMessagesForConversation(conversationId, req.user.id, limit, before);
    return res.json({ data: messages, nextCursor, hasMore });
  }

  const convo = await demoGetConversationOr404(conversationId);
  assertParticipant(convo, req.user.id);

  let query = supabase().from('conversation_messages')
    .select('id, conversation_id, sender_id, body, seq, created_at')
    .eq('conversation_id', conversationId).order('seq', { ascending: false }).limit(limit + 1);
  if (before != null) query = query.lt('seq', before);
  const { data: rows, error } = await query;
  if (error) throw error;

  const page = shapeMessagePage(rows ?? [], limit);

  // Read receipts: mark the caller's own messages with whether the recipient read them.
  const otherId = otherParticipantId(convo, req.user.id);
  const { data: otherRead } = await supabase().from('conversation_read_states')
    .select('last_read_seq').eq('conversation_id', conversationId).eq('user_id', otherId).maybeSingle();
  const annotated = markReadByRecipient(page.messages, otherRead?.last_read_seq ?? 0, req.user.id);

  res.json({ data: annotated, nextCursor: page.nextCursor, hasMore: page.hasMore });
});

// Send a message. Sender identity is the verified caller; never a client value.
conversationRouter.post('/conversations/:id/messages', requireAuth, requireRole('buyer', 'traveller'), async (req, res) => {
  const conversationId = z.string().uuid().parse(req.params.id);
  const body = validateMessageBody(req.body?.body);

  if (useDemo()) {
    const sent = await demoSendMessageToConversation(conversationId, req.user.id, body);
    return res.status(201).json({ data: sent });
  }

  const convo = await demoGetConversationOr404(conversationId);
  assertParticipant(convo, req.user.id);

  const { data, error } = await supabase().from('conversation_messages')
    .insert({ conversation_id: conversationId, sender_id: req.user.id, body })
    .select('id, conversation_id, sender_id, body, seq, created_at').single();
  if (error) {
    // The DB trigger also enforces participant-only senders.
    if (String(error.message).includes('participant')) {
      throw new HttpError(403, 'FORBIDDEN', 'You are not a participant in this conversation.');
    }
    throw error;
  }
  res.status(201).json({ data });
});

// Mark the conversation read up to its latest message. Returns the caller's new cursor.
conversationRouter.patch('/conversations/:id/read', requireAuth, requireRole('buyer', 'traveller'), async (req, res) => {
  const conversationId = z.string().uuid().parse(req.params.id);

  if (useDemo()) {
    const result = await demoMarkConversationRead(conversationId, req.user.id);
    return res.json({ data: { conversationId, lastReadSeq: result.last_read_seq, unreadCount: 0 } });
  }

  const convo = await demoGetConversationOr404(conversationId);
  assertParticipant(convo, req.user.id);

  const { data: latest } = await supabase().from('conversation_messages')
    .select('seq').eq('conversation_id', conversationId).order('seq', { ascending: false }).limit(1).maybeSingle();
  const lastReadSeq = latest?.seq ?? 0;

  const { error } = await supabase().from('conversation_read_states')
    .upsert({ conversation_id: conversationId, user_id: req.user.id, last_read_seq: lastReadSeq, updated_at: new Date().toISOString() },
      { onConflict: 'conversation_id,user_id' });
  if (error) throw error;

  res.json({ data: { conversationId, lastReadSeq, unreadCount: 0 } });
});
