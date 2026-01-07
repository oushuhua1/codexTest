# Codex Todo App

Lightweight React + Vite todo list. By default it runs entirely in the browser and persists tasks in `localStorage`.

This repo also includes an optional Node.js backend (`server/`) providing a REST API with file persistence + JWT auth.

## Features
- Add, complete, and delete todos with filtering between active/completed
- Clear finished tasks in one click
- Export the current todo list as a CSV file

## Quick Start
1. `cd client`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:5173`

## Optional Backend (REST + JWT)
1. `cp server/.env.example server/.env` (set `TODO_JWT_SECRET` to a long random string)
2. `cd server`
3. `npm run dev`

Backend docs and API details: `server/README.md`

## Connect Client → Backend
1. `cp client/.env.example client/.env` (set `VITE_API_BASE`, default: `http://localhost:8787`)
2. Restart `npm run dev` in `client/` if it was already running.

## Deploying to Vercel
1. Push this project to GitHub (or another git host).
2. In Vercel, choose **Add New Project** and import the repo.
3. Configure the build:
   - Framework: `Vite`
   - Root directory: `client`
   - Build command: `npm run build`
   - Output directory: `dist`
4. Deploy. Vercel will build the SPA and host the static assets automatically.

## Project Structure
- `client/` — React app source (all you need to run locally or deploy)
- `server/` — Node backend API (optional)
- `.gitignore` — Ignores build artifacts and dependency folders

That’s it—the repository only contains the files required to develop and ship the todo app.
