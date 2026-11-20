import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ACTIONS,
  evaluateLicense,
  checkManifest,
  normalizeLicense
} from "./check.mjs";

test("许可证代码归一化", () => {
  assert.equal(normalizeLicense(" cc-by-4.0 "), "CC-BY-4.0");
  assert.equal(normalizeLicense(null), "");
});

test("CC BY 允许商业性翻译与改编，并要求署名", () => {
  const result = evaluateLicense("CC-BY-4.0", "translate_fulltext", { commercial: true });
  assert.equal(result.allowed, true);
  assert.equal(result.attribution, true);
  assert.equal(result.shareAlike, false);
});

test("CC BY-NC 允许非商业演绎，但拒绝商业路径", () => {
  const nonCommercial = evaluateLicense("CC-BY-NC-4.0", "adapt_fulltext", { commercial: false });
  assert.equal(nonCommercial.allowed, true);

  const commercial = evaluateLicense("CC-BY-NC-4.0", "adapt_fulltext", { commercial: true });
  assert.equal(commercial.allowed, false);
  assert.equal(commercial.code, "noncommercial_only");
});

test("CC BY-ND 拒绝全文翻译与改编，但允许展示与再分发", () => {
  const translation = evaluateLicense("CC-BY-ND-4.0", "translate_fulltext", { commercial: false });
  assert.equal(translation.allowed, false);
  assert.equal(translation.code, "no_derivatives");

  const audio = evaluateLicense("CC-BY-ND-4.0", "audio_fulltext", { commercial: false });
  assert.equal(audio.allowed, false);

  assert.equal(evaluateLicense("CC-BY-ND-4.0", "display_abstract").allowed, true);
  assert.equal(evaluateLicense("CC-BY-ND-4.0", "redistribute_fulltext").allowed, true);
});

test("CC BY-NC-ND 同时限制商业与演绎", () => {
  const result = evaluateLicense("CC-BY-NC-ND-4.0", "translate_fulltext", { commercial: true });
  assert.equal(result.allowed, false);
  // 先触发演绎限制，避免把 ND 内容误当作可翻译
  assert.equal(result.code, "no_derivatives");
  assert.equal(evaluateLicense("CC-BY-NC-ND-4.0", "commercial_use").allowed, false);
});

test("公有领域与 CC0 放开全部操作", () => {
  for (const license of ["PUBLIC-DOMAIN", "CC0-1.0"]) {
    for (const action of ACTIONS) {
      const result = evaluateLicense(license, action, { commercial: true });
      assert.equal(result.allowed, true, `${license} 应允许 ${action}`);
    }
  }
});

test("出版社版权文献只能展示元数据与摘要", () => {
  assert.equal(evaluateLicense("PROPRIETARY-ABSTRACT-ONLY", "display_metadata").allowed, true);
  assert.equal(evaluateLicense("PROPRIETARY-ABSTRACT-ONLY", "display_abstract").allowed, true);
  assert.equal(evaluateLicense("PROPRIETARY-ABSTRACT-ONLY", "translate_fulltext").allowed, false);
  assert.equal(evaluateLicense("PROPRIETARY-ABSTRACT-ONLY", "redistribute_fulltext").allowed, false);
});

test("arXiv 非独占许可允许展示与评论，不允许全文翻译与商业使用", () => {
  assert.equal(evaluateLicense("ARXIV-NONEXCLUSIVE", "quote_commentary").allowed, true);
  assert.equal(evaluateLicense("ARXIV-NONEXCLUSIVE", "translate_fulltext").allowed, false);
  assert.equal(evaluateLicense("ARXIV-NONEXCLUSIVE", "commercial_use").allowed, false);
});

test("未收录许可证 fail-closed：仅展示元数据", () => {
  const unknown = evaluateLicense("SOME-UNKNOWN-LICENSE", "display_abstract");
  assert.equal(unknown.allowed, false);
  assert.equal(unknown.code, "license_not_recognized");

  const metadata = evaluateLicense("SOME-UNKNOWN-LICENSE", "display_metadata");
  assert.equal(metadata.allowed, true);

  const adapt = evaluateLicense("SOME-UNKNOWN-LICENSE", "adapt_fulltext");
  assert.equal(adapt.allowed, false);
});

test("短引用 + 评论始终标记为需法务复核", () => {
  const result = evaluateLicense("CC-BY-4.0", "quote_commentary");
  assert.equal(result.allowed, true);
  assert.equal(result.legalReview, true);
});

test("样例清单全部通过，且包含需复核项", () => {
  const path = new URL("../../content/license-manifest.json", import.meta.url);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const result = checkManifest(manifest);

  assert.equal(result.papers, 9);
  assert.equal(result.denied, 0);
  assert.ok(result.checks > 0);
  assert.ok(result.warnings > 0);
});

test("清单中出现越权操作时会被拒绝并计数", () => {
  const result = checkManifest({
    commercial: true,
    papers: [
      { id: "nc-paper", title: "NC", license: "CC-BY-NC-4.0", uses: ["translate_fulltext"] },
      { id: "nd-paper", title: "ND", license: "CC-BY-ND-4.0", uses: ["adapt_fulltext"] },
      { id: "ok-paper", title: "OK", license: "CC-BY-4.0", uses: ["display_abstract"] }
    ]
  });

  assert.equal(result.denied, 2);
  assert.equal(result.rows.filter(row => !row.allowed).length, 2);
});

test("格式错误的清单条目会被拒绝", () => {
  const result = checkManifest({
    papers: [
      { id: "missing-license", uses: ["display_abstract"] },
      { id: "missing-uses", license: "CC-BY-4.0" }
    ]
  });

  assert.equal(result.denied, 2);
  assert.ok(result.rows.every(row => row.code === "malformed_entry"));
});
