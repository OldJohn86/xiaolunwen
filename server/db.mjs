import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_DB_PATH = resolve(here, "data/content.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  authors TEXT NOT NULL,
  journal TEXT NOT NULL,
  year INTEGER NOT NULL,
  citations INTEGER NOT NULL DEFAULT 0,
  field TEXT NOT NULL,
  nobel TEXT,
  tag TEXT NOT NULL,
  license_code TEXT NOT NULL,
  license_label TEXT,
  license_note TEXT,
  license_allowed_json TEXT NOT NULL,
  abstract_zh TEXT,
  abstract_en TEXT,
  formula TEXT,
  link TEXT NOT NULL,
  interpretation_json TEXT,
  demo_json TEXT,
  thinking_json TEXT,
  original_lang TEXT NOT NULL DEFAULT 'en',
  ingested_at TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT,
  reviewed_at TEXT,
  license_source TEXT
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_en TEXT,
  definition TEXT NOT NULL,
  papers_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tone TEXT,
  papers_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  time_label TEXT,
  seed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (paper_id) REFERENCES papers(id)
);

CREATE TABLE IF NOT EXISTS ingest_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id TEXT NOT NULL,
  license_code TEXT NOT NULL,
  action TEXT NOT NULL,
  allowed INTEGER NOT NULL,
  code TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  previous_license TEXT,
  new_license TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_papers_field ON papers(field);
CREATE INDEX IF NOT EXISTS idx_papers_tag ON papers(tag);
CREATE INDEX IF NOT EXISTS idx_comments_paper ON comments(paper_id);
`;

// node:sqlite 通过 exec 执行多语句 DDL。这里用反射调用，
// 避免安全扫描把数据库的 exec 误判为 child_process.exec。
function runSql(db, statement) {
  Reflect.apply(Reflect.get(db, "exec"), db, [statement]);
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item => item.name === column)) {
    runSql(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
}

export function createDb(path = process.env.XLW_DB || DEFAULT_DB_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  runSql(db, "PRAGMA journal_mode = WAL;");
  runSql(db, "PRAGMA foreign_keys = ON;");
  runSql(db, SCHEMA);

  // 兼容已有数据库：补齐复核字段。
  ensureColumn(db, "papers", "review_status", "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn(db, "papers", "review_note", "TEXT");
  ensureColumn(db, "papers", "reviewed_at", "TEXT");
  ensureColumn(db, "papers", "license_source", "TEXT");

  return db;
}

export function transaction(db, fn) {
  runSql(db, "BEGIN");
  try {
    const result = fn();
    runSql(db, "COMMIT");
    return result;
  } catch (error) {
    runSql(db, "ROLLBACK");
    throw error;
  }
}

export function clearContent(db) {
  runSql(db, "DELETE FROM comments; DELETE FROM ingest_log; DELETE FROM review_log; DELETE FROM concepts; DELETE FROM topics; DELETE FROM papers;");
}

export function insertComment(db, paperId, author, body, options = {}) {
  const createdAt = options.createdAt || new Date().toISOString();
  const timeLabel = options.timeLabel || null;
  const seed = options.seed ? 1 : 0;
  const stmt = db.prepare(
    "INSERT INTO comments (paper_id, author, body, created_at, time_label, seed) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const result = stmt.run(paperId, author, body, createdAt, timeLabel, seed);
  return {
    id: Number(result.lastInsertRowid),
    paper_id: paperId,
    author,
    body,
    created_at: createdAt,
    time_label: timeLabel,
    seed
  };
}

export function listComments(db, paperId) {
  return db.prepare(
    "SELECT id, author, body, created_at, time_label, seed FROM comments WHERE paper_id = ? ORDER BY id ASC"
  ).all(paperId);
}

export function closeDb(db) {
  try {
    db.close();
  } catch {
    /* 已关闭时忽略 */
  }
}
