#!/usr/bin/env python3
"""从本地 PDF 目录提取候选元数据与摘要片段，供人工核对后入库。

依赖 poppler 的 pdfinfo / pdftotext：
    brew install poppler

用法：
    python3 tools/pdf-import/extract.py ~/Downloads/Papers \
        --out content/local/import-candidates.json

输出文件包含 PDF 的标题、作者、页数、DOI 候选与前几页摘要片段。
它只是“候选清单”，不会自动判定许可证，也不应提交到仓库。
"""

import argparse
import datetime
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path


def fail(message: str) -> None:
    print(f"错误：{message}", file=sys.stderr)
    sys.exit(2)


def require_binary(name: str) -> None:
    if not shutil.which(name):
        fail(f"缺少 {name}，请先安装 poppler：brew install poppler")


def read_info(path: Path) -> dict:
    result = subprocess.run(
        ["pdfinfo", str(path)],
        capture_output=True,
        text=True,
        check=False,
    )
    meta = {}
    for line in result.stdout.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        if key in ("Title", "Author", "Pages", "CreationDate", "Producer", "Creator"):
            meta[key] = value.strip()
    return meta


def read_first_pages(path: Path, pages: int) -> str:
    result = subprocess.run(
        ["pdftotext", "-f", "1", "-l", str(pages), "-layout", str(path), "-"],
        capture_output=True,
        text=True,
        check=False,
    )
    text = result.stdout or ""
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{3,}", "  ", text)
    return text.strip()


def extract_item(path: Path, pages: int, snippet_chars: int) -> dict:
    meta = read_info(path)
    text = read_first_pages(path, pages)

    dois = re.findall(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+", text)
    dois = list(dict.fromkeys(doi.rstrip(".,);") for doi in dois))[:4]

    match = re.search(r"\b(Abstract|ABSTRACT|Summary|SUMMARY)\b", text)
    snippet = text[match.start(): match.start() + snippet_chars] if match else text[:snippet_chars]

    return {
        "file": path.name,
        "sizeMb": round(path.stat().st_size / 1024 / 1024, 2),
        "meta": meta,
        "doiCandidates": dois,
        "abstractSnippet": snippet,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="从本地 PDF 提取候选元数据与摘要")
    parser.add_argument("folder", help="PDF 所在目录")
    parser.add_argument(
        "--out",
        default="content/local/import-candidates.json",
        help="输出 JSON 路径（默认 content/local/，已在 .gitignore 中忽略）",
    )
    parser.add_argument("--pages", type=int, default=3, help="读取前几页，默认 3")
    parser.add_argument("--snippet-chars", type=int, default=1600, help="摘要片段长度，默认 1600")
    args = parser.parse_args()

    require_binary("pdfinfo")
    require_binary("pdftotext")

    folder = Path(args.folder).expanduser().resolve()
    if not folder.is_dir():
        fail(f"目录不存在：{folder}")

    pdfs = sorted(folder.glob("*.pdf"))
    if not pdfs:
        fail(f"目录中没有 PDF：{folder}")

    items = [extract_item(path, args.pages, args.snippet_chars) for path in pdfs]

    output = Path(args.out).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generatedAt": datetime.datetime.now().isoformat(timespec="seconds"),
        "sourceFolder": str(folder),
        "warning": "候选清单仅供人工核对；包含 PDF 摘要片段，不要提交到仓库。许可证需逐篇确认。",
        "count": len(items),
        "items": items,
    }
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"已提取 {len(items)} 个 PDF → {output}")
    print("下一步：逐篇核对 DOI、期刊、年份与许可证，再决定入库字段。")


if __name__ == "__main__":
    main()
