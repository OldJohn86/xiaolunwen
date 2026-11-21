#!/usr/bin/env node
/**
 * 把本地 AI Top50 数据集转换为 App 可入库的本地语料。
 *
 * 输入：ai-papers-top50-2026-11-16.json（含中文标题、作者、年份、DOI/arXiv、主题）
 * 输出：content/local/top50.json（gitignore，不入库）
 *
 * 设计原则：
 * - 不复制 PDF 全文或原文摘要；中文摘要为待整理提示，指向原文链接。
 * - 许可证优先采用 OpenAlex 标注；无标注时 arXiv 用 ARXIV-NONEXCLUSIVE，其余 UNVERIFIED。
 * - 与现有 9 篇经典论文重叠的条目复用原 id，避免重复。
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const demo = require(resolve(repoRoot, "prototype/js/data.js"));

const DEFAULT_DATASET = process.env.XLW_TOP50_DATASET || "";
const DEFAULT_OUT = resolve(repoRoot, "content/local/top50.json");
const DETAILS_PATH = resolve(here, "top50-details.json");
const INTERPRETATIONS_PATH = resolve(here, "top50-interpretations.json");

let details = {};
try {
  details = JSON.parse(readFileSync(DETAILS_PATH, "utf8"));
} catch {
  console.warn("未找到 top50-details.json，将使用占位摘要");
}

let interpretations = {};
try {
  interpretations = JSON.parse(readFileSync(INTERPRETATIONS_PATH, "utf8"));
} catch {
  /* 可选文件：没有结构化解读时仅展示摘要 */
}

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const datasetPath = argValue("--dataset", DEFAULT_DATASET);
const outPath = argValue("--out", DEFAULT_OUT);
const skipOpenAlex = args.includes("--no-openalex");

function normalizeDoi(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .replace(/^doi:\s*/, "");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const FIELD_BY_TOPIC = {
  "计算机视觉": "计算机",
  "自然语言处理": "计算机",
  "机器学习": "计算机",
  "强化学习": "计算机",
  "数据挖掘": "计算机",
  "人工智能": "计算机",
  "信息论": "数学",
  "优化": "数学",
  "统计学": "数学",
  "概率统计": "数学"
};

const LICENSE_MAP = {
  "cc-by": { spdx: "CC-BY-4.0", code: "CC BY 4.0" },
  "cc-by-sa": { spdx: "CC-BY-SA-4.0", code: "CC BY-SA 4.0" },
  "cc-by-nc": { spdx: "CC-BY-NC-4.0", code: "CC BY-NC 4.0" },
  "cc-by-nc-sa": { spdx: "CC-BY-NC-SA-4.0", code: "CC BY-NC-SA 4.0" },
  "cc-by-nd": { spdx: "CC-BY-ND-4.0", code: "CC BY-ND 4.0" },
  "cc-by-nc-nd": { spdx: "CC-BY-NC-ND-4.0", code: "CC BY-NC-ND 4.0" },
  "cc0": { spdx: "CC0-1.0", code: "CC0 1.0" },
  "public-domain": { spdx: "PUBLIC-DOMAIN", code: "公有领域" }
};

function licenseFor(paper, openAlex) {
  const license = openAlex && openAlex.primary_location && openAlex.primary_location.license;
  if (license && LICENSE_MAP[license]) {
    return {
      ...LICENSE_MAP[license],
      note: "OpenAlex 标注的开放许可，仍需核对具体版本与附加条款",
      source: "OpenAlex primary_location.license",
      deep: false,
      commercial: true,
      derivatives: true
    };
  }
  if (paper.arxiv_id) {
    return {
      spdx: "ARXIV-NONEXCLUSIVE",
      code: "arXiv 许可",
      note: "arXiv 预印本，作者保留翻译与改编权；需逐篇核对版本许可",
      source: paper.arxiv_id ? `https://arxiv.org/abs/${paper.arxiv_id}` : "arXiv",
      deep: false,
      commercial: false,
      derivatives: false
    };
  }
  return {
    spdx: "UNVERIFIED",
    code: "待核对",
    note: "本地导入，未获取到开放许可；仅展示元数据与平台摘要",
    source: "本地导入，未获取开放许可",
    deep: false,
    commercial: false,
    derivatives: false
  };
}

function venueFor(paper, openAlex) {
  if (paper.arxiv_id) return "arXiv";
  const location = openAlex && openAlex.primary_location;
  if (location) {
    if (location.raw_source_name) return location.raw_source_name;
    if (location.source && location.source.display_name) {
      return location.source.display_name.split("/")[0].trim();
    }
  }
  return "期刊 / 会议论文";
}

async function fetchOpenAlex(papers) {
  if (skipOpenAlex) return new Map();
  const ids = papers
    .map(paper => (paper.openalex_id || "").split("/").pop())
    .filter(Boolean);
  if (!ids.length) return new Map();

  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("filter", `openalex_id:${ids.join("|")}`);
  url.searchParams.set("per-page", "50");
  url.searchParams.set("select", "id,doi,display_name,primary_location");
  url.searchParams.set("mailto", "local@example.invalid");

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "xiaolunwen-prototype/0.2" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return new Map(
      (payload.results || []).map(item => [item.id.split("/").pop(), item])
    );
  } catch (error) {
    console.warn(`OpenAlex 查询失败，回退到通用期刊名：${error.message}`);
    return new Map();
  }
}

