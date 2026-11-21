# M1 最小后端

零依赖 Node 服务：SQLite 入库 + JSON API + 同源托管原型。

## 运行

```bash
# 1. 入库（读取 prototype/js/data.js，按许可证裁剪字段）
node server/ingest.mjs

# 2. 启动（默认 127.0.0.1:8787）
node server/server.mjs

# 浏览器打开 http://127.0.0.1:8787/
# API 健康检查 http://127.0.0.1:8787/api/health
```

环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `XLW_DB` | `server/data/content.db` | SQLite 文件路径 |
| `PORT` | `8787` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址 |

数据库文件默认被 `.gitignore` 忽略。

## 入库行为

1. 逐篇读取原型数据，用 `tools/license-check` 计算许可证允许的操作集合。
2. 只写入被允许的字段：
   - 所有文献：元数据、平台整理摘要、思辨问题。
   - `quote_commentary` 允许：AI 结构化解读（预印本与出版社文献目前也允许，但标记为需法务复核）。
   - `adapt_fulltext` 允许：演示说明；否则标记 `licenseBlocked`。
3. 商业使用、全文翻译、改编等能力以 `license.allowed` 映射随 API 返回，供前端隐藏入口。
4. 每次判断写入 `ingest_log`，便于审计。

当前示例清单结果：9 篇论文、35 项检查、7 项拒绝、4 项需法务复核。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查与内容计数 |
| GET | `/api/bootstrap` | 前端聚合数据：论文、概念、专题、讨论 |
| GET | `/api/papers?field=&tag=&q=` | 论文列表（不含解读正文） |
| GET | `/api/papers/:id` | 论文详情、许可证能力、解读、讨论 |
| GET | `/api/papers/:id/comments` | 讨论列表 |
| POST | `/api/papers/:id/comments` | 发表讨论 `{ author, body }` |
| GET | `/api/concepts` | 概念卡与关联论文 |
| GET | `/api/topics` | 专题合集 |
| GET | `/api/license/:code?action=&commercial=` | 查询某个许可证的操作判定 |

示例：

```bash
curl http://127.0.0.1:8787/api/papers/einstein-1905
curl "http://127.0.0.1:8787/api/license/CC-BY-NC-4.0?action=translate_fulltext"
```

## 测试

```bash
node --test server/api.test.mjs
node --test tools/license-check/check.test.mjs
```

测试会创建临时数据库与随机端口，不会污染本地数据。

## 已知边界

- 这是 M1 骨架，不是生产后端：无账号、无鉴权、无审核队列、无速率限制。
- 使用 `node:sqlite`（Node 22 内置，实验特性），正式环境按技术方案切换 PostgreSQL。
- 讨论区直接写库，正式上线需先审后发、敏感词与模型审核。
- 摘要为平台整理文本，不是逐句翻译；全文翻译能力受许可证控制。
