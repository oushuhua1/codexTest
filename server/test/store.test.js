import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { TodoStore } from '../store.js';

test('TodoStore CRUD', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'todo-store-'));
  const dataFile = path.join(dir, 'data.json');
  const store = new TodoStore({ dataFile });

  const created = await store.addTodo({ username: 'alice', title: 'Test' });
  assert.equal(created.title, 'Test');
  assert.equal(created.completed, false);

  const list1 = await store.listTodos({ username: 'alice' });
  assert.equal(list1.length, 1);

  const updated = await store.updateTodo({
    username: 'alice',
    id: created.id,
    patch: { completed: true }
  });
  assert.equal(updated.completed, true);

  await store.deleteTodo({ username: 'alice', id: created.id });
  const list2 = await store.listTodos({ username: 'alice' });
  assert.equal(list2.length, 0);
});

