import { HttpError } from '../utils/httpError.js';

/**
 * Pure authorization + pagination helpers for conversations.
 * The route layer performs all database/storage IO; these functions are kept
 * side-effect free so they can be unit tested without a live Supabase instance.
 */

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_PAGE_MAX = 100;

/**
 * ---------------------------------------------------------------------------
 * Demo (in-memory) conversation store.
 * Used when MOCK_MESSAGING is true and Supabase is unavailable.
 * All state lives in module memory; it resets when the module is reloaded.
 * ---------------------------------------------------------------------------
 */

const demoConvs = new Map();   // id -> conversation row
const demoMsgs = new Map();    // id -> message row
const demoRead = new Map();    // "${conversationId}:${userId}" -> { last_read_seq, updated_at }

let demoSeqCounter = 0;

export function demoNextSeq() {
  return ++demoSeqCounter;
}

export function demoCreateConversation(quoteId, buyerId, travellerId) {
  const id = `demo-conv-${demoConvs.size + 1}`;
  const now = new Date().toISOString();
  const row = {
    id,
    quote_id: quoteId,
    buyer_id: buyerId,
    traveller_id: travellerId,
    created_at: now,
  };
  demoConvs.set(id, row);
  return row;
}

export function demoGetConversation(id) {
  return demoConvs.get(id) ?? null;
}

export function demoGetConversationByQuote(quoteId) {
  for (const c of demoConvs.values()) {
    if (c.quote_id === quoteId) return c;
  }
  return null;
}

export function demoListConversations(userId) {
  return [...demoConvs.values()].filter(
    (c) => c.buyer_id === userId || c.traveller_id === userId
  ).sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

export function demoGetMessages(conversationId, limit, beforeSeq) {
  let rows = [...demoMsgs.values()].filter((m) => m.conversation_id === conversationId);
  rows.sort((a, b) => Number(b.seq) - Number(a.seq));
  if (beforeSeq != null) {
    rows = rows.filter((m) => Number(m.seq) < Number(beforeSeq));
  }
  const lim = Math.trunc(Number(limit)) || MESSAGE_PAGE_MAX;
  const hasMore = rows.length > lim;
  const page = hasMore ? rows.slice(0, lim) : rows;
  const nextCursor = hasMore && page.length ? page[page.length - 1].seq : null;
  return { messages: page, nextCursor, hasMore };
}

export function demoSendMessage(conversationId, senderId, body) {
  const seq = demoNextSeq();
  const now = new Date().toISOString();
  const id = `demo-msg-${demoMsgs.size + 1}`;
  const row = {
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    seq,
    created_at: now,
  };
  demoMsgs.set(id, row);
  return row;
}

export function demoGetReadState(conversationId, userId) {
  return demoRead.get(`${conversationId}:${userId}`) ?? { last_read_seq: 0 };
}

export function demoSetReadState(conversationId, userId, lastReadSeq) {
  const key = `${conversationId}:${userId}`;
  demoRead.set(key, {
    last_read_seq: Number(lastReadSeq),
    updated_at: new Date().toISOString(),
  });
  return demoRead.get(key);
}

export function demoReset() {
  demoConvs.clear();
  demoMsgs.clear();
  demoRead.clear();
  demoSeqCounter = 0;
}

export function isParticipant(conversation, userId) {
  return Boolean(conversation) && (conversation.buyer_id === userId || conversation.traveller_id === userId);
}

export function assertParticipant(conversation, userId) {
  if (!conversation) throw new HttpError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  if (!isParticipant(conversation, userId)) {
    throw new HttpError(403, 'FORBIDDEN', 'You are not a participant in this conversation.');
  }
  return conversation;
}

export function otherParticipantId(conversation, userId) {
  if (!conversation) return null;
  return conversation.buyer_id === userId ? conversation.traveller_id : conversation.buyer_id;
}

/** Clamp and coerce a page limit into the allowed 1..MESSAGE_PAGE_MAX range. */
export function clampLimit(limit, fallback = 50, max = MESSAGE_PAGE_MAX) {
  const n = Math.trunc(Number(limit));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, 1), max);
}

/**
 * Shape a fetched message page (ordered newest-first) into a cursor result.
 * The route fetches `limit + 1` rows; a longer row count signals another page.
 */
export function shapeMessagePage(rows, limit) {
  const lim = clampLimit(limit);
  const hasMore = rows.length > lim;
  const page = hasMore ? rows.slice(0, lim) : rows;
  const nextCursor = hasMore && page.length ? page[page.length - 1].seq : null;
  return { messages: page, nextCursor, hasMore };
}

/**
 * Annotate each message with a read receipt. A message the caller sent is
 * `readByRecipient` = true once the other participant's read cursor reached it.
 * Messages from the other participant are not applicable (null).
 */
export function markReadByRecipient(messages, otherLastReadSeq, userId) {
  const threshold = Number(otherLastReadSeq ?? 0);
  return messages.map((m) => ({
    ...m,
    readByRecipient: m.sender_id === userId ? Number(m.seq) <= threshold : null
  }));
}

/** Count unread (incoming, after the cursor) messages per conversation. */
export function computeUnreadCounts(messages, readSeqByConversation) {
  const counts = {};
  for (const m of messages) {
    const lastRead = Number(readSeqByConversation?.[m.conversation_id] ?? 0);
    if (Number(m.seq) > lastRead) {
      counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1;
    }
  }
  return counts;
}

/** Build the conversations list response from fetched rows + the caller's read map. */
export function buildConversationList(conversations, messages, readStates, userId) {
  const readMap = {};
  for (const r of readStates) readMap[r.conversation_id] = Number(r.last_read_seq ?? 0);
  // messages newest-first; keep the first seen per conversation as its latest.
  const latestByConvo = {};
  for (const m of messages) {
    if (!latestByConvo[m.conversation_id]) latestByConvo[m.conversation_id] = m;
  }
  const unread = computeUnreadCounts(
    messages.filter((m) => m.sender_id !== userId),
    readMap
  );
  return conversations.map((c) => {
    const last = latestByConvo[c.id] ?? null;
    return {
      id: c.id,
      quoteId: c.quote_id,
      buyerId: c.buyer_id,
      travellerId: c.traveller_id,
      otherParticipantId: otherParticipantId(c, userId),
      lastReadSeq: readMap[c.id] ?? 0,
      unreadCount: unread[c.id] ?? 0,
      lastMessage: last
        ? { seq: last.seq, senderId: last.sender_id, body: last.body, createdAt: last.created_at }
        : null,
      createdAt: c.created_at
    };
  });
}

export function validateMessageBody(body) {
  const text = typeof body === 'string' ? body.trim() : '';
  if (text.length < 1) throw new HttpError(400, 'EMPTY_MESSAGE', 'Message body cannot be empty.');
  if (text.length > MESSAGE_MAX_LENGTH) {
    throw new HttpError(400, 'MESSAGE_TOO_LONG', `Message body exceeds the ${MESSAGE_MAX_LENGTH} character limit.`);
  }
  return text;
}