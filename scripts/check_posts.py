#!/usr/bin/env python3
"""Pre-commit checks for published posts.

Every post that ships without `draft: true` needs the things that are invisible
locally and only wrong in public: an OpenGraph card, an excerpt for the post
list and RSS, and no em dashes. Each of those has already been missed once.

Run manually with `python3 scripts/check_posts.py`, or let the pre-commit hook
run it over the posts you are about to commit (`scripts/install-hooks.sh`).

Exit 0 clean, 1 with a list of problems.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
POSTS = ROOT / "src" / "data" / "post"
IMAGES = ROOT / "src" / "assets" / "images"

# Reference paths look like '~/assets/images/og-slug.png'
IMAGE_PREFIX = "~/assets/images/"


def split_frontmatter(text: str):
    if not text.startswith("---"):
        return None, text
    end = text.find("\n---", 3)
    if end == -1:
        return None, text
    return text[3:end], text[end + 4 :]


def field(fm: str, name: str):
    m = re.search(rf"^{name}:\s*(.+?)\s*$", fm, re.M)
    return m.group(1).strip() if m else None


def unquote(v: str) -> str:
    if len(v) >= 2 and v[0] == v[-1] and v[0] in "\"'":
        return v[1:-1]
    return v


def check(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    fm, body = split_frontmatter(text)
    if fm is None:
        return [f"{path.name}: no YAML frontmatter"]

    draft = (field(fm, "draft") or "false").lower()
    problems: list[str] = []

    # An em dash anywhere in a post is a standing no, draft or not.
    for n, line in enumerate(text.splitlines(), 1):
        if "—" in line:
            problems.append(f"{path.name}:{n}: em dash")

    if draft == "true":
        return problems  # the rest only matters once it ships

    if not field(fm, "title"):
        problems.append(f"{path.name}: published with no title")

    excerpt = field(fm, "excerpt")
    if not excerpt:
        problems.append(f"{path.name}: published with no excerpt (shows on /posts and RSS)")

    image = field(fm, "image")
    if not image:
        problems.append(
            f"{path.name}: published with no `image:`, so link previews fall back to the "
            f"site default card. Expected image: '{IMAGE_PREFIX}og-{path.stem}.png'"
        )
    else:
        raw = unquote(image)
        if raw.startswith("~"):
            # A bare leading ~ is YAML null, so the value must have been quoted.
            if image[0] not in "\"'":
                problems.append(f"{path.name}: `image:` starting with ~ must be quoted")
            rel = raw[len(IMAGE_PREFIX):] if raw.startswith(IMAGE_PREFIX) else None
            if rel is None:
                problems.append(f"{path.name}: `image:` should live under {IMAGE_PREFIX}")
            elif not (IMAGES / rel).is_file():
                problems.append(f"{path.name}: `image:` points at a missing file: {raw}")
        else:
            problems.append(
                f"{path.name}: `image:` should be a {IMAGE_PREFIX} path so Sharp optimises it; "
                f"a /public path is served unoptimised"
            )

    # Local figures referenced from the body must exist too.
    for m in re.finditer(r"!\[[^\]]*\]\((/posts/[^)\s]+)\)", body):
        target = ROOT / "public" / m.group(1).lstrip("/")
        if not target.is_file():
            problems.append(f"{path.name}: figure not found: {m.group(1)}")

    # An image with no alt text is invisible to anyone not looking at it.
    for m in re.finditer(r"!\[\s*\]\(([^)\s]+)\)", body):
        problems.append(f"{path.name}: image has empty alt text: {m.group(1)}")

    return problems


def main(argv: list[str]) -> int:
    if len(argv) > 1:
        targets = [Path(a) for a in argv[1:] if a.endswith(".md")]
    else:
        targets = sorted(POSTS.glob("*.md"))

    problems: list[str] = []
    for p in targets:
        if not p.is_absolute():
            p = ROOT / p
        if p.is_file() and p.parent == POSTS:
            problems.extend(check(p))

    if problems:
        print("post checks failed:\n", file=sys.stderr)
        for p in problems:
            print(f"  {p}", file=sys.stderr)
        print("\nfix these, or commit with --no-verify to skip.", file=sys.stderr)
        return 1

    print(f"post checks passed ({len(targets)} file(s))")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
