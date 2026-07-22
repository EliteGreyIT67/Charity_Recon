# Legacy (unused) Charity Recon assets

These files are **not used** by the current integrated app (`tools/index.html` + `tools/js/`).

They are retained only as historical reference from an earlier Firebase-backed checklist design and old standalone PWA shells.

| Path | Former role |
|------|-------------|
| `functions/` | Cloud Functions to sync `memberIds` on checklist docs |
| `firestore.rules` | Artifact-path Firestore rules |
| `animal_checklist_app/` | Standalone checklist PWA rules, styles, service worker |
| `osint_app/` | Old OSINT PWA service worker + manifest |

Do **not** re-enable without an intentional product decision to restore cloud accounts.

Active app layout:

```
tools/index.html
tools/js/{app,util,osint,osint-links,checklist}.js
tools/state_data.json
tools/manifest.json
tools/osint_app/index.html          → redirect #osint
tools/animal_checklist_app/index.html → redirect #checklist
```
