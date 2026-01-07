import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'codex-todo-items';

const FILTER_CONFIG = {
  all: { label: 'All', predicate: () => true },
  active: { label: 'Active', predicate: (todo) => !todo.completed },
  completed: { label: 'Completed', predicate: (todo) => todo.completed }
};

const FILTER_OPTIONS = Object.entries(FILTER_CONFIG).map(([value, config]) => ({
  value,
  label: config.label
}));

const generateId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const sanitizeTodos = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => typeof item?.title === 'string' && item.title.trim().length > 0)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : generateId(),
      title: item.title.trim(),
      completed: Boolean(item.completed)
    }));
};

const loadTodos = (storageKey) => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return [];
    }

    return sanitizeTodos(JSON.parse(raw));
  } catch {
    return [];
  }
};

const createTodo = (title) => ({
  id: generateId(),
  title,
  completed: false
});

const escapeCsvValue = (value) => {
  const text = String(value ?? '').replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
};

const buildCsvContent = (todos) => {
  const header = ['Title', 'Completed'];
  const rows = todos.map((todo) => [
    escapeCsvValue(todo.title),
    escapeCsvValue(todo.completed ? 'Completed' : 'Active')
  ]);

  return [header.map(escapeCsvValue).join(','), ...rows.map((row) => row.join(','))].join('\n');
};

const usePersistentTodos = (storageKey) => {
  const [todos, setTodos] = useState(() => loadTodos(storageKey));

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, JSON.stringify(todos));
    }
  }, [storageKey, todos]);

  const addTodo = useCallback((title) => {
    const normalized = title.trim();
    if (!normalized) {
      return false;
    }

    setTodos((prev) => [createTodo(normalized), ...prev]);
    return true;
  }, []);

  const toggleTodo = useCallback((id) => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    );
  }, []);

  const deleteTodo = useCallback((id) => {
    setTodos((prev) => prev.filter((todo) => todo.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setTodos((prev) => prev.filter((todo) => !todo.completed));
  }, []);

  return { todos, addTodo, toggleTodo, deleteTodo, clearCompleted };
};

const getValidFilter = (value) => (FILTER_CONFIG[value] ? value : 'all');

function App() {
  const { todos, addTodo, toggleTodo, deleteTodo, clearCompleted } =
    usePersistentTodos(STORAGE_KEY);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('all');

  const exportTodos = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const csvContent = buildCsvContent(todos);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];

    link.href = url;
    link.setAttribute('download', `codex-todos-${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [todos]);

  const activeFilter = getValidFilter(filter);
  const visibleTodos = useMemo(() => {
    const predicate = FILTER_CONFIG[activeFilter].predicate;
    return todos.filter(predicate);
  }, [activeFilter, todos]);

  const remainingCount = useMemo(
    () => todos.filter(FILTER_CONFIG.active.predicate).length,
    [todos]
  );
  const completedCount = todos.length - remainingCount;
  const hasTodos = todos.length > 0;
  const showEmptyState = visibleTodos.length === 0;

  let emptyStateMessage = 'No todos yet. Add your first task above.';
  if (hasTodos) {
    if (activeFilter === 'completed') {
      emptyStateMessage = 'No completed todos yet.';
    } else if (activeFilter === 'active') {
      emptyStateMessage = 'Enjoy the calm — nothing active here.';
    } else {
      emptyStateMessage = 'You are all caught up!';
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault();
    const created = addTodo(draft);

    if (created) {
      setDraft('');
      setFilter('all');
    }
  };

  const handleFilterChange = (value) => {
    setFilter(getValidFilter(value));
  };

  return (
    <div className="app">
      <main>
        <h1>Codex Todo</h1>
        <p className="muted">
          Simple React todo list that stores items locally and deploys neatly on Vercel.
        </p>

        <section className="card todo-card">
          <form onSubmit={handleSubmit} className="todo-form">
            <label htmlFor="todo-input" className="sr-only">
              Add a todo
            </label>
            <input
              id="todo-input"
              type="text"
              value={draft}
              placeholder="Add a new todo"
              onChange={(event) => setDraft(event.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="primary">
              Add
            </button>
          </form>

          <div className="todo-meta">
            <span className="muted">
              {remainingCount === 1 ? '1 task left' : `${remainingCount} tasks left`}
            </span>

            <div className="filters" aria-label="Filter todos">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={activeFilter === option.value ? 'active' : ''}
                  onClick={() => handleFilterChange(option.value)}
                  aria-pressed={activeFilter === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="todo-actions">
              {completedCount > 0 && (
                <button
                  type="button"
                  className="text-button"
                  onClick={clearCompleted}
                >
                  Clear completed ({completedCount})
                </button>
              )}

              <button
                type="button"
                className="export-button"
                onClick={exportTodos}
              >
                Export CSV
              </button>
            </div>
          </div>

          {showEmptyState ? (
            <p className="empty-state">{emptyStateMessage}</p>
          ) : (
            <ul className="todo-list">
              {visibleTodos.map((todo) => (
                <li key={todo.id} className={todo.completed ? 'completed' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                    />
                    <span>{todo.title}</span>
                  </label>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => deleteTodo(todo.id)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer>
        <span>Built with React + Vite. Ready for Vercel static hosting.</span>
      </footer>
    </div>
  );
}

export default App;
