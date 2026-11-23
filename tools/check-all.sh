#!/usr/bin/env bash
# 一键质量闸门：许可证 → 内容完整性 → 自动化测试。
# 任一步失败即以非零退出码结束，可直接用于 CI 或本地提交前检查。

set -euo pipefail

cd "$(dirname "$0")/.."

echo ""
echo "== 1/3 许可证校验 =="
node tools/license-check/check.mjs content/license-manifest.json

echo ""
echo "== 2/3 内容完整性 =="
node tools/quality-check/check.mjs

echo ""
echo "== 3/3 自动化测试 =="
node --test \
  server/api.test.mjs \
  tools/license-check/check.test.mjs \
  tools/quality-check/check.test.mjs

echo ""
echo "全部质量闸门通过。"
