import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDisposableDb } from './landing-demo-guard.mjs';

test('accepts a local disposable landing DB', () => {
  assert.doesNotThrow(() =>
    assertDisposableDb(
      'postgresql://bantai:x@localhost:5434/bantai_shield_landing_1',
    ),
  );
});

for (const url of [
  'postgresql://bantai:x@localhost:5434/bantai_db',
  'postgresql://bantai:x@localhost:5434/bantai_shield_qa',
  'postgresql://u:x@bantai-student.postgres.database.azure.com:5432/bantai_shield_landing_1',
  '',
]) {
  test(`refuses ${url || '(empty)'}`, () => {
    assert.throws(() => assertDisposableDb(url), /disposable/);
  });
}
