import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTransition } from '../src/services/stateMachine.js';

test('allows the normal order lifecycle', () => {
  assert.equal(assertTransition('ACCEPTED', 'LOCKED'), true);
  assert.equal(assertTransition('LOCKED', 'PURCHASED'), true);
  assert.equal(assertTransition('PURCHASED', 'LANDED'), true);
  assert.equal(assertTransition('LANDED', 'COMPLETED'), true);
});

test('allows expiry and dispute entry, but keeps dispute on hold', () => {
  assert.equal(assertTransition('ACCEPTED', 'EXPIRED'), true);
  assert.equal(assertTransition('LOCKED', 'DISPUTED'), true);
  assert.equal(assertTransition('LANDED', 'FORFEITED'), true);
  assert.throws(() => assertTransition('LOCKED', 'FORFEITED'), { code: 'INVALID_ORDER_TRANSITION' });
  assert.throws(() => assertTransition('DISPUTED', 'COMPLETED'), { code: 'INVALID_ORDER_TRANSITION' });
  assert.throws(() => assertTransition('DISPUTED', 'FORFEITED'), { code: 'INVALID_ORDER_TRANSITION' });
});

test('rejects skipped/reversed/final-state transitions', () => {
  for (const [from, to] of [['ACCEPTED', 'PURCHASED'], ['LOCKED', 'COMPLETED'], ['COMPLETED', 'DISPUTED'], ['FORFEITED', 'LOCKED'], ['EXPIRED', 'LOCKED']]) {
    assert.throws(() => assertTransition(from, to), { code: 'INVALID_ORDER_TRANSITION' });
  }
});
