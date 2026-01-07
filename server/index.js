import http from 'node:http';
import path from 'node:path';

import { loadDotEnv } from './lib/env.js';
import { getRequestUrl, readJson, sendEmpty, sendJson } from './lib/http.js';
import { signJwtHs256, verifyJwtHs256 } from './lib/jwt.js';
import { TodoStore } from './store.js';

await loadDotEnv(new URL('.env', import.meta.url));

const port = Number.parseInt(process.env.TODO_PORT || '8787', 10);
const corsOrigin = process.env.TODO_CORS_ORIGIN || 'http://localhost:5173';
const jwtSecret = process.env.TODO_JWT_SECRET || '';
const expectedUser = process.env.TODO_USER || 'admin';
const expectedPassword = process.env.TODO_PASSWORD || 'admin';
const dataFile = process.env.TODO_DATA_FILE || './data.json';

const store = new TodoStore({ dataFile: path.resolve(dataFile) });

function isJwtSecretValid(secret) {
  return typeof secret === 'string' && secret.length >= 16;
}

function withCorsHeaders(req, extra = {}) {
  const origin = req.headers.origin;
  const allowOrigin = origin && origin === corsOrigin ? origin : corsOrigin;
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
    ...extra
  };
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1] || null;
}

function requireAuth(req, res) {
  if (!isJwtSecretValid(jwtSecret)) {
    sendJson(
      res,
      500,
      { error: 'server_misconfigured', detail: 'TODO_JWT_SECRET must be set (>= 16 chars)' },
      withCorsHeaders(req)
    );
    return null;
  }

  const token = getBearerToken(req);
  const result = verifyJwtHs256(token, jwtSecret);
  if (!result.ok) {
    sendJson(res, 401, { error: 'unauthorized', detail: result.error }, withCorsHeaders(req));
    return null;
  }

  const username = String(result.payload?.sub || '');
  if (!username) {
    sendJson(res, 401, { error: 'unauthorized', detail: 'missing_sub' }, withCorsHeaders(req));
    return null;
  }

  return { username };
}

function matchRoute(method, pathname, pattern) {
  if (method !== pattern.method) return null;
  const parts = pathname.split('/').filter(Boolean);
  const patternParts = pattern.path.split('/').filter(Boolean);
  if (parts.length !== patternParts.length) return null;

  const params = {};
  for (let i = 0; i < parts.length; i += 1) {
    const token = patternParts[i];
    if (token.startsWith(':')) {
      params[token.slice(1)] = decodeURIComponent(parts[i]);
      continue;
    }
    if (parts[i] !== token) return null;
  }
  return params;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = getRequestUrl(req);

    if (req.method === 'OPTIONS') {
      sendEmpty(res, 204, withCorsHeaders(req));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      sendJson(res, 200, { ok: true }, withCorsHeaders(req));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/auth/login') {
      if (!isJwtSecretValid(jwtSecret)) {
        sendJson(
          res,
          500,
          { error: 'server_misconfigured', detail: 'TODO_JWT_SECRET must be set (>= 16 chars)' },
          withCorsHeaders(req)
        );
        return;
      }

      const body = (await readJson(req)) ?? {};
      const username = String(body.username ?? '');
      const password = String(body.password ?? '');

      if (username !== expectedUser || password !== expectedPassword) {
        sendJson(res, 401, { error: 'invalid_credentials' }, withCorsHeaders(req));
        return;
      }

      const token = signJwtHs256({ sub: username }, jwtSecret, { expiresInSeconds: 60 * 60 * 8 });
      sendJson(res, 200, { token }, withCorsHeaders(req));
      return;
    }

    const todosParams = matchRoute(req.method, url.pathname, { method: 'GET', path: '/todos' });
    if (todosParams) {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const todos = await store.listTodos({ username: auth.username });
      sendJson(res, 200, { todos }, withCorsHeaders(req));
      return;
    }

    const createParams = matchRoute(req.method, url.pathname, { method: 'POST', path: '/todos' });
    if (createParams) {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const body = (await readJson(req)) ?? {};
      const todo = await store.addTodo({ username: auth.username, title: body.title });
      sendJson(res, 201, { todo }, withCorsHeaders(req));
      return;
    }

    const patchParams = matchRoute(req.method, url.pathname, { method: 'PATCH', path: '/todos/:id' });
    if (patchParams) {
      const auth = requireAuth(req, res);
      if (!auth) return;
      const body = (await readJson(req)) ?? {};
      const todo = await store.updateTodo({ username: auth.username, id: patchParams.id, patch: body });
      sendJson(res, 200, { todo }, withCorsHeaders(req));
      return;
    }

    const deleteParams = matchRoute(req.method, url.pathname, { method: 'DELETE', path: '/todos/:id' });
    if (deleteParams) {
      const auth = requireAuth(req, res);
      if (!auth) return;
      await store.deleteTodo({ username: auth.username, id: deleteParams.id });
      sendJson(res, 200, { deleted: true }, withCorsHeaders(req));
      return;
    }

    sendJson(res, 404, { error: 'not_found' }, withCorsHeaders(req));
  } catch (error) {
    const status = typeof error?.status === 'number' ? error.status : 500;
    const message = status === 500 ? 'internal_error' : error.message;
    sendJson(res, status, { error: message }, withCorsHeaders(req));
  }
});

server.listen(port, () => {
  console.log(`Todo backend listening on http://localhost:${port}`);
});
