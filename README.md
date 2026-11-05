# Chronos project page

Project page for **Chronos: Sequential Identity-Preserving Video Generation by Temporal Anchoring** (ACM MM 2026).

Static site, no build step: `index.html` + `assets/`. Served by GitHub Pages from the `main` branch root.

## Filling in the placeholders

| What | Where in `index.html` | How |
|---|---|---|
| arXiv link | the `<a class="btn" data-pending="Soon" href="">` button | put the URL in `href`; the "Soon" tag disappears automatically |
| Code link | the Code button (currently `href="./"` with a "Coming soon" tag) | put the repository URL in `href`, add `target="_blank" rel="noopener"`, and delete the `<span class="soon">` |
| BibTeX | `<code id="bibtex"></code>` in the BibTeX section | paste the entry between the tags; a Copy button appears automatically |
| Ablation cases | `<div class="placeholder">` under `#ablation-cases` | replace with a figure or videos |
| Hero videos | `EXAMPLES` in `assets/main.js` | each example's `video` names `assets/videos/<name>.mp4` (with a `<name>.webp` first frame as the poster); `segs` sets the timeline segments in seconds on a 5 s axis |

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
