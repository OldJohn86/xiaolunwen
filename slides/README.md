# 答辩幻灯片

零依赖 HTML 幻灯片，12 页，16:9。可直接用浏览器放映，也可导出 PDF。

## 放映

```bash
open slides/index.html
```

或启动静态服务后访问 `http://localhost:8123/slides/index.html`（需从仓库根目录托管）。

快捷键：

| 键 | 作用 |
| --- | --- |
| → / ↓ / Space / Enter | 下一页 |
| ← / ↑ / Backspace | 上一页 |
| N | 显示/隐藏讲稿 |
| T | 开始/暂停排练计时（超过 8 分钟变红） |
| R | 重置计时 |
| F | 全屏 |
| Home / End | 第一页 / 最后一页 |

讲稿来自每页的 `<aside class="notes">`，只显示在讲稿面板，不会出现在打印结果里。

## 导出 PDF

浏览器的打印对话框：横向、边距“无”、勾选“背景图形”，保存为 PDF。

或使用 Chromium：

```bash
chrome --headless --print-to-pdf=docs/pitch-deck.pdf \
  --no-pdf-header-footer slides/index.html
```

仓库已附 `docs/pitch-deck.pdf`（12 页）。

## 修改

- 内容：直接编辑 `slides/index.html` 的 `<section class="slide">`。
- 讲稿：编辑每页的 `<aside class="notes">`。
- 图片：引用 `../docs/assets/` 下的截图；替换后重新导出 PDF。
- 配色：顶部 `:root` 变量；主色 `--accent: #b45309`，背景 `--bg: #f3f0e8`。

## 页面结构

1. 封面
2. 痛点
3. 方案（四层结构）
4. 发现页
5. 论文证据链
6. 许可证合规
7. 复核工作台
8. 指标闭环
9. 差异化
10. 当前进展
11. 路线图
12. 结语与需求
