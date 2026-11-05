import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isParticipant,
  assertParticipant,
  otherParticipantId,
  clampLimit,
  shapeMessagePage,
  markReadByRecipient,
  computeUnreadCounts,
  buildConversationList,
  validateMessageBody,
  MESSAGE_MAX_LENGTH
} from '../src/services/conversations.js';

const convo = { id: 'c1', quote_id: 'q1', buyer_id: 'b', traveller_id: 't', created_at: 'now' };

test('participant authorization only allows the buyer or traveller', () => {
  assert.equal(isParticipant(convo, 'b'), true);
  assert.equal(isParticipant(convo, 't'), true);
  assert.equal(isParticipant(convo, 'x'), false);
  assert.equal(otherParticipantId(convo, 'b'), 't');
  assert.equal(otherParticipantId(convo, 't'), 'b');
});

test('assertParticipant throws 403 for non-participants', () => {
  assert.throws(() => assertParticipant(convo, 'x'), { code: 'FORBIDDEN' });
  assert.throws(() => assertParticipant(null, 'b'), { code: 'CONVERSATION_NOT_FOUND' });
  assert.equal(assertParticipant(convo, 'b').id, 'c1');
});

test('clampLimit coerces and bounds the page size', () => {
  assert.equal(clampLimit(2), 2);
  assert.equal(clampLimit(0), 50);
  assert.equal(clampLimit('abc'), 50);
  assert.equal(clampLimit(-3), 50);
  assert.equal(clampLimit(500), 100);
});

test('shapeMessagePage paginates newest-first with a seq cursor', () => {
  const rows = [5, 4, 3, 2, 1].map((seq) => ({ seq, body: `m${seq}` }));
  const page1 = shapeMessagePage(rows, 2);
  assert.deepEqual(page1.messages.map((m) => m.seq), [5, 4]);
  assert.equal(page1.hasMore, true);
  assert.equal(page1.nextCursor, 4);

  const pageLast = shapeMessagePage(rows, 5);
  assert.equal(pageLast.hasMore, false);
  assert.equal(pageLast.nextCursor, null);

  const pageOver = shapeMessagePage(rows.slice(0, 2), 2);
  assert.equal(pageOver.hasMore, false);
  assert.equal(pageOver.nextCursor, null);
});

test('markReadByRecipient flags the caller own messages once the recipient read them', () => {
  const msgs = [
    { seq: 1, sender_id: 'b', body: 'hi' },
    { seq: 2, sender_id: 't', body: 'yo' },
    { seq: 3, sender_id: 'b', body: 'later' }
  ];
  const marked = markReadByRecipient(msgs, 2, 'b');
  assert.equal(marked[0].readByRecipient, true);   // seq 1 <= 2 and sent by caller
  assert.equal(marked[1].readByRecipient, null);   // sent by other participant
  assert.equal(marked[2].readByRecipient, false);  // seq 3 > 2, not yet read
});

test('computeUnreadCounts counts incoming messages past the read cursor', () => {
  const incoming = [
    { conversation_id: 'c1', seq: 1, sender_id: 't' },
    { conversation_id: 'c1', seq: 3, sender_id: 't' },
    { conversation_id: 'c2', seq: 7, sender_id: 'x' }
  ];
  const counts = computeUnreadCounts(incoming, { c1: 1, c2: 7 });
  assert.deepEqual(counts, { c1: 1 }); // c1: only seq 3 past cursor; c2: nothing past 7
});

test('buildConversationList assembles previews, unread counts and the other participant', () => {
  const convos = [
    { ...convo, id: 'c1', buyer_id: 'b', traveller_id: 't', quote_id: 'q1', created_at: 't1' },
    { ...convo, id: 'c2', buyer_id: 'b', traveller_id: 'u', quote_id: 'q2', created_at: 't2' }
  ];
  const messages = [
    { conversation_id: 'c1', seq: 5, sender_id: 't', body: 'latest-c1', created_at: 'x5' },
    { conversation_id: 'c1', seq: 4, sender_id: 'b', body: 'older-c1', created_at: 'x4' },
    { conversation_id: 'c2', seq: 7, sender_id: 'u', body: 'latest-c2', created_at: 'y7' }
  ];
  const readStates = [{ conversation_id: 'c1', last_read_seq: 4 }, { conversation_id: 'c2', last_read_seq: 7 }];
  const list = buildConversationList(convos, messages, readStates, 'b');
  assert.equal(list.length, 2);
  const c1 = list.find((c) => c.id === 'c1');
  assert.equal(c1.otherParticipantId, 't');
  assert.equal(c1.unreadCount, 1);       // seq 5 from traveller past cursor 4
  assert.equal(c1.lastReadSeq, 4);
  assert.equal(c1.lastMessage.seq, 5);
  const c2 = list.find((c) => c.id === 'c2');
  assert.equal(c2.unreadCount, 0);       // seq 7 not past cursor 7
  assert.equal(c2.lastMessage.seq, 7);
});

test('validateMessageBody rejects empty and over-long messages', () => {
  assert.equal(validateMessageBody('  hi  '), 'hi');
  assert.throws(() => validateMessageBody(''), { code: 'EMPTY_MESSAGE' });
  assert.throws(() => validateMessageBody('   '), { code: 'EMPTY_MESSAGE' });
  assert.throws(() => validateMessageBody('a'.repeat(MESSAGE_MAX_LENGTH + 1)), { code: 'MESSAGE_TOO_LONG' });
});
