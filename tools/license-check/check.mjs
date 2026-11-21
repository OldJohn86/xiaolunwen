#!/usr/bin/env node
/**
 * 许可证校验器
 *
 * 把产品方案中的内容准入规则编码成可执行逻辑：
 * - 非商业（NC）内容不得进入付费/商业路径
 * - 禁止演绎（ND）内容不得做全文翻译、改编或全文音频
 * - 未收录的许可证 fail-closed，只允许展示元数据
 * - 短引用 + 评论属于合理使用范畴，但仍需法务复核并标注来源
 *
 * 注意：本工具是产品合规策略，不构成法律意见。合理使用/合理利用的边界
 * 因司法辖区而异，正式上线前需逐篇核对并取得法务确认。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

export const ACTIONS = [
  "display_metadata",
  "display_abstract",
  "quote_commentary",
  "translate_fulltext",
  "adapt_fulltext",
  "audio_fulltext",
  "redistribute_fulltext",
  "commercial_use"
];

export const ACTION_LABEL = {
  display_metadata: "展示元数据",
  display_abstract: "展示摘要",
  quote_commentary: "短引用 + 评论",
  translate_fulltext: "全文翻译",
  adapt_fulltext: "全文改编",
  audio_fulltext: "全文音频",
  redistribute_fulltext: "再分发全文",
  commercial_use: "商业性使用"
};

/**
 * 许可证白名单。字段含义：
 * commercial   是否允许商业性使用
 * derivatives  是否允许演绎（翻译、改编、全文音频）
 * redistribution 是否允许再分发全文
 * attribution  是否要求署名
 * shareAlike   是否要求相同方式共享
 */
export const LICENSES = {
  "PUBLIC-DOMAIN": {
    label: "公有领域",
    commercial: true, derivatives: true, redistribution: true,
    attribution: false, shareAlike: false
  },
  "CC0-1.0": {
    label: "CC0 1.0",
    commercial: true, derivatives: true, redistribution: true,
    attribution: false, shareAlike: false
  },
  "CC-BY-4.0": {
    label: "CC BY 4.0",
    commercial: true, derivatives: true, redistribution: true,
    attribution: true, shareAlike: false
  },
  "CC-BY-3.0": {
    label: "CC BY 3.0",
    commercial: true, derivatives: true, redistribution: true,
    attribution: true, shareAlike: false
  },
  "CC-BY-SA-4.0": {
    label: "CC BY-SA 4.0",
    commercial: true, derivatives: true, redistribution: true,
    attribution: true, shareAlike: true
  },
  "CC-BY-NC-4.0": {
    label: "CC BY-NC 4.0",
    commercial: false, derivatives: true, redistribution: true,
    attribution: true, shareAlike: false
  },
  "CC-BY-NC-SA-4.0": {
    label: "CC BY-NC-SA 4.0",
    commercial: false, derivatives: true, redistribution: true,
    attribution: true, shareAlike: true
  },
  "CC-BY-ND-4.0": {
    label: "CC BY-ND 4.0",
    commercial: true, derivatives: false, redistribution: true,
    attribution: true, shareAlike: false
  },
  "CC-BY-NC-ND-4.0": {
    label: "CC BY-NC-ND 4.0",
    commercial: false, derivatives: false, redistribution: true,
    attribution: true, shareAlike: false
  },
  "ARXIV-NONEXCLUSIVE": {
    label: "arXiv 非独占许可",
    commercial: false, derivatives: false, redistribution: true,
    attribution: true, shareAlike: false
  },
  "PROPRIETARY-ABSTRACT-ONLY": {
    label: "出版社版权（仅摘要）",
    commercial: false, derivatives: false, redistribution: false,
    attribution: true, shareAlike: false
  },
  "UNVERIFIED": {
    label: "许可证待核对",
    commercial: false, derivatives: false, redistribution: false,
    attribution: true, shareAlike: false, unverified: true
  }
};

export function normalizeLicense(code) {
  return String(code || "").trim().toUpperCase();
}

/**
 * 判断某个许可证下能否执行某个操作。
 * 默认按商业产品评估（平台含会员等商业路径）。
 */
