import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { validateCorpus } from "./check.mjs";

const require = createRequire(import.meta.url);
const demo = require("../../prototype/js/data.js");

const basePaper = {
  id: "paper-1",
  titleZh: "测试论文",
  titleEn: "A Test Paper",
  authors: "Test Author",
  journal: "Test Journal",
  year: 2020,
  link: "https://doi.org/10.0000/test",
  abstractZh: "这是一段足够长的测试摘要，用于验证内容完整性检查器。",
  license: { spdx: "CC-BY-4.0", code: "CC BY 4.0" }
};

const interpretation = [
  { label: "研究假设", text: "这是一段足够长的研究假设说明。", ref: "§1" },
  { label: "实验设计", text: "这是一段足够长的实验设计说明。", ref: "§2" },
  { label: "核心结论", text: "这是一段足够长的核心结论说明。", ref: "§3" }
];

test("合法语料没有错误", () => {
  const result = validateCorpus({
    papers: [{ ...basePaper, interpretation }],
    concepts: [{ id: "c1", name: "概念", papers: ["paper-1"] }],
    topics: [{ id: "t1", name: "专题", papers: ["paper-1"] }]
  });
  assert.equal(result.errors.length, 0);
});

test("演示语料通过完整性检查", () => {
  const result = validateCorpus(demo);
  assert.equal(result.errors.length, 0);
});

test("重复论文 id 会报错", () => {
  const result = validateCorpus({ papers: [basePaper, { ...basePaper }] });
  assert.ok(result.errors.some(error => error.includes("重复的论文 id")));
});

test("UNVERIFIED 文献不得包含结构化解读", () => {
  const result = validateCorpus({
    papers: [{
      ...basePaper,
      license: { spdx: "UNVERIFIED", code: "待核对" },
      interpretation
    }]
  });
  assert.ok(result.errors.some(error => error.includes("UNVERIFIED")));
});

test("解读缺少原文出处会报错", () => {
  const result = validateCorpus({
    papers: [{
      ...basePaper,
      interpretation: interpretation.map((item, index) => index === 1 ? { ...item, ref: "" } : item)
    }]
  });
  assert.ok(result.errors.some(error => error.includes("缺少原文出处")));
});

test("未知许可证会报错", () => {
  const result = validateCorpus({
    papers: [{ ...basePaper, license: { spdx: "NOT-A-LICENSE", code: "未知" } }]
  });
  assert.ok(result.errors.some(error => error.includes("未收录的许可证")));
});

test("概念引用不存在的论文会报错", () => {
  const result = validateCorpus({
    papers: [basePaper],
    concepts: [{ id: "c1", name: "概念", papers: ["missing-paper"] }]
  });
  assert.ok(result.errors.some(error => error.includes("引用了不存在的论文")));
});

test("解读少于 3 段会报错", () => {
  const result = validateCorpus({
    papers: [{ ...basePaper, interpretation: interpretation.slice(0, 2) }]
  });
  assert.ok(result.errors.some(error => error.includes("少于 3 段")));
});
