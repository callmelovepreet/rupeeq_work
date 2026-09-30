# rupeeq_work

RupeeQ web work: landing pages, and the design files and requests behind them.

| Folder             | What's in it                                                                      |
| ------------------ | --------------------------------------------------------------------------------- |
| `site/`            | The built pages. Start with `site/index.html` (personal loan landing page).       |
| `incoming/`        | Drop new designs, screenshots, copy and requests here. See `incoming/README.md`.   |
| `design-handoffs/` | Original Claude Design exports, one dated folder each, kept for reference.         |

## Run the site locally

```
python3 -m http.server -d site 8080
```

Then open http://localhost:8080. The form runs in demo mode until `apiBase` is set in `site/index.html` (see `site/README.md`).
