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

app.listen(PORT);
