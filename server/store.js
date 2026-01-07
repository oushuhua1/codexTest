import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_STATE = { version: 1, users: {} };

async function readState(dataFile) {
  try {
    const raw = await fs.readFile(dataFile, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return structuredClone(DEFAULT_STATE);
    if (!parsed.users || typeof parsed.users !== 'object') parsed.users = {};
    if (parsed.version !== 1) parsed.version = 1;
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') return structuredClone(DEFAULT_STATE);
    throw error;
  }
}

async function writeStateAtomic(dataFile, state) {
  const dir = path.dirname(dataFile);
  await fs.mkdir(dir, { recursive: true });
  const tempFile = path.join(dir, `.tmp-${path.basename(dataFile)}-${crypto.randomUUID()}`);
  await fs.writeFile(tempFile, JSON.stringify(state, null, 2), 'utf8');
  await fs.rename(tempFile, dataFile);
}

function normalizeTodos(todos) {
  if (!Array.isArray(todos)) return [];
  return todos
    .filter((todo) => typeof todo?.title === 'string' && todo.title.trim())
    .map((todo) => ({
      id: typeof todo.id === 'string' ? todo.id : crypto.randomUUID(),
      title: todo.title.trim(),
      completed: Boolean(todo.completed)
    }));
}

export class TodoStore {
  constructor({ dataFile }) {
    this.dataFile = dataFile;
  }

  async listTodos({ username }) {
    const state = await readState(this.dataFile);
    const user = state.users[username] ?? { todos: [] };
    const todos = normalizeTodos(user.todos);
    if (user.todos !== todos) {
      state.users[username] = { todos };
      await writeStateAtomic(this.dataFile, state);
    }
    return todos;
  }

  async addTodo({ username, title }) {
    const normalized = String(title ?? '').trim();
    if (!normalized) {
      throw Object.assign(new Error('title_required'), { status: 400 });
    }

    const state = await readState(this.dataFile);
    const user = state.users[username] ?? { todos: [] };
    const todos = normalizeTodos(user.todos);

    const todo = { id: crypto.randomUUID(), title: normalized, completed: false };
    const nextTodos = [todo, ...todos];

    state.users[username] = { todos: nextTodos };
    await writeStateAtomic(this.dataFile, state);
    return todo;
  }

  async updateTodo({ username, id, patch }) {
    if (!id) {
      throw Object.assign(new Error('id_required'), { status: 400 });
    }

    const state = await readState(this.dataFile);
    const user = state.users[username] ?? { todos: [] };
    const todos = normalizeTodos(user.todos);

    const index = todos.findIndex((todo) => todo.id === id);
    if (index === -1) {
      throw Object.assign(new Error('not_found'), { status: 404 });
    }

    const existing = todos[index];
    const next = { ...existing };
    if (patch && typeof patch === 'object') {
      if (Object.hasOwn(patch, 'title')) {
        const normalized = String(patch.title ?? '').trim();
        if (!normalized) {
          throw Object.assign(new Error('title_required'), { status: 400 });
        }
        next.title = normalized;
      }
      if (Object.hasOwn(patch, 'completed')) {
        next.completed = Boolean(patch.completed);
      }
    }

    const nextTodos = todos.slice();
    nextTodos[index] = next;

    state.users[username] = { todos: nextTodos };
    await writeStateAtomic(this.dataFile, state);
    return next;
  }

  async deleteTodo({ username, id }) {
    if (!id) {
      throw Object.assign(new Error('id_required'), { status: 400 });
    }

    const state = await readState(this.dataFile);
    const user = state.users[username] ?? { todos: [] };
    const todos = normalizeTodos(user.todos);
    const nextTodos = todos.filter((todo) => todo.id !== id);

    if (nextTodos.length === todos.length) {
      throw Object.assign(new Error('not_found'), { status: 404 });
    }

    state.users[username] = { todos: nextTodos };
    await writeStateAtomic(this.dataFile, state);
    return true;
  }
}

