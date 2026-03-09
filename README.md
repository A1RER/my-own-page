# my-own-page

[English](#english) · [中文](#中文)

---

## English

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

**`frontend/blog.html`** — Blog

- Public-facing article list and full article view
- Tag filtering
- Reads from the `/api/posts` endpoint

**`frontend/dashboard.html`** — Admin Dashboard

- Site analytics: total PV, today, this week, unique visitors
- 30-day daily PV/UV trend chart
- Top 20 pages by traffic
- Post and message management
- Requires JWT (LEVEL-2 clearance)

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
│   ├── githubpage.html     # GitHub intel page
│   ├── blog.html           # Blog
│   └── dashboard.html      # Admin dashboard
└── backend/
    ├── server.js           # Express API
    ├── db.js               # MySQL connection pool
    ├── .env.example        # Environment variable template
    └── package.json
```

## Backend API

| Method   | Route                     | Auth | Description              |
|----------|---------------------------|------|--------------------------|
| POST     | `/api/unlock`             | —    | Password check, returns JWT + classified content |
| GET      | `/api/verify`             | JWT  | Validate token           |
| GET      | `/api/feed`               | —    | List feed items          |
| POST     | `/api/feed`               | JWT  | Add feed item            |
| DELETE   | `/api/feed/:id`           | JWT  | Delete feed item         |
| GET      | `/api/messages`           | —    | List guestbook messages  |
| POST     | `/api/messages`           | —    | Post a message           |
| DELETE   | `/api/messages/:id`       | JWT  | Delete a message         |
| GET      | `/api/projects`           | —    | List projects            |
| PATCH    | `/api/projects/:id`       | JWT  | Update project progress  |
| GET      | `/api/posts`              | —    | List published posts     |
| GET      | `/api/posts/all`          | JWT  | List all posts (incl. drafts) |
| GET      | `/api/posts/:slug`        | —    | Get post detail (auto-increments views) |
| POST     | `/api/posts`              | JWT  | Create post              |
| PATCH    | `/api/posts/:slug`        | JWT  | Update post              |
| DELETE   | `/api/posts/:slug`        | JWT  | Delete post              |
| GET      | `/api/analytics/summary`  | JWT  | Stats overview           |
| GET      | `/api/analytics/trend`    | JWT  | 30-day daily PV/UV trend |
| GET      | `/api/analytics/pages`    | JWT  | Top 20 pages by traffic  |
| GET      | `/api/health`             | —    | Health check             |

Login is rate-limited to 10 attempts per IP per minute.

All GET requests are automatically recorded by the page-view tracking middleware (except `/api/health`, `/api/verify`, and `/api/analytics`).

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

CREATE TABLE posts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(200) NOT NULL UNIQUE,
  title       VARCHAR(200) NOT NULL,
  summary     TEXT,
  content     LONGTEXT     NOT NULL,
  tags        VARCHAR(500) DEFAULT NULL,
  status      ENUM('draft','published') DEFAULT 'draft',
  pinned      TINYINT(1)   DEFAULT 0,
  views       INT          DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE page_views (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  path        VARCHAR(500) NOT NULL,
  referrer    VARCHAR(500) DEFAULT NULL,
  ua          VARCHAR(500) DEFAULT NULL,
  ip          VARCHAR(45)  DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_path (path(100))
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

---

## 中文

个人主页，风格模拟机密档案袋——做旧纸张质感、横格线、等宽字体。两个页面，一个后端。

## 页面

**`frontend/A1RER.html`** — 主档案页

- 动态动态流 / 更新日志
- 公开留言板（任何人都可以留言）
- 项目进度追踪（带进度条）
- 密码锁定的机密区域（LEVEL-2 许可），内容由后端 API 下发

**`frontend/githubpage.html`** — GitHub 情报页

- 通过 GitHub 公开事件 API 拉取最近提交记录
- 仓库列表
- 编程语言分布（聚合全部仓库）
- 贡献热力图（近 52 周）
- 无需鉴权，使用公开 API（匿名限速 60 次/小时）

**`frontend/blog.html`** — 博客

- 公开的文章列表与详情页
- 标签筛选
- 数据来自 `/api/posts` 接口

**`frontend/dashboard.html`** — 管理后台

- 站点统计：总 PV、今日、本周、独立访客数
- 近 30 天每日 PV/UV 趋势图
- 访问量 Top 20 页面
- 文章与留言管理
- 需要 JWT 鉴权（LEVEL-2 许可）

## 技术栈

| 层级   | 内容                                          |
|--------|-----------------------------------------------|
| 前端   | 原生 HTML / CSS / JS，无需构建                |
| 字体   | IBM Plex Mono · Special Elite · Noto Serif SC |
| 后端   | Node.js + Express                             |
| 鉴权   | JWT（2 小时有效期）+ bcrypt 密码哈希          |
| 数据库 | MySQL 8                                       |

## 项目结构

```
my-own-page/
├── frontend/
│   ├── A1RER.html          # 主档案页
│   ├── githubpage.html     # GitHub 情报页
│   ├── blog.html           # 博客
│   └── dashboard.html      # 管理后台
└── backend/
    ├── server.js           # Express API
    ├── db.js               # MySQL 连接池
    ├── .env.example        # 环境变量模板
    └── package.json
```

## 后端 API

| 方法   | 路由                          | 鉴权 | 说明                              |
|--------|-------------------------------|------|-----------------------------------|
| POST   | `/api/unlock`                 | —    | 密码校验，返回 JWT + 机密内容     |
| GET    | `/api/verify`                 | JWT  | 校验 token 是否有效               |
| GET    | `/api/feed`                   | —    | 获取动态列表                      |
| POST   | `/api/feed`                   | JWT  | 新增动态                          |
| DELETE | `/api/feed/:id`               | JWT  | 删除动态                          |
| GET    | `/api/messages`               | —    | 获取留言列表                      |
| POST   | `/api/messages`               | —    | 发布留言                          |
| DELETE | `/api/messages/:id`           | JWT  | 删除留言                          |
| GET    | `/api/projects`               | —    | 获取项目列表                      |
| PATCH  | `/api/projects/:id`           | JWT  | 更新项目进度                      |
| GET    | `/api/posts`                  | —    | 获取已发布文章列表                |
| GET    | `/api/posts/all`              | JWT  | 获取所有文章（含草稿）            |
| GET    | `/api/posts/:slug`            | —    | 获取文章详情（自动计数 views +1） |
| POST   | `/api/posts`                  | JWT  | 新建文章                          |
| PATCH  | `/api/posts/:slug`            | JWT  | 更新文章                          |
| DELETE | `/api/posts/:slug`            | JWT  | 删除文章                          |
| GET    | `/api/analytics/summary`      | JWT  | 统计概览                          |
| GET    | `/api/analytics/trend`        | JWT  | 近 30 天每日 PV/UV 趋势           |
| GET    | `/api/analytics/pages`        | JWT  | 热门页面 Top 20                   |
| GET    | `/api/health`                 | —    | 健康检查                          |

登录接口有频率限制：每个 IP 每分钟最多尝试 10 次。

所有 GET 请求会被访问统计中间件自动记录（`/api/health`、`/api/verify`、`/api/analytics` 除外）。

## 本地部署

### 1. 数据库

创建 MySQL 数据库及所需表：

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

CREATE TABLE posts (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  slug        VARCHAR(200) NOT NULL UNIQUE,
  title       VARCHAR(200) NOT NULL,
  summary     TEXT,
  content     LONGTEXT     NOT NULL,
  tags        VARCHAR(500) DEFAULT NULL,
  status      ENUM('draft','published') DEFAULT 'draft',
  pinned      TINYINT(1)   DEFAULT 0,
  views       INT          DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE page_views (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  path        VARCHAR(500) NOT NULL,
  referrer    VARCHAR(500) DEFAULT NULL,
  ua          VARCHAR(500) DEFAULT NULL,
  ip          VARCHAR(45)  DEFAULT NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_path (path(100))
);
```

### 2. 环境变量

```bash
cp backend/.env.example backend/.env
```

填写 `backend/.env`：

```env
UNLOCK_PASSWORD=你的解锁密码
JWT_SECRET=你的JWT密钥
PORT=3001
FRONTEND_ORIGIN=http://127.0.0.1:5500
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=a1rer
```

### 3. 启动后端

```bash
cd backend
npm install
npm start          # 生产环境
npm run dev        # 开发环境（nodemon 热重载）
```

### 4. 打开前端

用任意静态服务器或直接浏览器打开 `frontend/A1RER.html`。

使用 VS Code Live Server 本地开发时，默认端口对应：

```
FRONTEND_ORIGIN=http://127.0.0.1:5500
```

---

随心所欲地写出来的。
