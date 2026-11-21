#!/usr/bin/env node
/**
 * 内容入库流水线
 *
 * 读取原型数据 → 逐条计算许可证允许的操作 → 写入 SQLite → 输出入库报告。
 * 被许可证拒绝的能力（翻译、改编、商业使用等）不会写入可展示字段，
 * 同时记录到 ingest_log，便于后续审计与复核。
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { ACTIONS, evaluateLicense } from "../tools/license-check/check.mjs";
import { createDb, clearContent, insertComment, transaction, DEFAULT_DB_PATH } from "./db.mjs";

const require = createRequire(import.meta.url);
const DATA = require("../prototype/js/data.js");

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_LOCAL_CORPUS = resolve(here, "../content/local/top50.json");

export function loadLocalCorpus(options = {}) {
  if (options.localCorpus === null) return null;
  if (options.localCorpus && typeof options.localCorpus === "object") return options.localCorpus;

  const path = typeof options.localCorpus === "string" ? options.localCorpus : DEFAULT_LOCAL_CORPUS;
  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    console.warn(`本地语料读取失败（${path}）：${error.message}`);
    return null;
  }
}

export function allowedActionMap(licenseCode, options = {}) {
  const commercial = options.commercial !== false;
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

export function requestedActions(paper) {
  const requested = ["display_metadata", "display_abstract", "commercial_use"];
  if (paper.interpretation) requested.push("quote_commentary");
  if (paper.demo) requested.push("adapt_fulltext");
  return requested;
}

export function ingest(db, data = DATA, options = {}) {
  const commercial = options.commercial !== false;
  const now = options.now || new Date().toISOString();

  const summary = {
    papers: 0,
    localPapers: 0,
    comments: 0,
    checks: 0,
    denied: 0,
    legalReview: 0,
    deniedDetails: [],
    db: options.dbPath || null
  };

  const insertPaper = db.prepare(`
    INSERT INTO papers (
      id, title_zh, title_en, authors, journal, year, citations, field, nobel, tag,
      license_code, license_label, license_note, license_allowed_json, abstract_zh, abstract_en,
      formula, link, interpretation_json, demo_json, thinking_json,
      original_lang, ingested_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertConcept = db.prepare(
    "INSERT INTO concepts (id, name, name_en, definition, papers_json) VALUES (?, ?, ?, ?, ?)"
  );
  const insertTopic = db.prepare(
    "INSERT INTO topics (id, name, description, tone, papers_json) VALUES (?, ?, ?, ?, ?)"
  );
  const insertLog = db.prepare(`
    INSERT INTO ingest_log (paper_id, license_code, action, allowed, code, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  function insertPaperRecord(paper) {
      const licenseCode = paper.license.spdx || paper.license.code;
      const allowed = allowedActionMap(licenseCode, { commercial });
      const requested = requestedActions(paper);
      const deniedHere = [];

      for (const action of requested) {
        const result = allowed[action];
        summary.checks += 1;
        insertLog.run(
          paper.id,
          licenseCode,
          action,
          result.allowed ? 1 : 0,
          result.code,
          result.reason,
          now
        );
        if (!result.allowed) {
          summary.denied += 1;
          deniedHere.push({ action, reason: result.reason });
          summary.deniedDetails.push({ paper: paper.id, action, reason: result.reason });
        }
        if (result.allowed && result.legalReview) summary.legalReview += 1;
      }

      const interpretation = paper.interpretation && allowed.quote_commentary.allowed
        ? JSON.stringify(paper.interpretation)
        : null;

      let demo = null;
      if (paper.demo) {
        demo = allowed.adapt_fulltext.allowed
          ? paper.demo
          : { ...paper.demo, available: false, licenseBlocked: true };
      }

      insertPaper.run(
        paper.id,
        paper.titleZh,
        paper.titleEn,
        paper.authors,
        paper.journal,
        paper.year,
        paper.citations,
        paper.field,
        paper.nobel || null,
        paper.tag,
        licenseCode,
        paper.license.code,
        paper.license.note || null,
        JSON.stringify(allowed),
        paper.abstractZh || null,
        paper.abstractEn || null,
        paper.formula || null,
        paper.link,
        interpretation,
        demo ? JSON.stringify(demo) : null,
        paper.thinking ? JSON.stringify(paper.thinking) : null,
        paper.originalLang || "en",
        now
      );
      summary.papers += 1;

      if (deniedHere.length) {
        summary.papersWithRestrictions = (summary.papersWithRestrictions || 0) + 1;
      }
  }

  const local = loadLocalCorpus(options);

  transaction(db, () => {
    clearContent(db);

    for (const paper of data.papers) insertPaperRecord(paper);

    const insertedIds = new Set(data.papers.map(paper => paper.id));
    if (local && Array.isArray(local.papers)) {
      for (const paper of local.papers) {
        if (!paper || !paper.id || insertedIds.has(paper.id)) continue;
        insertPaperRecord(paper);
        insertedIds.add(paper.id);
        summary.localPapers += 1;
      }
    }

    for (const concept of data.concepts) {
      insertConcept.run(
        concept.id,
        concept.name,
        concept.en || null,
        concept.definition,
        JSON.stringify(concept.papers)
      );
    }

    for (const topic of data.topics) {
      insertTopic.run(
        topic.id,
        topic.name,
        topic.desc || null,
        topic.tone || null,
        JSON.stringify(topic.papers)
      );
    }

    const topicIds = new Set(data.topics.map(topic => topic.id));
    if (local && Array.isArray(local.topics)) {
      for (const topic of local.topics) {
        if (!topic || !topic.id || topicIds.has(topic.id)) continue;
        insertTopic.run(
          topic.id,
          topic.name,
          topic.desc || null,
          topic.tone || null,
          JSON.stringify(topic.papers)
        );
        topicIds.add(topic.id);
      }
    }

    const allSeeds = [];
    for (const [paperId, comments] of Object.entries(data.seedComments || {})) {
      for (const comment of comments) {
        allSeeds.push({ paperId, ...comment });
      }
    }
    for (const seed of allSeeds) {
      insertComment(db, seed.paperId, seed.author, seed.body, {
        seed: true,
        createdAt: now,
        timeLabel: seed.time
      });
      summary.comments += 1;
    }
  });

  return summary;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const dbPath = process.env.XLW_DB || DEFAULT_DB_PATH;
  const db = createDb(dbPath);
  const summary = ingest(db, DATA, { dbPath });

  console.log("");
  console.log("内容入库完成");
  console.log("─".repeat(64));
  console.log(`论文        ${summary.papers} 篇（其中本地语料 ${summary.localPapers} 篇）`);
  console.log(`种子讨论    ${summary.comments} 条`);
  console.log(`许可证检查  ${summary.checks} 项`);
  console.log(`拒绝操作    ${summary.denied} 项（不会进入对应功能）`);
  console.log(`法务复核    ${summary.legalReview} 项（短引用 + 评论）`);
  console.log(`数据库      ${dbPath}`);

  if (summary.deniedDetails.length) {
    console.log("");
    console.log("拒绝明细：");
    for (const item of summary.deniedDetails) {
      console.log(`✗ ${item.paper.padEnd(24)} ${item.action.padEnd(20)} ${item.reason}`);
    }
  }

  console.log("");
  console.log("下一步：node server/server.mjs");
  console.log("");

  db.close();
}
