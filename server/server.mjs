#!/usr/bin/env node
/**
 * M1 最小后端
 *
 * - 把 SQLite 中的论文、概念、专题与讨论以 JSON API 暴露
 * - 许可证允许的操作随每条内容返回，前端据此隐藏受限功能
 * - 同源托管 prototype/ 静态原型
 *
 * 运行前先执行：node server/ingest.mjs
 * 启动：node server/server.mjs
 */

import { createServer as createHttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { createReadStream, statSync } from "node:fs";
import { extname, resolve, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { ACTIONS, ACTION_LABEL, LICENSES, evaluateLicense, normalizeLicense } from "../tools/license-check/check.mjs";
import { createDb, insertComment, listComments } from "./db.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const PROTOTYPE_DIR = resolve(here, "../prototype");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: { status, message } });
}

function safeParse(value, fallback = null) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function paperRowToListItem(row) {
  return {
    id: row.id,
    title: { zh: row.title_zh, en: row.title_en },
    authors: row.authors,
    journal: row.journal,
    year: row.year,
    citations: row.citations,
    field: row.field,
    nobel: row.nobel,
    tag: row.tag,
    formula: row.formula,
    link: row.link,
    hasInterpretation: Boolean(row.has_interpretation),
    license: {
      code: row.license_code,
      label: row.license_label,
      note: row.license_note,
      source: row.license_source || null,
      allowed: safeParse(row.license_allowed_json, {})
    }
  };
}

function commentRowToJson(row) {
  return {
    id: row.id,
    author: row.author,
    body: row.body,
    createdAt: row.created_at,
    timeLabel: row.time_label,
    seeded: Boolean(row.seed)
  };
}

function selectPaper(db, id) {
  return db.prepare("SELECT * FROM papers WHERE id = ?").get(id);
}

function paperToCoreJson(paper) {
  const interpretation = safeParse(paper.interpretation_json, null);
  return {
    id: paper.id,
    title: { zh: paper.title_zh, en: paper.title_en },
    authors: paper.authors,
    journal: paper.journal,
    year: paper.year,
    citations: paper.citations,
    field: paper.field,
    nobel: paper.nobel,
    tag: paper.tag,
    formula: paper.formula,
    link: paper.link,
    originalLanguage: paper.original_lang || "en",
    abstracts: {
      zh: paper.abstract_zh ? { kind: "platform_summary", text: paper.abstract_zh } : null,
      en: paper.abstract_en ? { kind: "platform_summary", text: paper.abstract_en } : null
    },
    license: {
      code: paper.license_code,
      label: paper.license_label,
      note: paper.license_note,
      source: paper.license_source || null,
      allowed: safeParse(paper.license_allowed_json, {})
    },
    interpretation,
    demo: safeParse(paper.demo_json, null),
    thinking: safeParse(paper.thinking_json, []),
    aiGenerated: Boolean(interpretation)
  };
}

function listConceptsRaw(db) {
  return db.prepare("SELECT * FROM concepts ORDER BY id").all().map(row => ({
    id: row.id,
    name: row.name,
    en: row.name_en,
    definition: row.definition,
    papers: safeParse(row.papers_json, [])
  }));
}

function listTopicsRaw(db) {
  return db.prepare("SELECT * FROM topics ORDER BY id").all().map(row => ({
    id: row.id,
    name: row.name,
    desc: row.description,
    tone: row.tone,
    papers: safeParse(row.papers_json, [])
  }));
}

function groupComments(db) {
  const grouped = {};
  for (const row of db.prepare("SELECT * FROM comments ORDER BY id").all()) {
    if (!grouped[row.paper_id]) grouped[row.paper_id] = [];
    grouped[row.paper_id].push({
      author: row.author,
      body: row.body,
      time: row.time_label || row.created_at
    });
  }
  return grouped;
}

function paperMatchesConcept(db, paperId) {
  const rows = db.prepare("SELECT id, name, papers_json FROM concepts").all();
  return rows
    .filter(row => {
      const ids = safeParse(row.papers_json, []);
      return Array.isArray(ids) && ids.includes(paperId);
    })
    .map(row => ({ id: row.id, name: row.name }));
}

function buildAllowedActions(licenseCode, commercial = true) {
  const map = {};
  for (const action of ACTIONS) {
    const result = evaluateLicense(licenseCode, action, { commercial });
    map[action] = {
      allowed: result.allowed,
      code: result.code,
      reason: result.reason,
      legalReview: Boolean(result.legalReview),
      attribution: Boolean(result.attribution),
      shareAlike: Boolean(result.shareAlike)
    };
  }
  return map;
}

function reviewItemForRow(db, row) {
  const allowed = safeParse(row.license_allowed_json, {});
  const legalReviewActions = Object.entries(allowed)
    .filter(([, value]) => value.allowed && value.legalReview)
    .map(([action]) => action);
  const deniedActions = Object.entries(allowed)
    .filter(([, value]) => !value.allowed)
    .map(([action, value]) => ({ action, reason: value.reason, code: value.code }));
  const history = db.prepare(`
    SELECT decision, previous_license, new_license, note, created_at
    FROM review_log WHERE paper_id = ? ORDER BY id DESC LIMIT 10
  `).all(row.id).map(item => ({
    decision: item.decision,
    previousLicense: item.previous_license,
    newLicense: item.new_license,
    note: item.note,
    createdAt: item.created_at
  }));

  return {
    id: row.id,
    title: { zh: row.title_zh, en: row.title_en },
    authors: row.authors,
    journal: row.journal,
    year: row.year,
    field: row.field,
    link: row.link,
    license: {
      code: row.license_code,
      label: row.license_label,
      note: row.license_note,
      source: row.license_source || null
    },
    review: {
      status: row.review_status || "pending",
      note: row.review_note || null,
      reviewedAt: row.reviewed_at || null
    },
    flags: {
      unverified: row.license_code === "UNVERIFIED",
      legalReview: legalReviewActions.length > 0,
      denied: deniedActions.length > 0
    },
    legalReviewActions,
    deniedActions,
    history,
    allowedCount: Object.values(allowed).filter(item => item.allowed).length,
    totalActions: ACTIONS.length
  };
}

const REVIEW_STATUS_LABEL_SERVER = {
  pending: "待复核",
  reviewed: "已复核",
  rejected: "已驳回"
};

function getReviewQueue(db, filter = "all") {
  const rows = db.prepare("SELECT * FROM papers ORDER BY rowid").all();
  let items = rows.map(row => reviewItemForRow(db, row));

  const summary = {
    total: items.length,
    unverified: items.filter(item => item.flags.unverified).length,
    legalReview: items.filter(item => item.flags.legalReview).length,
    denied: items.filter(item => item.flags.denied).length,
    reviewed: items.filter(item => item.review.status !== "pending").length
  };

  if (filter === "unverified") items = items.filter(item => item.flags.unverified);
  else if (filter === "legal_review") items = items.filter(item => item.flags.legalReview);
  else if (filter === "denied") items = items.filter(item => item.flags.denied);
  else if (filter === "reviewed") items = items.filter(item => item.review.status !== "pending");

  const score = item => item.flags.unverified ? 0 : item.flags.legalReview ? 1 : item.flags.denied ? 2 : 3;
  items.sort((a, b) => score(a) - score(b) || a.id.localeCompare(b.id));

  return { filter, summary, items };
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function sendCsv(res, filename, rows) {
  const body = rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  res.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end("﻿" + body);
}

async function handleApi(db, req, res, url) {
  const segments = url.pathname.split("/").filter(Boolean); // ["api", ...]

  if (req.method === "GET" && url.pathname === "/api/health") {
    const paperCount = db.prepare("SELECT COUNT(*) AS n FROM papers").get().n;
    const commentCount = db.prepare("SELECT COUNT(*) AS n FROM comments").get().n;
    return sendJson(res, 200, {
      ok: true,
      papers: paperCount,
      comments: commentCount,
      time: new Date().toISOString()
    });
  }

  if (req.method === "GET" && url.pathname === "/api/bootstrap") {
    const rows = db.prepare(`
      SELECT * FROM papers
      ORDER BY rowid
    `).all();

    return sendJson(res, 200, {
      generatedAt: new Date().toISOString(),
      papers: rows.map(paperToCoreJson),
      concepts: listConceptsRaw(db),
      topics: listTopicsRaw(db),
      comments: groupComments(db)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/review/queue") {
    return sendJson(res, 200, getReviewQueue(db, url.searchParams.get("filter") || "all"));
  }

  if (req.method === "GET" && url.pathname === "/api/review/export.csv") {
    const queue = getReviewQueue(db, url.searchParams.get("filter") || "all");
    const header = [
      "id", "中文标题", "英文标题", "期刊", "年份", "许可证代码", "许可证名称", "许可证来源",
      "复核状态", "待核对", "需法务复核", "受限能力", "需法务复核能力", "复核备注", "来源备注", "最近复核时间"
    ];
    const rows = queue.items.map(item => [
      item.id,
      item.title.zh,
      item.title.en,
      item.journal,
      item.year,
      item.license.code,
      item.license.label,
      item.license.source,
      REVIEW_STATUS_LABEL_SERVER[item.review.status] || item.review.status,
      item.flags.unverified ? "是" : "否",
      item.flags.legalReview ? "是" : "否",
      item.deniedActions.map(entry => ACTION_LABEL[entry.action] || entry.action).join("；"),
      item.legalReviewActions.map(action => ACTION_LABEL[action] || action).join("；"),
      item.review.note,
      item.license.note,
      item.review.reviewedAt
    ]);
    return sendCsv(res, `review-${queue.filter}.csv`, [header, ...rows]);
  }

  if (req.method === "POST" && segments[1] === "review" && segments[2] && !segments[3]) {
    const row = selectPaper(db, segments[2]);
    if (!row) return sendError(res, 404, "论文不存在");

    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return sendError(res, error.status || 400, error.message);
    }

    const decision = String(payload.decision || (payload.licenseCode ? "update_license" : "approve")).trim();
    if (!["approve", "update_license", "reject"].includes(decision)) {
      return sendError(res, 400, `未知复核决定：${decision}`);
    }

    let newCode = row.license_code;
    if (payload.licenseCode) {
      newCode = normalizeLicense(payload.licenseCode);
      if (!Object.prototype.hasOwnProperty.call(LICENSES, newCode)) {
        return sendError(res, 400, `未收录的许可证：${newCode}`);
      }
    }
    if (decision === "update_license" && !payload.licenseCode) {
      return sendError(res, 400, "更新许可证需要提供 licenseCode");
    }

    const now = new Date().toISOString();
    const note = payload.note ? String(payload.note).trim().slice(0, 500) : null;
    const reviewStatus = decision === "reject" ? "rejected" : "reviewed";
    const allowed = buildAllowedActions(newCode, true);
    const label = LICENSES[newCode] ? LICENSES[newCode].label : row.license_label;
    const licenseNote = payload.licenseNote
      ? String(payload.licenseNote).trim().slice(0, 300)
      : newCode === row.license_code
        ? row.license_note
        : `${label}（人工复核更新）`;
    const licenseSource = payload.licenseSource
      ? String(payload.licenseSource).trim().slice(0, 300)
      : newCode !== row.license_code
        ? `${label}（人工复核更新）`
        : row.license_source;

    db.prepare(`
      UPDATE papers
      SET license_code = ?, license_label = ?, license_allowed_json = ?,
          license_note = ?, license_source = ?, review_status = ?, review_note = ?, reviewed_at = ?
      WHERE id = ?
    `).run(
      newCode,
      label,
      JSON.stringify(allowed),
      licenseNote,
      licenseSource,
      reviewStatus,
      note,
      now,
      row.id
    );

    db.prepare(`
      INSERT INTO review_log (paper_id, decision, previous_license, new_license, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(row.id, decision, row.license_code, newCode, note, now);

    const updated = selectPaper(db, row.id);
    return sendJson(res, 200, {
      item: reviewItemForRow(db, updated),
      decision,
      previousLicense: row.license_code,
      newLicense: newCode
    });
  }

  if (req.method === "GET" && url.pathname === "/api/papers") {
    const clauses = [];
    const params = [];
    const field = url.searchParams.get("field");
    const tag = url.searchParams.get("tag");
    const q = (url.searchParams.get("q") || "").trim();

    if (field) {
      clauses.push("field = ?");
      params.push(field);
    }
    if (tag) {
      clauses.push("tag = ?");
      params.push(tag);
    }
    if (q) {
      clauses.push("(title_zh LIKE ? OR title_en LIKE ? OR authors LIKE ? OR abstract_zh LIKE ?)");
      const pattern = `%${q}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT id, title_zh, title_en, authors, journal, year, citations, field, nobel, tag,
             formula, link, license_code, license_label, license_note, license_allowed_json,
             (interpretation_json IS NOT NULL) AS has_interpretation
      FROM papers
      ${where}
      ORDER BY rowid
    `).all(...params);

    return sendJson(res, 200, { total: rows.length, papers: rows.map(paperRowToListItem) });
  }

  if (segments[1] === "papers" && segments[2] && segments[3] === "comments") {
    const paper = selectPaper(db, segments[2]);
    if (!paper) return sendError(res, 404, "论文不存在");

    if (req.method === "GET" && segments.length === 4) {
      return sendJson(res, 200, { comments: listComments(db, paper.id).map(commentRowToJson) });
    }

    if (req.method === "POST" && segments.length === 4) {
      let payload;
      try {
        payload = await readJsonBody(req);
      } catch (error) {
        return sendError(res, error.status || 400, error.message);
      }

      const author = String(payload.author || "匿名").trim().slice(0, 40) || "匿名";
      const body = String(payload.body || "").trim();
      if (!body) return sendError(res, 400, "评论内容不能为空");
      if (body.length > 1000) return sendError(res, 400, "评论内容不能超过 1000 字");

      const comment = insertComment(db, paper.id, author, body, { seed: false });
      return sendJson(res, 201, { comment: commentRowToJson(comment) });
    }

    return sendError(res, 405, "不支持的请求方法");
  }

  if (req.method === "GET" && segments[1] === "papers" && segments[2]) {
    const paper = selectPaper(db, segments[2]);
    if (!paper) return sendError(res, 404, "论文不存在");

    return sendJson(res, 200, {
      paper: {
        ...paperToCoreJson(paper),
        concepts: paperMatchesConcept(db, paper.id),
        comments: listComments(db, paper.id).map(commentRowToJson)
      }
    });
  }

  if (req.method === "GET" && url.pathname === "/api/concepts") {
    const rows = db.prepare("SELECT * FROM concepts ORDER BY id").all();
    const titles = new Map(
      db.prepare("SELECT id, title_zh FROM papers").all().map(row => [row.id, row.title_zh])
    );
    return sendJson(res, 200, {
      concepts: rows.map(row => ({
        id: row.id,
        name: row.name,
        nameEn: row.name_en,
        definition: row.definition,
        papers: safeParse(row.papers_json, []).map(id => ({ id, title: titles.get(id) || id }))
      }))
    });
  }

  if (req.method === "GET" && url.pathname === "/api/topics") {
    const rows = db.prepare("SELECT * FROM topics ORDER BY id").all();
    const titles = new Map(
      db.prepare("SELECT id, title_zh FROM papers").all().map(row => [row.id, row.title_zh])
    );
    return sendJson(res, 200, {
      topics: rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        tone: row.tone,
        papers: safeParse(row.papers_json, []).map(id => ({ id, title: titles.get(id) || id }))
      }))
    });
  }

  if (req.method === "GET" && segments[1] === "license" && segments[2]) {
    const code = decodeURIComponent(segments[2]);
    const action = url.searchParams.get("action");
    const commercial = url.searchParams.get("commercial") !== "false";

    if (action) {
      if (!ACTIONS.includes(action)) return sendError(res, 400, `未知操作：${action}`);
      return sendJson(res, 200, evaluateLicense(code, action, { commercial }));
    }

    return sendJson(res, 200, {
      license: code,
      commercial,
      actions: Object.fromEntries(
        ACTIONS.map(item => [item, evaluateLicense(code, item, { commercial })])
      )
    });
  }

  return sendError(res, 404, "接口不存在");
}

function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", chunk => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error("请求体过大");
        error.status = 413;
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolvePromise(raw ? JSON.parse(raw) : {});
      } catch {
        const error = new Error("JSON 解析失败");
        error.status = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendError(res, 405, "不支持的请求方法");
  }

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendError(res, 400, "无效路径");
  }
  if (pathname === "/") pathname = "/index.html";

  const filePath = resolve(PROTOTYPE_DIR, "." + pathname);
  if (filePath !== PROTOTYPE_DIR && !filePath.startsWith(PROTOTYPE_DIR + sep)) {
    return sendError(res, 403, "禁止访问");
  }

  let stats;
  try {
    stats = statSync(filePath);
  } catch {
    return sendError(res, 404, "文件不存在");
  }
  if (!stats.isFile()) return sendError(res, 404, "文件不存在");

  res.writeHead(200, {
    "Content-Type": MIME[extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Length": stats.size,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(filePath).pipe(res);
}

function tokenMatches(provided, expected) {
  const a = Buffer.from(String(provided || ""));
  const b = Buffer.from(String(expected || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function isReviewAuthorized(req, token) {
  if (!token) return true;
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ") && tokenMatches(header.slice(7), token)) return true;
  return tokenMatches(req.headers["x-review-token"], token);
}

export function createServer(db, options = {}) {
  const reviewToken = options.reviewToken !== undefined
    ? options.reviewToken
    : (process.env.XLW_REVIEW_TOKEN || "");

  return createHttpServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/review") && !isReviewAuthorized(req, reviewToken)) {
      return sendError(res, 401, "需要复核令牌");
    }

    if (url.pathname.startsWith("/api/")) {
      handleApi(db, req, res, url).catch(error => {
        console.error("[api]", error);
        if (!res.headersSent) {
          sendError(res, error.status || 500, error.status ? error.message : "服务器内部错误");
        } else {
          res.end();
        }
      });
      return;
    }

    try {
      serveStatic(req, res, url);
    } catch (error) {
      console.error("[static]", error);
      if (!res.headersSent) sendError(res, 500, "服务器内部错误");
    }
  });
}

export function startServer(db, options = {}) {
  const port = options.port !== undefined ? options.port : Number(process.env.PORT || 8787);
  const host = options.host || process.env.HOST || "127.0.0.1";
  const server = createServer(db, { reviewToken: options.reviewToken });

  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      const address = server.address();
      resolvePromise({
        server,
        host,
        port: address.port,
        url: `http://${host}:${address.port}`
      });
    });
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const db = createDb();
  const hasPapers = db.prepare("SELECT COUNT(*) AS n FROM papers").get().n;
  if (!hasPapers) {
    console.error("数据库为空，请先运行：node server/ingest.mjs");
    db.close();
    process.exit(1);
  }

  const started = await startServer(db);
  console.log("");
  console.log("小论文 · 大智慧 — M1 服务已启动");
  console.log(`API   ${started.url}/api/health`);
  console.log(`原型  ${started.url}/`);
  console.log(
    process.env.XLW_REVIEW_TOKEN
      ? "复核  已启用令牌保护（XLW_REVIEW_TOKEN）"
      : "复核  未启用令牌保护（本地演示）"
  );
  console.log("停止  Ctrl+C");
  console.log("");

  const shutdown = () => {
    started.server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
