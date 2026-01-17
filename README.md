# Melann Lending – Loan Monitoring System

## Overview
A web‑based loan collection, monitoring and reporting platform that replaces the legacy Excel tracker.  The repository contains:

- **PostgreSQL schema** (`schema.sql`)
- **Node/Express backend** (`src/`)
- **Environment file** (`.env` – **do not commit**)
- **Simple front‑end** (`client/`)
- **System flow diagram** (generated image)

The UI mimics a spreadsheet‑style grid with colour‑coded statuses, filters, and export buttons.

---

## Prerequisites
- **Node.js** ≥ 18
- **npm** (comes with Node) or **yarn**
- **PostgreSQL** ≥ 13
- **Git** (optional, for version control)

---

## Setup Steps
1. **Clone the repo** (if you haven’t already)
   ```bash
   git clone <repo‑url>
   cd AntiGravExer1
   ```
2. **Create the database**
   ```bash
   createdb melann_lending   # or use pgAdmin / psql
   psql -d melann_lending -f schema.sql
   ```
3. **Configure environment variables**
   - Copy the template and edit the password/secret:
   ```bash
   cp .env.example .env   # (the file already exists – just edit it)
   ```
   - Set `DB_PASSWORD` to your PostgreSQL password and change `JWT_SECRET` to a strong random string.
4. **Install backend dependencies**
   ```bash
   npm install   # reads package.json
   ```
5. **Run the API**
   ```bash
   npm run dev   # uses nodemon for hot‑reload
   ```
   The server will listen on `http://localhost:3000`.
6. **Open the front‑end**
   - Open `client/index.html` in a browser (or serve it with any static server, e.g. `npx serve client`).
   - The UI talks to the API at `http://localhost:3000/api/loans`.

---

## API Endpoints (protected by JWT)
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/loans` | List loans – supports query filters (collector_id, area, city, barangay, moving_status, location_status, month_reported, overdue) |
| `GET` | `/api/loans/:id` | Get a single loan |
| `POST` | `/api/loans` | Create a loan (validation & business rules) |
| `PUT` | `/api/loans/:id` | Update a loan |
| `DELETE` | `/api/loans/:id` | Delete – **admin only** |

Authentication: send `Authorization: Bearer <jwt>` header.  A separate login route can be added later.

---

## Front‑end Highlights
- Spreadsheet‑like grid (sticky header, colour‑coded status badges)
- Dropdowns for status & location fields
- Search bar with debounce
- Export buttons (PDF/Excel – hook into `/export` endpoints you can add later)
- Responsive layout for desktop use

The UI lives in `client/` and uses vanilla JavaScript + CSS (no framework).  Feel free to replace it with React/Vite later.

---

## Development Tips
- **Database migrations** – you can add a `migrations/` folder and use `node-pg-migrate` if the schema evolves.
- **Testing** – Jest + supertest works well for the Express routes.
- **Logging** – integrate `morgan` or `winston` for request/exception logging.
- **Cron job** – create a script `scripts/refresh_summary.js` and schedule it with Windows Task Scheduler (`node scripts/refresh_summary.js`).

---

## License
MIT – feel free to adapt and extend.
