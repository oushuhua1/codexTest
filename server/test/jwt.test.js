import test from 'node:test';
import assert from 'node:assert/strict';

import { signJwtHs256, verifyJwtHs256 } from '../lib/jwt.js';

test('sign/verify roundtrip', () => {
  const secret = '0123456789abcdef0123456789abcdef';
  const token = signJwtHs256({ sub: 'alice' }, secret, { expiresInSeconds: 10 });
  const result = verifyJwtHs256(token, secret);
  assert.equal(result.ok, true);
  assert.equal(result.payload.sub, 'alice');
});

test('rejects expired token', async () => {
  const secret = '0123456789abcdef0123456789abcdef';
  const token = signJwtHs256({ sub: 'alice' }, secret, { expiresInSeconds: 1 });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const result = verifyJwtHs256(token, secret);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'expired');
});

