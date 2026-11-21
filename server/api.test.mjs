import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, closeDb } from "./db.mjs";
import { ingest, allowedActionMap } from "./ingest.mjs";
import { startServer } from "./server.mjs";

describe("M1 API 与入库流水线", () => {
  let dir;
  let db;
  let started;
  let base;
  let summary;

  before(async () => {
    dir = mkdtempSync(join(tmpdir(), "xlw-test-"));
    db = createDb(join(dir, "content.db"));
    summary = ingest(db, undefined, { now: "2026-11-20T00:00:00.000Z" });
    started = await startServer(db, { port: 0, host: "127.0.0.1" });
    base = started.url;
  });

  after(async () => {
    if (started) {
      started.server.closeAllConnections();
      await new Promise(resolve => started.server.close(resolve));
    }
    closeDb(db);
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  async function api(path, options) {
    const response = await fetch(base + path, options);
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : await response.text();
    return { status: response.status, payload, headers: response.headers };
  }

  it("入库时按许可证拒绝商业使用与受限演绎", () => {
    assert.equal(summary.papers, 9);
    assert.equal(summary.comments, 6);
    assert.equal(summary.checks, 35);
    assert.equal(summary.denied, 7);
    assert.equal(summary.legalReview, 4);

    const denied = summary.deniedDetails.map(item => `${item.paper}:${item.action}`);
    assert.ok(denied.includes("lk99-2023:commercial_use"));
    assert.ok(denied.includes("lk99-2023:adapt_fulltext"));
    assert.ok(denied.includes("watson-crick-1953:commercial_use"));
    assert.ok(!denied.includes("ligo-2016:adapt_fulltext"));
  });

  it("许可证允许的操作映射正确", () => {
    const lk99 = allowedActionMap("ARXIV-NONEXCLUSIVE");
    assert.equal(lk99.quote_commentary.allowed, true);
    assert.equal(lk99.quote_commentary.legalReview, true);
    assert.equal(lk99.translate_fulltext.allowed, false);
    assert.equal(lk99.commercial_use.allowed, false);

    const ccBy = allowedActionMap("CC-BY-4.0");
    assert.equal(ccBy.translate_fulltext.allowed, true);
    assert.equal(ccBy.commercial_use.allowed, true);
  });

  it("健康检查与列表接口", async () => {
    const health = await api("/api/health");
    assert.equal(health.status, 200);
    assert.equal(health.payload.ok, true);
    assert.equal(health.payload.papers, 9);

    const list = await api("/api/papers");
    assert.equal(list.status, 200);
    assert.equal(list.payload.total, 9);
    assert.equal(list.payload.papers.length, 9);
    assert.ok(list.payload.papers.every(paper => paper.license && paper.license.allowed));
    assert.ok(!("interpretation" in list.payload.papers[0]));
  });

  it("筛选与搜索接口", async () => {
    const physics = await api("/api/papers?field=" + encodeURIComponent("物理"));
    assert.equal(physics.payload.total, 3);

    const search = await api("/api/papers?q=" + encodeURIComponent("引力波"));
    assert.ok(search.payload.total >= 1);
    assert.ok(search.payload.papers.some(paper => paper.id === "ligo-2016"));
  });

  it("详情接口按许可证与语言返回字段", async () => {
    const einstein = await api("/api/papers/einstein-1905");
    assert.equal(einstein.status, 200);
    const paper = einstein.payload.paper;
    assert.equal(paper.interpretation.length, 5);
    assert.equal(paper.license.allowed.translate_fulltext.allowed, true);
    assert.equal(paper.abstracts.zh.kind, "platform_summary");
    assert.equal(paper.aiGenerated, true);
    assert.ok(paper.concepts.length >= 1);

    const watson = await api("/api/papers/watson-crick-1953");
    assert.equal(watson.payload.paper.interpretation, null);
    assert.equal(watson.payload.paper.license.allowed.translate_fulltext.allowed, false);

    const tu = await api("/api/papers/tu-1977");
    assert.equal(tu.payload.paper.originalLanguage, "zh");
    assert.equal(tu.payload.paper.abstracts.zh.kind, "platform_summary");

    const lk99 = await api("/api/papers/lk99-2023");
    assert.equal(lk99.payload.paper.license.allowed.adapt_fulltext.allowed, false);
    assert.equal(lk99.payload.paper.license.allowed.commercial_use.allowed, false);

    const missing = await api("/api/papers/not-exist");
    assert.equal(missing.status, 404);
  });

  it("讨论区可读可写，并做基本校验", async () => {
    const before = await api("/api/papers/einstein-1905/comments");
    assert.equal(before.payload.comments.length, 2);

    const created = await api("/api/papers/einstein-1905/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "测试用户", body: "这个实验的对照设置合理吗？" })
    });
    assert.equal(created.status, 201);
    assert.equal(created.payload.comment.author, "测试用户");
    assert.equal(created.payload.comment.seeded, false);

    const after = await api("/api/papers/einstein-1905/comments");
    assert.equal(after.payload.comments.length, 3);
    assert.ok(after.payload.comments.some(comment => comment.body.includes("对照设置")));

    const empty = await api("/api/papers/einstein-1905/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "   " })
    });
    assert.equal(empty.status, 400);

    const missing = await api("/api/papers/not-exist/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "test" })
    });
    assert.equal(missing.status, 404);
  });

  it("bootstrap 聚合接口返回前端所需结构与许可证能力", async () => {
    const result = await api("/api/bootstrap");
    assert.equal(result.status, 200);
    assert.equal(result.payload.papers.length, 9);
    assert.equal(result.payload.concepts.length, 10);
    assert.equal(result.payload.topics.length, 5);
    assert.deepEqual(Object.keys(result.payload.comments).sort(), [
      "einstein-1905",
      "ligo-2016",
      "lk99-2023"
    ]);

    const einstein = result.payload.papers.find(paper => paper.id === "einstein-1905");
    assert.equal(result.payload.papers[0].id, "einstein-1905");
    assert.equal(einstein.license.allowed.translate_fulltext.allowed, true);
    assert.equal(einstein.interpretation.length, 5);
    assert.equal(einstein.abstracts.zh.kind, "platform_summary");

    const lk99 = result.payload.papers.find(paper => paper.id === "lk99-2023");
    assert.equal(lk99.license.allowed.commercial_use.allowed, false);
    assert.equal(lk99.license.allowed.adapt_fulltext.allowed, false);
  });

  it("概念、专题与许可证查询接口", async () => {
    const concepts = await api("/api/concepts");
    assert.equal(concepts.payload.concepts.length, 10);
    assert.ok(concepts.payload.concepts[0].papers.length >= 1);

    const topics = await api("/api/topics");
    assert.equal(topics.payload.topics.length, 5);
    assert.ok(topics.payload.topics.some(topic => topic.id === "nobel"));

    const ncCommercial = await api("/api/license/CC-BY-NC-4.0?action=translate_fulltext&commercial=true");
    assert.equal(ncCommercial.payload.allowed, false);
    assert.equal(ncCommercial.payload.code, "noncommercial_only");

    const ncNonCommercial = await api("/api/license/CC-BY-NC-4.0?action=translate_fulltext&commercial=false");
    assert.equal(ncNonCommercial.payload.allowed, true);

    const unknownAction = await api("/api/license/CC-BY-4.0?action=fly_to_moon");
    assert.equal(unknownAction.status, 400);
  });

  it("同源托管原型静态文件", async () => {
    const page = await api("/");
    assert.equal(page.status, 200);
    assert.ok(String(page.payload).includes("小论文"));

    const css = await api("/css/style.css");
    assert.equal(css.status, 200);
    assert.ok(String(css.payload).includes("--bg"));

    const missing = await api("/nope.html");
    assert.equal(missing.status, 404);
  });
});
