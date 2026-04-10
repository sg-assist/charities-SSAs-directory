#!/usr/bin/env python3
"""
Clinical PDF Extractor — layout-aware PDF-to-JSONL pipeline.

Extracts typed content blocks from clinical PDFs (WHO guidelines, UNFPA handbooks,
MOH SOPs) preserving structural integrity of tables and numbered lists.

Unlike the generic pdf-parse approach in ingest-pdfs.ts, this extractor:
  - Keeps tables as atomic blocks (never splits mid-row)
  - Identifies numbered clinical protocol lists
  - Records page numbers for source citations
  - Emits typed JSONL for downstream chunking

Output format (one JSON object per line):
  {"type": "heading", "level": 1, "text": "...", "page": 3}
  {"type": "paragraph", "text": "...", "page": 3}
  {"type": "table", "caption": "...", "rows": [["col1", "col2"], ...], "page": 4}
  {"type": "list", "ordered": true, "items": ["...", "..."], "page": 5}

Usage:
  python3 scripts/extract_clinical_pdf.py <input.pdf> <output.jsonl>
  python3 scripts/extract_clinical_pdf.py <input.pdf> <output.jsonl> --source-name "WHO PCPNC 2023"

Requirements:
  pip install pymupdf camelot-py[cv] opencv-python-headless
"""

import sys
import json
import re
import argparse
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────────────────────

def check_dependencies():
    missing = []
    try:
        import fitz  # pymupdf
    except ImportError:
        missing.append("pymupdf (pip install pymupdf)")
    try:
        import camelot
    except ImportError:
        missing.append("camelot-py[cv] (pip install 'camelot-py[cv]' opencv-python-headless)")
    if missing:
        print("Missing dependencies:", file=sys.stderr)
        for m in missing:
            print(f"  {m}", file=sys.stderr)
        print("\nInstall with:", file=sys.stderr)
        print("  pip install pymupdf 'camelot-py[cv]' opencv-python-headless", file=sys.stderr)
        sys.exit(1)

# ── Heading detection ─────────────────────────────────────────────────────────

HEADING_PATTERNS = [
    (1, re.compile(r'^(CHAPTER|SECTION|PART)\s+\d+', re.IGNORECASE)),
    (2, re.compile(r'^\d+\.\s+[A-Z][A-Za-z\s]{4,}$')),
    (3, re.compile(r'^\d+\.\d+\s+[A-Z][A-Za-z\s]{3,}$')),
]

def detect_heading_level(text: str, font_size: float, avg_body_size: float) -> int | None:
    """Returns heading level 1-4 or None if not a heading."""
    if font_size >= avg_body_size * 1.4:
        return 1
    if font_size >= avg_body_size * 1.2:
        return 2
    if font_size >= avg_body_size * 1.1:
        return 3
    for level, pattern in HEADING_PATTERNS:
        if pattern.match(text.strip()):
            return level
    return None

# ── List detection ────────────────────────────────────────────────────────────

def is_list_item(text: str) -> tuple[bool, bool]:
    """Returns (is_list_item, is_ordered)."""
    text = text.strip()
    if re.match(r'^\d+[\.\)]\s', text):
        return True, True
    if re.match(r'^[a-z][\.\)]\s', text):
        return True, True
    if re.match(r'^[•·▪▸\-\*]\s', text):
        return True, False
    return False, False

# ── Main extraction ───────────────────────────────────────────────────────────

def extract_tables_from_page(pdf_path: str, page_num: int) -> list[dict]:
    """Extract tables from a specific page using Camelot."""
    try:
        import camelot
        tables = camelot.read_pdf(pdf_path, pages=str(page_num + 1), flavor='lattice')
        result = []
        for table in tables:
            df = table.df
            rows = df.values.tolist()
            if len(rows) < 2:
                continue
            # First row as header, rest as data
            result.append({
                "type": "table",
                "caption": "",  # Will be filled from nearby text
                "header": rows[0],
                "rows": rows[1:],
                "page": page_num + 1,
                "accuracy": table.accuracy,
            })
        return result
    except Exception:
        return []

