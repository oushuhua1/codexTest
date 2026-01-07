import { URL } from 'node:url';

export function getRequestUrl(req) {
  const base = `http://${req.headers.host || 'localhost'}`;
  return new URL(req.url || '/', base);
}

export async function readJson(req, { limitBytes = 1_000_000 } = {}) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      throw Object.assign(new Error('payload_too_large'), { status: 413 });
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return null;

  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('invalid_json'), { status: 400 });
  }
}

export function sendJson(res, status, body, headers = {}) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
    ...headers
  });
  res.end(json);
}

export function sendEmpty(res, status, headers = {}) {
  res.writeHead(status, { ...headers });
  res.end();
}

