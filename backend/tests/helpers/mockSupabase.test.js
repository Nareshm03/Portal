import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockSupabase } from './mockSupabase.js';

test('createMockSupabase: range pagination offset and limit', async () => {
  // Create a dataset with 5 rows
  const testUuid = (n) => `${n.toString().padStart(8, '0')}-1111-4111-8111-111111111111`;
  const rows = [];
  for (let i = 0; i < 5; i++) {
    rows.push({ id: testUuid(i + 1), index: i, value: `row-${i}` });
  }

  const db = createMockSupabase({
    test_table: { data: rows, error: null }
  });

  // Test range(0, 2) - should return 3 rows starting at index 0
  const res0 = await db.from('test_table').range(0, 2).select('*');
  assert.equal(res0.data.length, 3, 'range(0,2) should return 3 rows');
  assert.equal(res0.data[0].index, 0, 'First row should have index 0');
  assert.equal(res0.data[2].index, 2, 'Third row should have index 2');

  // Test range(2, 4) - should return 3 rows starting at index 2
  const res1 = await db.from('test_table').range(2, 4).select('*');
  assert.equal(res1.data.length, 3, 'range(2,4) should return 3 rows');
  assert.equal(res1.data[0].index, 2, 'First row should have index 2');
  assert.equal(res1.data[2].index, 4, 'Third row should have index 4');
});

test('createMockSupabase: range(2, 3) returns exactly two records at indices 2 and 3', async () => {
  // Create a dataset with 5+ rows
  const testUuid = (n) => `${n.toString().padStart(8, '0')}-1111-4111-8111-111111111111`;
  const rows = [];
  for (let i = 0; i < 5; i++) {
    rows.push({ id: testUuid(i + 1), index: i, value: `row-${i}` });
  }

  const db = createMockSupabase({
    test_table: { data: rows, error: null }
  });

  // range(2, 3) should return 2 rows (indices 2 and 3)
  const res = await db.from('test_table').range(2, 3).select('*');
  assert.equal(res.data.length, 2, 'range(2,3) should return exactly 2 rows');
  assert.equal(res.data[0].index, 2, 'First row should have index 2');
  assert.equal(res.data[1].index, 3, 'Second row should have index 3');
});