def extract_pdf(pdf_path: str, source_name: str = "") -> list[dict]:
    """Main extraction function — returns list of typed content blocks."""
    import fitz

    doc = fitz.open(pdf_path)
    blocks = []

    # First pass: compute average body font size across the document
    all_sizes = []
    for page in doc:
        for block in page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)["blocks"]:
            if block.get("type") != 0:  # 0 = text
                continue
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    size = span.get("size", 0)
                    if 8 <= size <= 14:  # typical body text range
                        all_sizes.append(size)

    avg_body_size = sum(all_sizes) / len(all_sizes) if all_sizes else 11.0

    # Table pages cache (Camelot is expensive)
    table_pages: dict[int, list[dict]] = {}

    list_buffer: list[str] = []
    list_ordered = False

    def flush_list():
        nonlocal list_buffer, list_ordered
        if list_buffer:
            blocks.append({
                "type": "list",
                "ordered": list_ordered,
                "items": list_buffer[:],
                "page": current_page,
            })
            list_buffer = []

    current_page = 1

    for page_num, page in enumerate(doc):
        current_page = page_num + 1
        page_dict = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)

        # Extract tables for this page
        page_tables = extract_tables_from_page(pdf_path, page_num)
        table_pages[page_num] = page_tables

        for block in page_dict["blocks"]:
            if block.get("type") != 0:
                continue

            lines = block.get("lines", [])
            if not lines:
                continue

            # Collect all text and dominant font size in this block
            block_text_parts = []
            block_sizes = []
            for line in lines:
                line_text = ""
                for span in line.get("spans", []):
                    line_text += span.get("text", "")
                    block_sizes.append(span.get("size", avg_body_size))
                block_text_parts.append(line_text)

            block_text = " ".join(block_text_parts).strip()
            if not block_text or len(block_text) < 3:
                continue

            dominant_size = max(block_sizes) if block_sizes else avg_body_size

            # Detect heading
            heading_level = detect_heading_level(block_text, dominant_size, avg_body_size)
            if heading_level:
                flush_list()
                # Check if previous table block needs this as caption
                if blocks and blocks[-1]["type"] == "table" and not blocks[-1]["caption"]:
                    blocks[-1]["caption"] = block_text
                else:
                    blocks.append({
                        "type": "heading",
                        "level": heading_level,
                        "text": block_text,
                        "page": current_page,
                    })
                continue

            # Detect list item
            is_item, ordered = is_list_item(block_text)
            if is_item:
                if list_buffer and ordered != list_ordered:
                    flush_list()
                list_ordered = ordered
                list_buffer.append(re.sub(r'^[\d]+[\.\)]\s|^[a-z][\.\)]\s|^[•·▪▸\-\*]\s', '', block_text))
                continue

            # Regular paragraph
            flush_list()

            # Skip very short fragments (likely page numbers, headers/footers)
            if len(block_text.split()) < 4:
                continue

            blocks.append({
                "type": "paragraph",
                "text": block_text,
                "page": current_page,
            })

        # Flush any pending list at end of page
        flush_list()

        # Insert table blocks (after text blocks for this page, sorted by position)
        for table in page_tables:
            # Find insertion point — after last block from this page
            blocks.append(table)

    doc.close()
    return blocks

# ── CLI entry point ───────────────────────────────────────────────────────────

def main():
    check_dependencies()

    parser = argparse.ArgumentParser(description="Extract clinical PDF to typed JSONL")
    parser.add_argument("input", help="Input PDF file path")
    parser.add_argument("output", help="Output JSONL file path")
    parser.add_argument("--source-name", default="", help="Human-readable source name (e.g. 'WHO PCPNC 2023')")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: {input_path} not found", file=sys.stderr)
        sys.exit(1)

    print(f"Extracting: {input_path}", file=sys.stderr)
    blocks = extract_pdf(str(input_path), args.source_name)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as f:
        for block in blocks:
            f.write(json.dumps(block, ensure_ascii=False) + "\n")

    print(f"Written {len(blocks)} blocks to {output_path}", file=sys.stderr)

    # Summary
    counts = {}
    for b in blocks:
        counts[b["type"]] = counts.get(b["type"], 0) + 1
    print("Block types:", counts, file=sys.stderr)

if __name__ == "__main__":
    main()
