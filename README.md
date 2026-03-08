# my-own-page

A personal homepage styled as a classified dossier — dark paper textures, ruled lines, and monospace type. Two pages, one backend.

## Pages

**`frontend/A1RER.html`** — Main dossier page

- Dynamic feed / update log
- Public guestbook (anyone can leave a message)
- Project tracker with progress bars
- Password-locked section (LEVEL-2 clearance) served via the backend API

**`frontend/githubpage.html`** — GitHub Intel

- Recent commit history via GitHub public events API
- Repository list
- Language distribution (aggregated across repos)
- Contribution heatmap (last 52 weeks)
- No authentication required — uses the public API with unauthenticated rate limit (60 req/hr)

## Tech Stack

| Layer    | What                                      |
|----------|-------------------------------------------|
| Frontend | Vanilla HTML / CSS / JS — no build step   |
| Fonts    | IBM Plex Mono · Special Elite · Noto Serif SC |
| Backend  | Node.js + Express                         |
| Auth     | JWT (2 h expiry) + bcrypt password hash   |
| Database | MySQL 8                                   |

## Project Structure

```
my-own-page/
├── frontend/
│   ├── A1RER.html          # Main dossier page
│   └── githubpage.html     # GitHub intel page
└── backend/
    ├── server.js           # Express API
    ├── db.js               # MySQL connection pool
    ├── .env.example        # Environment variable template
    └── package.json
```

## Backend API

| Method   | Route                 | Auth | Description              |
|----------|-----------------------|------|--------------------------|
| POST     | `/api/unlock`         | —    | Password check, returns JWT + classified content |
| GET      | `/api/verify`         | JWT  | Validate token           |
| GET      | `/api/feed`           | —    | List feed items          |
| POST     | `/api/feed`           | JWT  | Add feed item            |
| DELETE   | `/api/feed/:id`       | JWT  | Delete feed item         |
| GET      | `/api/messages`       | —    | List guestbook messages  |
| POST     | `/api/messages`       | —    | Post a message           |
| DELETE   | `/api/messages/:id`   | JWT  | Delete a message         |
| GET      | `/api/projects`       | —    | List projects            |
| PATCH    | `/api/projects/:id`   | JWT  | Update project progress  |
| GET      | `/api/health`         | —    | Health check             |

Login is rate-limited to 10 attempts per IP per minute.

## Setup

### 1. Database

Create a MySQL database and the required tables:

```sql
CREATE DATABASE a1rer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE a1rer;

CREATE TABLE feed_items (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  date_label VARCHAR(50)  NOT NULL,
  content    TEXT         NOT NULL,
  highlight  VARCHAR(100) DEFAULT NULL,
  pinned     TINYINT(1)   DEFAULT 0,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nickname   VARCHAR(50)  NOT NULL,
  content    VARCHAR(500) NOT NULL,
  ip         VARCHAR(45)  DEFAULT NULL,
  created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE projects (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  status      VARCHAR(50)  DEFAULT 'active',
  progress    INT          DEFAULT 0
);
```

### 2. Environment

```bash
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

```env
UNLOCK_PASSWORD=your_strong_password
JWT_SECRET=your_jwt_secret
PORT=3001
FRONTEND_ORIGIN=http://127.0.0.1:5500
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=a1rer
```

### 3. Start the backend

```bash
cd backend
npm install
npm start          # production
npm run dev        # development (nodemon)
```

### 4. Serve the frontend

Open `frontend/A1RER.html` with any static server or browser.

For local development with Live Server (VS Code default port):

```
FRONTEND_ORIGIN=http://127.0.0.1:5500
```

---

Built with vibe coding.
