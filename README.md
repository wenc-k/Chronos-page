# Chronos project page

Project page for **Chronos: Sequential Identity-Preserving Video Generation by Temporal Anchoring** (ACM MM 2026).

Static site, no build step: `index.html` + `assets/`. Served by GitHub Pages from the `main` branch root.

## Filling in the placeholders

| What | Where in `index.html` | How |
|---|---|---|
| arXiv link | the `<a class="btn" data-pending="Soon" href="">` button | put the URL in `href`; the "Soon" tag disappears automatically |
| Code link | the `<a class="btn" data-pending="Coming soon" href="">` button | put the repository URL in `href` |
| BibTeX | `<code id="bibtex"></code>` in the BibTeX section | paste the entry between the tags; a Copy button appears automatically |
| Ablation cases | `<div class="placeholder">` under `#ablation-cases` | replace with a figure or videos |
| Showcase videos | `.gallery` blocks under `#showcase` | add a `<figure class="vid" data-src="…mp4" data-poster="…webp">`; optional `<p class="vid-cap">prompt</p>` inside it |

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
