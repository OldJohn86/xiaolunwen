#!/usr/bin/env node
/**
 * 内容完整性检查器
 *
 * 把“去伪存真”的编辑规则变成可执行检查：
 * - 每篇论文必须有标题、来源、许可证与摘要
 * - 结构化解读必须逐段带出处；无出处的解读不允许发布
 * - UNVERIFIED 文献不得包含结构化解读
 * - 概念与专题只能引用已存在的论文
 *
 * 用法：
 *   node tools/quality-check/check.mjs
 *   node tools/quality-check/check.mjs --json
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { LICENSES, evaluateLicense, normalizeLicense } from "../license-check/check.mjs";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const demo = require(resolve(repoRoot, "prototype/js/data.js"));
const LOCAL_CORPUS = resolve(repoRoot, "content/local/top50.json");

export function loadCorpus() {
  const papers = [...demo.papers];
  const concepts = [...demo.concepts];
  const topics = [...demo.topics];

  if (existsSync(LOCAL_CORPUS)) {
    try {
      const local = JSON.parse(readFileSync(LOCAL_CORPUS, "utf8"));
      if (Array.isArray(local.papers)) papers.push(...local.papers);
      if (Array.isArray(local.topics)) topics.push(...local.topics);
    } catch (error) {
      return { papers, concepts, topics, loadError: error.message };
    }
  }

  return { papers, concepts, topics, loadError: null };
}

export function validateCorpus(corpus) {
  const errors = [];
  const warnings = [];
  const papers = Array.isArray(corpus.papers) ? corpus.papers : [];
  const concepts = Array.isArray(corpus.concepts) ? corpus.concepts : [];
  const topics = Array.isArray(corpus.topics) ? corpus.topics : [];
  const ids = new Set();

  for (const paper of papers) {
    const label = paper && paper.id ? paper.id : "(缺少 id)";
    if (!paper || !paper.id) {
      errors.push(`${label}: 缺少论文 id`);
      continue;
    }
    if (ids.has(paper.id)) errors.push(`${label}: 重复的论文 id`);
    ids.add(paper.id);

    for (const field of ["titleZh", "titleEn", "authors", "journal", "link", "abstractZh"]) {
      if (!paper[field] || !String(paper[field]).trim()) {
        errors.push(`${label}: 缺少 ${field}`);
      }
    }
    if (!Number.isInteger(paper.year) || paper.year < 1000 || paper.year > 2100) {
      errors.push(`${label}: year 无效`);
    }
    if (!paper.license || !paper.license.code) {
      errors.push(`${label}: 缺少许可证信息`);
      continue;
    }

    const licenseCode = normalizeLicense(paper.license.spdx || "");
    if (!Object.prototype.hasOwnProperty.call(LICENSES, licenseCode)) {
      errors.push(`${label}: 未收录的许可证 ${paper.license.spdx || "(空)"}`);
    }

    if (paper.interpretation) {
      if (licenseCode === "UNVERIFIED") {
        errors.push(`${label}: UNVERIFIED 文献不得包含结构化解读`);
      } else {
        const judgement = evaluateLicense(licenseCode, "quote_commentary");
        if (!judgement.allowed) {
          errors.push(`${label}: 许可证不允许评论/引用，但仍包含解读`);
        }
      }

      if (!Array.isArray(paper.interpretation) || paper.interpretation.length < 3) {
        errors.push(`${label}: 解读段落少于 3 段`);
      } else {
        const labels = new Set();
        for (const [index, item] of paper.interpretation.entries()) {
          const position = `${label} 解读#${index + 1}`;
          if (!item || !String(item.text || "").trim()) errors.push(`${position}: 缺少正文`);
          if (!item || !String(item.ref || "").trim()) errors.push(`${position}: 缺少原文出处（ref）`);
          if (item && item.label) {
            if (labels.has(item.label)) errors.push(`${position}: 重复的段落标签 ${item.label}`);
            labels.add(item.label);
          }
          if (item && String(item.text || "").trim().length < 20) {
            warnings.push(`${position}: 正文较短，建议补充`);
          }
        }
        if (paper.interpretation.length < 5) {
          warnings.push(`${label}: 解读少于 5 段，确认是否遗漏争议或局限`);
        }
      }
    }

    if (paper.license && paper.license.deep && licenseCode === "UNVERIFIED") {
      errors.push(`${label}: UNVERIFIED 不能标记为可深度处理`);
    }
    if (paper.link && !/^https?:\/\//.test(paper.link)) {
      warnings.push(`${label}: link 不是完整 URL`);
    }
    if (paper.abstractZh && String(paper.abstractZh).trim().length < 20) {
      warnings.push(`${label}: 中文摘要过短`);
    }
  }

  const checkReferences = (items, kind) => {
    const seen = new Set();
    for (const item of items) {
      if (!item || !item.id) {
        errors.push(`${kind}: 缺少 id`);
        continue;
      }
      if (seen.has(item.id)) errors.push(`${kind} ${item.id}: 重复 id`);
      seen.add(item.id);
      if (!Array.isArray(item.papers) || !item.papers.length) {
        errors.push(`${kind} ${item.id}: 没有关联论文`);
        continue;
      }
      for (const paperId of item.papers) {
        if (!ids.has(paperId)) {
          errors.push(`${kind} ${item.id}: 引用了不存在的论文 ${paperId}`);
        }
      }
    }
  };

  checkReferences(concepts, "概念");
  checkReferences(topics, "专题");

  return {
    errors,
    warnings,
    stats: {
      papers: papers.length,
      withInterpretation: papers.filter(paper => paper.interpretation).length,
      unverified: papers.filter(paper => normalizeLicense(paper.license && paper.license.spdx) === "UNVERIFIED").length,
      concepts: concepts.length,
      topics: topics.length
    }
  };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const asJson = process.argv.includes("--json");
  const corpus = loadCorpus();

  if (corpus.loadError) {
    console.error(`本地语料读取失败：${corpus.loadError}`);
    process.exit(2);
  }

  const result = validateCorpus(corpus);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.errors.length ? 1 : 0);
  }

  console.log("");
  console.log("内容完整性检查");
  console.log("─".repeat(64));
  console.log(
    `${result.stats.papers} 篇 · ${result.stats.withInterpretation} 篇有解读 · ` +
    `${result.stats.unverified} 篇待核对许可证 · ${result.stats.concepts} 张概念卡 · ${result.stats.topics} 个专题`
  );
  console.log("─".repeat(64));

  if (result.errors.length) {
    console.log(`✗ ${result.errors.length} 项错误：`);
    for (const error of result.errors) console.log(`  - ${error}`);
  } else {
    console.log("✓ 没有完整性错误");
  }

  if (result.warnings.length) {
    console.log(`△ ${result.warnings.length} 项提醒：`);
    for (const warning of result.warnings.slice(0, 12)) console.log(`  - ${warning}`);
    if (result.warnings.length > 12) console.log(`  … 以及 ${result.warnings.length - 12} 项`);
  }

  console.log("");
  process.exit(result.errors.length ? 1 : 0);
}
