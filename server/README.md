# Todo Backend (Node, no deps)

Minimal REST API + file persistence + JWT (HS256) authentication.

## Requirements
- Node.js 18+

## Configure
Copy and edit:

```bash
cp server/.env.example server/.env
```

Environment variables:
- `TODO_PORT` (default: `8787`)
- `TODO_JWT_SECRET` (required for auth; set a long random string)
- `TODO_USER` (default: `admin`)
- `TODO_PASSWORD` (default: `admin`)
- `TODO_CORS_ORIGIN` (default: `http://localhost:5173`)
- `TODO_DATA_FILE` (default: `./data.json`)

## Run

```bash
cd server
npm run dev
```

## API

### Auth
- `POST /auth/login` → `{ "token": "..." }`
  - body: `{ "username": "...", "password": "..." }`

Use: `Authorization: Bearer <token>`

### Todos (auth required)
- `GET /todos` → `{ "todos": [...] }`
- `POST /todos` → `{ "todo": {...} }` body: `{ "title": "..." }`
- `PATCH /todos/:id` → `{ "todo": {...} }` body: `{ "title"?: "...", "completed"?: true|false }`
- `DELETE /todos/:id` → `{ "deleted": true }`

### Health
- `GET /health` → `{ "ok": true }`

