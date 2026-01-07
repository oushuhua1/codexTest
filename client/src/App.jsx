import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, createTodo, deleteTodo, listTodos, login, patchTodo } from './api.js';

const FILTER_CONFIG = {
  all: { label: 'All', predicate: () => true },
  active: { label: 'Active', predicate: (todo) => !todo.completed },
  completed: { label: 'Completed', predicate: (todo) => todo.completed }
};

const FILTER_OPTIONS = Object.entries(FILTER_CONFIG).map(([value, config]) => ({
  value,
  label: config.label
}));

  const sanitizeTodos = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .filter((item) => typeof item?.title === 'string' && item.title.trim().length > 0)
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : String(item.id ?? ''),
      title: item.title.trim(),
      completed: Boolean(item.completed)
    }));
};

const sanitizeToken = (raw) => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value ? value : null;
};

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

const getValidFilter = (value) => (FILTER_CONFIG[value] ? value : 'all');

function App() {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return null;
    return sanitizeToken(window.localStorage.getItem('codex-todo-token'));
  });

  const [authDraft, setAuthDraft] = useState({ username: '', password: '' });
  const [authError, setAuthError] = useState('');

  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('all');

  const handleLogout = useCallback(() => {
    setToken(null);
    setTodos([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('codex-todo-token');
    }
  }, []);

  const refreshTodos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await listTodos({ token });
      setTodos(sanitizeTodos(data?.todos));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        handleLogout();
        setAuthError('Session expired. Please log in again.');
      } else {
        setErrorMessage('Failed to load todos.');
      }
    } finally {
      setLoading(false);
    }
  }, [handleLogout, token]);

  useEffect(() => {
    void refreshTodos();
  }, [refreshTodos]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError('');
    setErrorMessage('');
    const username = authDraft.username.trim();
    const password = authDraft.password;
    if (!username || !password) {
      setAuthError('Enter username and password.');
      return;
    }

    setLoading(true);
    try {
      const data = await login({ username, password });
      if (!data?.token) {
        setAuthError('Login failed.');
        return;
      }
      const nextToken = sanitizeToken(data.token);
      if (!nextToken) {
        setAuthError('Login failed.');
        return;
      }
      setToken(nextToken);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('codex-todo-token', nextToken);
      }
      setAuthDraft({ username: '', password: '' });
    } catch {
      setAuthError('Invalid credentials or server misconfigured.');
    } finally {
      setLoading(false);
    }
  };

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
    const title = draft.trim();
    if (!title || !token) return;

    setLoading(true);
    setErrorMessage('');
    void (async () => {
      try {
        const data = await createTodo({ token, title });
        if (data?.todo) {
          setTodos((prev) => [data.todo, ...prev]);
          setDraft('');
          setFilter('all');
        } else {
          await refreshTodos();
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          handleLogout();
          setAuthError('Session expired. Please log in again.');
        } else {
          setErrorMessage('Failed to add todo.');
        }
      } finally {
        setLoading(false);
      }
    })();
  };

  const handleFilterChange = (value) => {
    setFilter(getValidFilter(value));
  };

  const toggleTodo = useCallback(
    (id, completed) => {
      if (!token) return;
      setErrorMessage('');
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, completed: !completed } : todo))
      );

      void (async () => {
        try {
          const data = await patchTodo({ token, id, patch: { completed: !completed } });
          if (data?.todo) {
            setTodos((prev) => prev.map((todo) => (todo.id === id ? data.todo : todo)));
          }
        } catch (error) {
          await refreshTodos();
          if (error instanceof ApiError && error.status === 401) {
            handleLogout();
            setAuthError('Session expired. Please log in again.');
          } else {
            setErrorMessage('Failed to update todo.');
          }
        }
      })();
    },
    [handleLogout, refreshTodos, token]
  );

  const removeTodo = useCallback(
    (id) => {
      if (!token) return;
      setErrorMessage('');
      const snapshot = todos;
      setTodos((prev) => prev.filter((todo) => todo.id !== id));

      void (async () => {
        try {
          await deleteTodo({ token, id });
        } catch (error) {
          setTodos(snapshot);
          if (error instanceof ApiError && error.status === 401) {
            handleLogout();
            setAuthError('Session expired. Please log in again.');
          } else {
            setErrorMessage('Failed to delete todo.');
          }
        }
      })();
    },
    [handleLogout, token, todos]
  );

  const clearCompleted = useCallback(() => {
    if (!token) return;
    const completed = todos.filter((todo) => todo.completed);
    if (completed.length === 0) return;

    setErrorMessage('');
    setLoading(true);
    void (async () => {
      try {
        await Promise.all(completed.map((todo) => deleteTodo({ token, id: todo.id })));
        await refreshTodos();
      } catch (error) {
        await refreshTodos();
        if (error instanceof ApiError && error.status === 401) {
          handleLogout();
          setAuthError('Session expired. Please log in again.');
        } else {
          setErrorMessage('Failed to clear completed todos.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [handleLogout, refreshTodos, token, todos]);

  return (
    <div className="app">
      <main>
        <h1>Codex Todo</h1>
        <p className="muted">
          Simple React todo list backed by a JWT-authenticated REST API.
        </p>

        <section className="card todo-card">
          {!token ? (
            <form onSubmit={handleLogin} className="todo-form" aria-label="Login">
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={authDraft.username}
                placeholder="Username"
                onChange={(event) =>
                  setAuthDraft((prev) => ({ ...prev, username: event.target.value }))
                }
                autoComplete="username"
              />
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={authDraft.password}
                placeholder="Password"
                onChange={(event) =>
                  setAuthDraft((prev) => ({ ...prev, password: event.target.value }))
                }
                autoComplete="current-password"
              />
              <button type="submit" className="primary" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              {authError ? <p className="empty-state">{authError}</p> : null}
            </form>
          ) : null}

          {token ? (
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
              disabled={loading}
            />
            <button type="submit" className="primary" disabled={loading}>
              {loading ? 'Working…' : 'Add'}
            </button>
          </form>
          ) : null}

          {token ? (
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
                  disabled={loading}
                >
                  Clear completed ({completedCount})
                </button>
              )}

              <button
                type="button"
                className="export-button"
                onClick={exportTodos}
                disabled={loading}
              >
                Export CSV
              </button>

              <button type="button" className="text-button" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
          ) : null}

          {token && errorMessage ? <p className="empty-state">{errorMessage}</p> : null}

          {token && showEmptyState ? (
            <p className="empty-state">{emptyStateMessage}</p>
          ) : token ? (
            <ul className="todo-list">
              {visibleTodos.map((todo) => (
                <li key={todo.id} className={todo.completed ? 'completed' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id, todo.completed)}
                      disabled={loading}
                    />
                    <span>{todo.title}</span>
                  </label>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => removeTodo(todo.id)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>

      <footer>
        <span>Built with React + Vite + a minimal Node.js API.</span>
      </footer>
    </div>
  );
}

export default App;