export function evaluateLicense(code, action, options = {}) {
  const commercial = options.commercial !== false;
  const key = normalizeLicense(code);
  const license = LICENSES[key];
  const base = {
    license: key,
    action,
    commercial,
    attribution: license ? license.attribution : true,
    shareAlike: license ? license.shareAlike : false,
    legalReview: false
  };

  if (!ACTIONS.includes(action)) {
    return { ...base, allowed: false, code: "unknown_action", reason: `未知操作：${action}` };
  }

  if (!license) {
    const allowed = action === "display_metadata";
    return {
      ...base,
      allowed,
      code: allowed ? "metadata_only" : "license_not_recognized",
      reason: allowed
        ? "许可证未收录，fail-closed：仅允许展示元数据"
        : "许可证未收录，禁止展示摘要与任何演绎内容，需人工确认"
    };
  }

  if (action === "display_metadata") {
    return { ...base, allowed: true, code: "ok", reason: "允许展示元数据" };
  }

  if (action === "display_abstract") {
    return { ...base, allowed: true, code: "ok", reason: "允许展示摘要（非全文）" };
  }

  if (action === "quote_commentary") {
    if (license.unverified) {
      return {
        ...base,
        allowed: false,
        code: "license_unverified",
        reason: "许可证待核对：仅展示元数据与平台摘要，暂不开放 AI 解读与原文引用"
      };
    }
    return {
      ...base,
      allowed: true,
      code: "legal_review_required",
      reason: "允许短引用 + 评论，但需标注来源并限制引用长度，正式上线前需法务复核合理使用边界",
      legalReview: true
    };
  }

  if (action === "translate_fulltext" || action === "adapt_fulltext" || action === "audio_fulltext") {
    if (!license.derivatives) {
      return {
        ...base,
        allowed: false,
        code: "no_derivatives",
        reason: `${license.label} 禁止演绎：不得进行全文翻译、改编或全文音频`
      };
    }
    if (commercial && !license.commercial) {
      return {
        ...base,
        allowed: false,
        code: "noncommercial_only",
        reason: `${license.label} 仅限非商业使用，不得进入会员/付费路径`
      };
    }
    return {
      ...base,
      allowed: true,
      code: "ok",
      reason: `允许${license.commercial ? "" : "非商业性"}演绎${license.attribution ? "，需署名" : ""}${license.shareAlike ? "，需相同方式共享" : ""}`
    };
  }

  if (action === "redistribute_fulltext") {
    return license.redistribution
      ? { ...base, allowed: true, code: "ok", reason: "允许再分发全文（需保留许可证与署名）" }
      : { ...base, allowed: false, code: "no_redistribution", reason: `${license.label} 不允许再分发全文` };
  }

  if (action === "commercial_use") {
    return license.commercial
      ? { ...base, allowed: true, code: "ok", reason: "允许商业性使用" }
      : { ...base, allowed: false, code: "noncommercial_only", reason: `${license.label} 仅限非商业使用` };
  }

  return { ...base, allowed: false, code: "unhandled", reason: "未处理的操作" };
}

/**
 * 校验一份内容清单。
 * manifest 结构：
 * {
 *   "commercial": true,
 *   "papers": [{ "id", "title", "license", "uses": ["display_abstract", ...] }]
 * }
 */
export function checkManifest(manifest, options = {}) {
  const papers = Array.isArray(manifest.papers) ? manifest.papers : [];
  const commercial = options.commercial !== undefined
    ? Boolean(options.commercial)
    : manifest.commercial !== false;

  const rows = [];
  let denied = 0;
  let warnings = 0;

  for (const paper of papers) {
    if (!paper || !paper.id || !paper.license || !Array.isArray(paper.uses)) {
      rows.push({
        id: paper && paper.id ? paper.id : "(invalid)",
        title: paper && paper.title ? paper.title : "",
        allowed: false,
        code: "malformed_entry",
        reason: "清单条目缺少 id / license / uses",
        legalReview: false
      });
      denied += 1;
      continue;
    }

    for (const action of paper.uses) {
      const result = evaluateLicense(paper.license, action, { commercial });
      if (!result.allowed) denied += 1;
      if (result.legalReview) warnings += 1;
      rows.push({
        id: paper.id,
        title: paper.title || "",
        license: paper.license,
        action,
        ...result
      });
    }
  }

  return {
    commercial,
    papers: papers.length,
    checks: rows.length,
    denied,
    warnings,
    rows
  };
}

/* ---------- CLI ---------- */

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const file = args.find(arg => !arg.startsWith("--"));

  if (!file) {
    console.error("用法: node tools/license-check/check.mjs <manifest.json> [--json]");
    process.exit(2);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(file), "utf8"));
  } catch (error) {
    console.error(`无法读取清单：${error.message}`);
    process.exit(2);
  }

  const result = checkManifest(manifest);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.denied > 0 ? 1 : 0);
  }

  console.log("");
  console.log(`许可证校验 · 商业模式：${result.commercial ? "商业（含会员/付费）" : "非商业"} · 规则版本：v0.2`);
  console.log("─".repeat(72));

  for (const row of result.rows) {
    const mark = row.allowed ? (row.legalReview ? "△" : "✓") : "✗";
    const label = ACTION_LABEL[row.action] || row.action;
    console.log(`${mark} ${row.id.padEnd(24)} ${label.padEnd(12)} ${row.reason}`);
  }

  console.log("─".repeat(72));
  console.log(
    `${result.papers} 篇 · ${result.checks} 项检查 · ${result.denied} 项拒绝 · ${result.warnings} 项需法务复核`
  );
  console.log("图例：✓ 通过   △ 通过但需法务复核   ✗ 拒绝（退出码 1）");
  console.log("");

  process.exit(result.denied > 0 ? 1 : 0);
}
