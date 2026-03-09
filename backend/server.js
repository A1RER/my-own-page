// ══════════════════════════════════════════════════════
//  A1RER · Backend Server
//
//  POST /api/unlock          → 密码验证，返回 JWT + 内容
//  GET  /api/verify          → 验证 JWT 是否有效
//
//  GET  /api/feed            → 获取动态列表
//  POST /api/feed            → 新增动态（需要 JWT）
//  DELETE /api/feed/:id      → 删除动态（需要 JWT）
//
//  GET  /api/messages        → 获取留言列表
//  POST /api/messages        → 新增留言（公开）
//  DELETE /api/messages/:id  → 删除留言（需要 JWT）
//
//  GET  /api/projects        → 获取项目列表
//  PATCH /api/projects/:id   → 更新进度（需要 JWT）
//
//  GET  /api/health          → 健康检查
// ══════════════════════════════════════════════════════

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5500",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ── JWT 中间件 ────────────────────────────────────────
function authRequired(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "fallback");
    next();
  } catch {
    return res.status(401).json({ error: "Token expired or invalid" });
  }
}

// ── Hash 密码 ─────────────────────────────────────────
let PASSWORD_HASH = null;
(async () => {
  const raw = process.env.UNLOCK_PASSWORD;
  if (!raw || raw === "your_secret_password_here") {
    console.warn("[A1RER] ⚠  请在 .env 里设置 UNLOCK_PASSWORD");
  }
  PASSWORD_HASH = await bcrypt.hash(raw || "default", 10);
  console.log(`[A1RER] Server ready on :${PORT}`);
  console.log(`[A1RER] CORS origin: ${process.env.FRONTEND_ORIGIN}`);
})();

// ── POST /api/unlock ──────────────────────────────────
app.post("/api/unlock", async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "Password required" });

  if (!app.locals.attempts) app.locals.attempts = {};
  const ip = req.ip;
  const now = Date.now();
  const rec = app.locals.attempts[ip] || { count: 0, resetAt: now + 60_000 };
  if (now > rec.resetAt) {
    rec.count = 0;
    rec.resetAt = now + 60_000;
  }
  rec.count++;
  app.locals.attempts[ip] = rec;
  if (rec.count > 10)
    return res.status(429).json({ error: "Too many attempts. Wait 60s." });

  const match = await bcrypt.compare(password, PASSWORD_HASH);
  if (!match) {
    await new Promise((r) => setTimeout(r, 400));
    return res
      .status(401)
      .json({ error: "ACCESS DENIED · Invalid credentials" });
  }
  delete app.locals.attempts[ip];

  const token = jwt.sign(
    { sub: "a1rer-classified", level: 2 },
    process.env.JWT_SECRET || "fallback",
    { expiresIn: "2h" },
  );

  const content = {
    title: "LEVEL-2 CLEARANCE · GRANTED",
    sections: [
      {
        label: "Redacted Note",
        text: "这里是解锁后才能看到的内容。在 server.js 里替换这段文字。",
      },
      { label: "Coordinates", text: "大理 · 苍山脚下 · 某间还不存在的咖啡馆" },
      { label: "Status", text: "COMPILING — ETA: Unknown" },
    ],
  };

  return res.json({ token, content });
});

// ── GET /api/verify ───────────────────────────────────
app.get("/api/verify", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "fallback");
    return res.json({ valid: true, payload });
  } catch {
    return res
      .status(401)
      .json({ valid: false, error: "Token expired or invalid" });
  }
});

