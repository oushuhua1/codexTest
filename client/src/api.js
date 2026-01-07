const DEFAULT_API_BASE = 'http://localhost:8787';

export function getApiBase() {
  const raw = import.meta?.env?.VITE_API_BASE;
  return typeof raw === 'string' && raw.trim() ? raw.trim().replace(/\/+$/, '') : DEFAULT_API_BASE;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  constructor(message, { status, code, detail } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function request(path, { method = 'GET', token, body } = {}) {
  const url = `${getApiBase()}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await readJsonResponse(response);
  if (!response.ok) {
    throw new ApiError(data?.error || 'request_failed', {
      status: response.status,
      code: data?.error,
      detail: data?.detail
    });
  }

  return data;
}

export async function login({ username, password }) {
  return request('/auth/login', { method: 'POST', body: { username, password } });
}

export async function listTodos({ token }) {
  return request('/todos', { method: 'GET', token });
}

export async function createTodo({ token, title }) {
  return request('/todos', { method: 'POST', token, body: { title } });
}

export async function patchTodo({ token, id, patch }) {
  return request(`/todos/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: patch });
}

export async function deleteTodo({ token, id }) {
  return request(`/todos/${encodeURIComponent(id)}`, { method: 'DELETE', token });
}

