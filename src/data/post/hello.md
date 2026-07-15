---
title: hello (authoring template)
publishDate: 2026-07-15
excerpt: A one-or-two sentence summary. Shows on /posts and in RSS readers.
draft: true
---

This file never publishes (`draft: true`). Copy it to start a new post:

1. `cp src/data/post/hello.md src/data/post/<slug>.md` — the filename IS the slug (`hr.md` → `/posts/hr`).
2. Set `title`, `publishDate`, `excerpt`; delete `draft: true` when ready.
3. Commit and push; the deploy publishes it, adds it to /posts, the homepage, RSS, and the sitemap.

Every post is also served as raw markdown at `/posts/<slug>.md` for agents and curl.

## What just works

Plain paragraphs are serif. Headings are mono. `inline code` gets a chip. Links, **bold**,
*italics*, lists, and blockquotes all match the site's paper/ink look.

> Blockquotes look like this.

Code blocks are highlighted (light and dark theme both):

```python
def hello(name: str) -> str:
    return f"hello, {name}"
```

Images drop in with a plain markdown tag and get the site's border treatment:

![alt text describing the image](/og.png)

Put post images in `public/posts/<slug>/` and reference them as `/posts/<slug>/photo.jpg`.

## Interactive charts

For an interactive chart, rename the file to `.mdx` and either import an Astro component or
inline a `<script>` + SVG/canvas right in the post. The heart-rate widget pattern (fetch JSON,
draw, tick) works verbatim inside a post.