// ── GET /api/feed ─────────────────────────────────────
app.get("/api/feed", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM feed_items ORDER BY pinned DESC, id DESC",
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/feed ────────────────────────────────────
app.post("/api/feed", authRequired, async (req, res) => {
  const { date_label, content, highlight, pinned } = req.body;
  if (!date_label || !content)
    return res.status(400).json({ error: "date_label and content required" });
  try {
    const [result] = await db.query(
      "INSERT INTO feed_items (date_label, content, highlight, pinned) VALUES (?, ?, ?, ?)",
      [date_label, content, highlight || null, pinned ? 1 : 0],
    );
    res.json({ id: result.insertId, message: "Created" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/feed/:id ──────────────────────────────
app.delete("/api/feed/:id", authRequired, async (req, res) => {
  try {
    await db.query("DELETE FROM feed_items WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/messages ─────────────────────────────────
app.get("/api/messages", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, nickname, content, created_at FROM messages ORDER BY id DESC LIMIT 50",
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/messages ────────────────────────────────
app.post("/api/messages", async (req, res) => {
  const { nickname, content } = req.body;
  if (!nickname || !content)
    return res.status(400).json({ error: "nickname and content required" });
  if (nickname.length > 50)
    return res.status(400).json({ error: "Nickname too long" });
  if (content.length > 500)
    return res.status(400).json({ error: "Content too long (max 500)" });
  try {
    const [result] = await db.query(
      "INSERT INTO messages (nickname, content, ip) VALUES (?, ?, ?)",
      [nickname.trim(), content.trim(), req.ip],
    );
    res.json({ id: result.insertId, message: "Message received" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/messages/:id ──────────────────────────
app.delete("/api/messages/:id", authRequired, async (req, res) => {
  try {
    await db.query("DELETE FROM messages WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/projects ─────────────────────────────────
app.get("/api/projects", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM projects ORDER BY id ASC");
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/projects/:id ───────────────────────────
app.patch("/api/projects/:id", authRequired, async (req, res) => {
  const { progress, status, description } = req.body;
  if (progress !== undefined && (progress < 0 || progress > 100)) {
    return res.status(400).json({ error: "progress must be 0-100" });
  }
  try {
    await db.query(
      "UPDATE projects SET progress = COALESCE(?, progress), status = COALESCE(?, status), description = COALESCE(?, description) WHERE id = ?",
      [progress ?? null, status ?? null, description ?? null, req.params.id],
    );
    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/health ───────────────────────────────────
app.get("/api/health", (_, res) => {
  res.json({ status: "ok", server: "A1RER", time: new Date().toISOString() });
});

// ══════════════════════════════════════════════════════
//  A1RER · server.js 新增部分
//
//  将以下代码追加到你现有的 server.js 里，
//  放在 app.listen(PORT) 之前。
//
//  新增 API：
//  ── 访问统计中间件（自动记录所有请求）
//  GET  /api/posts              → 公开，获取已发布文章列表
//  GET  /api/posts/:slug        → 公开，获取文章详情（自动计数 +1）
//  POST /api/posts              → JWT，新建文章
//  PATCH /api/posts/:slug       → JWT，更新文章
//  DELETE /api/posts/:slug      → JWT，删除文章
//  GET  /api/analytics/summary  → JWT，统计概览
//  GET  /api/analytics/trend    → JWT，近 30 天趋势
//  GET  /api/analytics/pages    → JWT，热门页面 Top 20
// ══════════════════════════════════════════════════════

// ── 访问统计中间件 ────────────────────────────────────
// 自动记录每条 GET 请求到 page_views 表
// 跳过 /api/health 和 /api/analytics（避免自循环）
app.use(async (req, res, next) => {
  if (
    req.method === "GET" &&
    !req.path.startsWith("/api/analytics") &&
    !req.path.startsWith("/api/health") &&
    !req.path.startsWith("/api/verify")
  ) {
    const ip = req.ip;
    const ua = (req.headers["user-agent"] || "").slice(0, 500);
    const referrer = (req.headers["referer"] || "").slice(0, 500);
    db.query(
      "INSERT INTO page_views (path, referrer, ua, ip) VALUES (?, ?, ?, ?)",
      [req.path, referrer || null, ua || null, ip],
    ).catch(() => {}); // 静默失败，不影响正常请求
  }
  next();
});

// ══════════════════════════════════════════════════════
//  POSTS
// ══════════════════════════════════════════════════════

// ── GET /api/posts ────────────────────────────────────
// 公开接口：获取已发布文章列表（不含 content 全文）
app.get("/api/posts", async (req, res) => {
  const { tag } = req.query;
  try {
    let sql =
      "SELECT id, slug, title, summary, tags, status, pinned, views, created_at, updated_at FROM posts WHERE status = 'published'";
    const params = [];
    if (tag) {
      sql += " AND FIND_IN_SET(?, tags)";
      params.push(tag);
    }
    sql += " ORDER BY pinned DESC, created_at DESC";
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/posts/all ────────────────────────────────
// JWT 接口：获取所有文章（含草稿），管理用
app.get("/api/posts/all", authRequired, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, slug, title, summary, tags, status, pinned, views, created_at, updated_at FROM posts ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/posts/:slug ──────────────────────────────
// 公开接口：获取文章详情，自动 views +1
app.get("/api/posts/:slug", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM posts WHERE slug = ? AND status = 'published'",
      [req.params.slug],
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    // 异步更新阅读数，不阻塞响应
    db.query("UPDATE posts SET views = views + 1 WHERE slug = ?", [
      req.params.slug,
    ]).catch(() => {});
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/posts ───────────────────────────────────
// JWT：新建文章
app.post("/api/posts", authRequired, async (req, res) => {
  const { slug, title, summary, content, tags, status, pinned } = req.body;
  if (!slug || !title || !content)
    return res.status(400).json({ error: "slug, title, content required" });
  if (!/^[a-z0-9-]+$/.test(slug))
    return res
      .status(400)
      .json({ error: "slug must be lowercase alphanumeric with hyphens" });
  try {
    const [result] = await db.query(
      "INSERT INTO posts (slug, title, summary, content, tags, status, pinned) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        slug,
        title,
        summary || null,
        content,
        tags || null,
        status || "draft",
        pinned ? 1 : 0,
      ],
    );
    res.json({ id: result.insertId, slug, message: "Created" });
  } catch (e) {
    if (e.code === "ER_DUP_ENTRY")
      return res.status(409).json({ error: "Slug already exists" });
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/posts/:slug ────────────────────────────
// JWT：更新文章（部分更新）
app.patch("/api/posts/:slug", authRequired, async (req, res) => {
  const fields = ["title", "summary", "content", "tags", "status", "pinned"];
  const updates = {};
  for (const f of fields) {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  }
  if (!Object.keys(updates).length)
    return res.status(400).json({ error: "No fields to update" });
  const setClauses = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(", ");
  const values = [...Object.values(updates), req.params.slug];
  try {
    await db.query(`UPDATE posts SET ${setClauses} WHERE slug = ?`, values);
    res.json({ message: "Updated" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/posts/:slug ───────────────────────────
// JWT：删除文章
app.delete("/api/posts/:slug", authRequired, async (req, res) => {
  try {
    await db.query("DELETE FROM posts WHERE slug = ?", [req.params.slug]);
    res.json({ message: "Deleted" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════════════════════

// ── GET /api/analytics/summary ────────────────────────
// JWT：统计概览数据
app.get("/api/analytics/summary", authRequired, async (req, res) => {
  try {
    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) AS total FROM page_views",
    );
    const [[{ today }]] = await db.query(
      "SELECT COUNT(*) AS today FROM page_views WHERE DATE(created_at) = CURDATE()",
    );
    const [[{ week }]] = await db.query(
      "SELECT COUNT(*) AS week FROM page_views WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
    );
    const [[{ unique_ips }]] = await db.query(
      "SELECT COUNT(DISTINCT ip) AS unique_ips FROM page_views WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
    );
    const [[{ post_count }]] = await db.query(
      "SELECT COUNT(*) AS post_count FROM posts WHERE status = 'published'",
    );
    const [[{ msg_count }]] = await db.query(
      "SELECT COUNT(*) AS msg_count FROM messages",
    );
    const [[{ total_post_views }]] = await db.query(
      "SELECT COALESCE(SUM(views), 0) AS total_post_views FROM posts",
    );
    res.json({
      total_pv: total,
      today_pv: today,
      week_pv: week,
      unique_visitors_30d: unique_ips,
      post_count,
      msg_count,
      total_post_views,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/analytics/trend ──────────────────────────
// JWT：近 30 天每日 PV 趋势
app.get("/api/analytics/trend", authRequired, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        DATE(created_at) AS date,
        COUNT(*)         AS pv,
        COUNT(DISTINCT ip) AS uv
      FROM page_views
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/analytics/pages ──────────────────────────
// JWT：热门页面 Top 20
app.get("/api/analytics/pages", authRequired, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        path,
        COUNT(*) AS pv,
        COUNT(DISTINCT ip) AS uv
      FROM page_views
      GROUP BY path
      ORDER BY pv DESC
      LIMIT 20
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT);