if (!datasetPath) {
  console.error("用法: node tools/corpus-import/build-top50.mjs --dataset <ai-papers-top50.json> [--out <path>]");
  process.exit(2);
}

const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));
const papers = Array.isArray(dataset) ? dataset : dataset.papers || dataset.items || [];
if (!papers.length) {
  console.error("数据集中没有论文条目");
  process.exit(1);
}

const existingByDoi = new Map();
for (const paper of demo.papers) {
  const doi = normalizeDoi(paper.link);
  if (doi.startsWith("10.")) existingByDoi.set(doi, paper.id);
}

const openAlexMap = await fetchOpenAlex(papers);
const existingIds = new Set(demo.papers.map(paper => paper.id));
const usedIds = new Set(existingIds);
const entries = [];
const paperIds = [];

for (const paper of papers) {
  const doi = normalizeDoi(paper.doi || paper.url);
  const existingId = existingByDoi.get(doi);
  const openAlex = openAlexMap.get((paper.openalex_id || "").split("/").pop());
  const detail = details[String(paper.rank)] || {};
  const license = detail.license
    ? { deep: false, commercial: false, derivatives: false, ...detail.license }
    : licenseFor(paper, openAlex);
  const venue = venueFor(paper, openAlex);

  let id = existingId;
  if (!id) {
    const base = `t50-${paper.rank}-${slugify(paper.title) || "paper"}`;
    id = base;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
  }
  paperIds.push(id);

  if (existingId) continue;

  entries.push({
    id,
    sourceRank: paper.rank,
    topic: paper.topic || "",
    titleZh: paper.zh_title || paper.title,
    titleEn: paper.title,
    authors: Array.isArray(paper.authors) && paper.authors.length
      ? paper.authors.join(", ")
      : paper.first_author || "",
    journal: venue,
    year: paper.year,
    citations: paper.citations || 0,
    field: FIELD_BY_TOPIC[paper.topic] || "计算机",
    nobel: null,
    tag: "logic",
    license,
    abstractZh: detail.abstractZh || `该论文是“${paper.topic || "人工智能"}”方向的代表性工作，主题为“${paper.zh_title || paper.title}”。完整中文摘要与论证拆解待许可证核对与编辑复核后开放。`,
    abstractEn: "",
    formula: detail.formula || "",
    interpretation: detail.interpretation || interpretations[String(paper.rank)] || null,
    demo: null,
    thinking: detail.thinking || [
      "这篇论文试图解决什么问题，为什么重要？",
      "作者用什么方法与证据支持结论？",
      "结论的适用范围与局限是什么？"
    ],
    link: paper.url || (paper.doi ? `https://doi.org/${paper.doi}` : `https://arxiv.org/abs/${paper.arxiv_id}`),
    originalLang: "en"
  });
}

const output = {
  generatedAt: new Date().toISOString(),
  source: datasetPath,
  commercial: true,
  papers: entries,
  topics: [
    {
      id: "ai-top50",
      name: "AI 必读 Top50",
      desc: "从 1948 年的通信理论到 GPT-4：AI 领域被引用最多的 50 篇论文。",
      tone: "blue",
      papers: paperIds
    }
  ]
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

console.log(`已生成本地语料：${outPath}`);
console.log(`总计 ${papers.length} 篇，其中新增 ${entries.length} 篇，复用既有 ${papers.length - entries.length} 篇`);
console.log("下一步：node server/ingest.mjs（会自动合并 content/local/top50.json）");
