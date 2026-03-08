// ── MySQL 连接池 ──────────────────────────────────────
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "a1rer",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
});

pool
  .getConnection()
  .then((conn) => {
    console.log("[A1RER] MySQL connected ✓");
    conn.release();
  })
  .catch((err) => {
    console.error("[A1RER] MySQL connection failed:", err.message);
    process.exit(1);
  });

module.exports = pool;
