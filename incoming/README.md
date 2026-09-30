# Incoming

Drop zone for everything you want built or changed next: designs, screenshots, copy, assets, feedback.

## How to add something

1. Copy `_template/` to a new folder named `YYYY-MM-DD-short-name`, for example `2026-10-02-offers-page`.
2. Put your files in it: Claude Design exports, screenshots, logos, copy docs, anything.
3. Fill in `request.md`: what you want and which files matter.
4. Push it to the repo, then tell Claude: "pick up `incoming/2026-10-02-offers-page`".

```
incoming/
  README.md
  _template/request.md
  2026-10-02-offers-page/
    request.md
    offers-design.dc.html
    screenshot-mobile.png
  2026-10-05-landing-copy-fixes/
    request.md
```

## Status

When a request is finished, Claude sets its `Status:` line in `request.md` to `done` and links the commit. Nothing gets deleted, so the folder doubles as a history of what was asked for.
