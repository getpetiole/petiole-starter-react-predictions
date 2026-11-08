# Changelog

## 0.1.0 (2026-11-08)

- First release: the leaf detector on a photo, dropped, chosen or taken
  with a phone's camera; the boxes drawn on it with their labels and
  confidence, a slider for the least confidence shown, counts, a table,
  and downloads as CSV, JSON and an annotated PNG.
- The site's Netlify Function forwards the four routes the app calls, with
  the visitor's key or the site's own `PETIOLE_API_KEY`.
- Tested with `@petiole/sdk` 0.1.1, against the Petiole API's spec of that
  release (API v1).
