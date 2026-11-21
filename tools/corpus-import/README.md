# 本地语料导入（AI Top50）

把本地 AI Top50 数据集转换为 App 可入库的本地语料，**不提交到仓库**。

## 用法

```bash
node tools/corpus-import/build-top50.mjs \
  --dataset ~/goldstock-releases/ai-papers-top50-2026-11-16/ai-papers-top50-2026-11-16.json
```

输出默认写入 `content/local/top50.json`（已在 `.gitignore` 中忽略）。

之后运行：

```bash
node server/ingest.mjs
```

入库流水线会自动合并该文件：演示语料 18 篇 + 本地新增 41 篇 = 59 篇。9 篇重叠论文（SVM、PSO、NSGA-II、EM、模拟退火、SMOTE、反向传播、Kalman、差分进化）复用已有 id，不重复导入。

## 数据来源与许可

- 元数据来自本地 Top50 清单（标题、作者、年份、引用量、DOI/arXiv、主题）。
- 期刊名与开放许可优先查询 OpenAlex；查询失败时回退为通用期刊名。
- 许可策略：
  - OpenAlex 标注 CC 许可 → 使用对应 CC 代码；
  - arXiv 预印本 → `ARXIV-NONEXCLUSIVE`（允许展示与评论，不允许翻译/改编/商业使用）；
  - 其余 → `UNVERIFIED`（仅元数据与平台摘要，不开放 AI 解读）。
- `top50-details.json` 保存按排名整理的中文摘要与标志性公式，均为平台原创概述，不含原文摘录或逐句翻译。
- `top50-interpretations.json` 按排名保存结构化解读（`top50-details.json` 内的 6 篇 + 该文件的 11 篇，共 17 篇），界面标注“AI 辅助整理 · 待复核”。
- ResNet 通过 `license` 覆盖使用 arXiv 预印本许可（CVPR 正式版仍为出版社版权）；这是人工判断，需后续复核。
- 没有条目覆盖的论文会回退到“待整理”占位提示。

## 本地语料结构

`content/local/top50.json` 与 `prototype/js/data.js` 的论文结构一致，另含一个 `topics` 数组：

```json
{
  "commercial": true,
  "papers": [{ "id": "t50-1-...", "titleZh": "...", "license": { "spdx": "UNVERIFIED" } }],
  "topics": [{ "id": "ai-top50", "name": "AI 必读 Top50", "papers": ["..."] }]
}
```

`server/ingest.mjs` 会跳过与演示语料重复的 id，并合并本地专题。
