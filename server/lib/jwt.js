import crypto from 'node:crypto';
import { base64UrlDecodeToBuffer, base64UrlEncode } from './base64url.js';

function timingSafeEqual(a, b) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

function hmacSha256(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest();
}

export function signJwtHs256(payload, secret, { expiresInSeconds = 60 * 60 } = {}) {
  if (!secret || String(secret).length < 16) {
    throw new Error('TODO_JWT_SECRET must be set and at least 16 characters');
  }

  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: nowSeconds,
    exp: nowSeconds + expiresInSeconds
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = base64UrlEncode(hmacSha256(secret, signingInput));

  return `${signingInput}.${signature}`;
}

export function verifyJwtHs256(token, secret) {
  if (!token) return { ok: false, error: 'missing_token' };

  const parts = String(token).split('.');
  if (parts.length !== 3) return { ok: false, error: 'invalid_format' };

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecodeToBuffer(encodedHeader).toString('utf8'));
    payload = JSON.parse(base64UrlDecodeToBuffer(encodedPayload).toString('utf8'));
  } catch {
    return { ok: false, error: 'invalid_json' };
  }

  if (header?.alg !== 'HS256' || header?.typ !== 'JWT') {
    return { ok: false, error: 'unsupported_header' };
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = base64UrlEncode(hmacSha256(secret, signingInput));
  if (!timingSafeEqual(expected, encodedSignature)) {
    return { ok: false, error: 'bad_signature' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload?.exp === 'number' && payload.exp <= nowSeconds) {
    return { ok: false, error: 'expired' };
  }

  return { ok: true, payload };
}
