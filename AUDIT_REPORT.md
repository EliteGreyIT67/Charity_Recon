# State Resource Link Audit Report

**Date:** 2026-09-04 (America/New_York)  
**Repo:** EliteGreyIT67/Charity_Recon  
**Scope (current):** `STATE_RESOURCES.md` and `tools/state_data.json` on `main` (canonical after PR #2 modular merge; prior audit notes that mentioned `tools/osint_app/state_data.json` are historical)  
**Method:** Shallow clone of upstream `main`; leftover soft-TLS/portal re-probe with browser UA + HTTP/1.1 + cookie jar / `-k` / openssl notes; official .gov replacement research for dead portals only.

## Counts (leftover chase after PR #3)

| Metric | Value |
|--------|------:|
| Needs-verify markers at start of leftover chase | 8 |
| High-confidence URL updates this chase | 2 |
| Soft/portal leftovers still open (client-only) | 5 |
| Soft 403 bot-blocks | unchanged (~44) |

## Files updated (this chase)

- `STATE_RESOURCES.md` — MN MBLS host + VA DACS charity DB URL; Maine/Alabama comment refinements; remaining soft markers retained
- `tools/state_data.json` — same MN + VA logical URL updates; schema unchanged (`states`, `stateResources`, `stateAnimalWelfareResources`)
- `AUDIT_REPORT.md` — leftover section refreshed

## High-confidence updates (this chase)

| Old | New | Note |
|-----|-----|------|
| `https://mblsportal.sos.state.mn.us/Business/Search` | `https://mblsportal.sos.mn.gov/Business/Search` | Canonical MN MBLS host is `mblsportal.sos.mn.gov` (official SOS Business Filings Online); soft TLS from audit client remains |
| `https://cos.vdacs.virginia.gov/` | `https://vdacs.evokeplatform.com/app/publicPortal` | Legacy COS root shows Tyler “temporarily unavailable”; official VDACS Charitable Solicitation page links “Search VDACS Evoke Database” to Evoke `publicPortal` |

## Leftover outcomes (this chase)

| URL | Outcome |
|-----|---------|
| `https://apps.dos.ny.gov/publicInquiry/` | **Left alone** — TLS EOF from audit client; still official NY DOS Public Inquiry / Corporation & Business Entity Database; dos.ny.gov soft-403 |
| `https://apps.ilsos.gov/businessentitysearch/` | **Left alone** — path already corrected in prior audit; apps.ilsos.gov / www.ilsos.gov time out from audit client |
| `https://cis.scc.virginia.gov/EntitySearch/Index` | **Left alone** — TLS handshake fail from audit client; still official SCC CIS Entity Search (linked from scc.virginia.gov/businesses) |
| `https://mblsportal.sos.state.mn.us/Business/Search` | **Fixed** → `https://mblsportal.sos.mn.gov/Business/Search` (soft TLS note retained) |
| `https://www.alabama.gov/` | **Left alone** — incomplete intermediate chain from audit client; `-k` → 200 official Alabama.gov |
| `https://www.pfr.maine.gov/ALMSOnline/Welcome.aspx` | **Left alone (URL)** — verified **200 with cookie jar**; cookieless clients hit AspxAutoDetect loop; still official ALMS Online |
| `https://www.pfr.maine.gov/ALMSOnline/ALMSQuery/Welcome.aspx` | **Left alone (URL)** — verified **200 with cookie jar**; still official ALMS Query / license search |
| `https://cos.vdacs.virginia.gov/` | **Fixed** → Evoke public portal (see table above) |

### Soft-fail 403 bot-block (left alone; likely OK in browsers)
- Unchanged set of ~44 official-domain 403s from prior audit

## Prior audit history (PR #3)

Earlier pass applied ~45 high-confidence migrations (CA Evoke, NM DOJ host, IL path, MI MiBusiness Registry, PA DOS search, etc.) and resolved several false-positive HEAD failures with browser UA. See merged PR #3 for that changelog.

## Constraints honored

- No fabricated phone/email/address data
- Prefer fewer high-confidence URL fixes over speculative rewrites
- JSON schema identical for OSINT app consumers
- Soft 403s / soft TLS on clearly official portals left alone rather than mass-rewritten
