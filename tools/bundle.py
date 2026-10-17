#!/usr/bin/env python3
"""Inline every local <script src> into one HTML file you can AirDrop, email, or open anywhere.

Usage:  python3 tools/bundle.py      ->  dist/metro-surfer.html
"""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")


def inline(match):
    js = (root / match.group(1)).read_text(encoding="utf-8")
    return "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>"


out = re.sub(r'<script src="([^"]+)"></script>', inline, html)
assert "<script src=" not in out, "a script tag was not inlined"
dist = root / "dist"
dist.mkdir(exist_ok=True)
target = dist / "metro-surfer.html"
target.write_text(out, encoding="utf-8")
print(f"wrote {target.relative_to(root)} ({target.stat().st_size / 1024:.0f} KB)")
