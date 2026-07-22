# Charity Recon Tools

## Canonical app

| File | Role |
|------|------|
| [`index.html`](./index.html) | UI shell (markup + styles only) |
| [`js/app.js`](./js/app.js) | Boot, routing (`#osint` / `#checklist`) |
| [`js/osint-links.js`](./js/osint-links.js) | **Pure** OSINT link builder (no DOM) |
| [`js/osint.js`](./js/osint.js) | OSINT tab UI |
| [`js/checklist.js`](./js/checklist.js) | Checklists (localStorage) |
| [`js/util.js`](./js/util.js) | Theme, toast, escapeHtml, modals |
| [`state_data.json`](./state_data.json) | 50 states + DC + Puerto Rico link data |
| [`manifest.json`](./manifest.json) | PWA manifest |

| Tab | Hash |
|-----|------|
| OSINT Tool | `#osint` |
| Compliance Checklists | `#checklist` |

Checklists use browser **local storage** only (key `charity_recon_checklists`). No account.

## Legacy redirects

| Path | Redirects to |
|------|----------------|
| [`osint_app/`](./osint_app/) | `index.html#osint` |
| [`animal_checklist_app/`](./animal_checklist_app/) | `index.html#checklist` |

Unused Firebase / PWA leftovers: [`_legacy/`](./_legacy/).

## Local development

```bash
# from repo root (ES modules require HTTP)
python3 -m http.server 8080
# open http://localhost:8080/tools/index.html
```

## Tests

```bash
node tools/js/osint-links.test.mjs
```
