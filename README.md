# Codex Todo App

Lightweight React + Vite todo list that runs entirely in the browser. Tasks persist in `localStorage`, so there is no backend to set up.

## Features
- Add, complete, and delete todos with filtering between active/completed
- Clear finished tasks in one click
- Export the current todo list as a CSV file

## Quick Start
1. `cd client`
2. `npm install`
3. `npm run dev`
4. Open `http://localhost:5173`

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
- `.gitignore` — Ignores build artifacts and dependency folders

That’s it—the repository only contains the files required to develop and ship the todo app.
