# 本地 PDF 导入工具

把本地下载的论文 PDF 变成“候选元数据清单”，**不替代许可证判断，也不导入全文**。

## 依赖

- Python 3.10+
- poppler：`brew install poppler`（提供 `pdfinfo` / `pdftotext`）

## 流程

```bash
# 1. 提取候选元数据与摘要片段（输出默认写入 content/local/，已被 gitignore）
python3 tools/pdf-import/extract.py ~/Downloads/Papers \
  --out content/local/import-candidates.json

# 2. 逐篇核对
#    - DOI / 标题 / 作者 / 年份 / 期刊（推荐用 Crossref：https://api.crossref.org/works/<DOI>）
#    - 许可证：以期刊页面或 Crossref license 字段为准
#    - 无法确认时一律标记 UNVERIFIED

# 3. 人工整理后加入 prototype/js/data.js 与 content/license-manifest.json
```

## 规则

- **不提交 PDF 原文与全文翻译**。仓库只保留元数据、平台撰写的摘要与思辨问题。
- 许可证未确认的文献使用 `UNVERIFIED`：只允许展示元数据与摘要，不开放 AI 解读、翻译、改编或商业使用。
- 平台摘要必须是**自己撰写的概述**，不能是逐句翻译或大段摘录。
- 每次导入后运行：

```bash
node tools/license-check/check.mjs content/license-manifest.json
node --test tools/license-check/check.test.mjs server/api.test.mjs
```

## 本次导入记录

`~/Downloads/Papers` 中的 9 篇论文已按 `UNVERIFIED` 接入“经典算法论文”专题：

- Kalman 1960、NSGA-II 2002、Differential Evolution 1997、Backpropagation 1986
- EM 1977、Simulated Annealing 1983、PSO 1995、SMOTE 2002、SVM 1995

《Reinforcement Learning: An Introduction》（548 页教材）未作为论文入库。反向传播 PDF 为扫描件，文本层缺失，元数据通过 Crossref 核对。

Crossref 核对结果显示这些文献均无明确的开放许可（SMOTE 虽可公开阅读，但 Crossref 未标注开放许可证），因此全部保持 `UNVERIFIED`，等待逐篇复核。
