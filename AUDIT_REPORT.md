# State Resource Link Audit Report

**Date:** 2026-09-04 (America/New_York)  
**Repo:** EliteGreyIT67/Charity_Recon  
**Scope:** `STATE_RESOURCES.md` and `tools/osint_app/state_data.json` on `main`  
**Method:** `gh api` file download; URL extract + dedupe; parallel `curl -L` HTTP checks (HEAD then GET / browser UA / HTTP/1.1 fallbacks); replacement research via official .gov pages and verified HTTP 200s / documented portal migrations only.

## Counts

| Metric | Value |
|--------|------:|
| Unique URLs checked | 500 |
| OK (2xx, no redirect) | 338 |
| Redirect-OK (ended 2xx) | 65 |
| Soft-fail (403 / likely bot-block) | 44 |
| Broken (4xx/5xx/timeout/DNS/TLS) initial | 53 |
| High-confidence URL updates applied (rules) | 45 |
| Occurrences updated in Markdown (cumulative) | 29 |
| Occurrences updated in JSON (cumulative) | 19 |
| Needs-verify leftovers resolved this pass | 6 logical URL fixes (+ several false-positives confirmed OK with browser UA) |
| Needs-verify still open | 7 (soft TLS / cookie / portal timeout — left alone) |
| Soft-fail 403s left alone | 44 |

## Files updated

- `STATE_RESOURCES.md` (root) — structure preserved; last-updated set to September 4, 2026; HTML `<!-- needs verify: ... -->` comments retained only where still open
- `tools/osint_app/state_data.json` — schema unchanged (`states`, `stateResources`, `stateAnimalWelfareResources`); only `u` (and a few `n` labels where agency path renamed)

**Both main JSON and markdown were updated** and logical resources were synced where both referenced the same resource (CA registry, KY AG/SOS, NM DOJ/SOS, UT commerce, VA DACS, AZ ACC, WI DFI, TX SOS, IL SOS search, MI LARA, PA DOS search, etc.).

## Sample of high-confidence updates

| Old | New | Note |
|-----|-----|------|
| `https://rct.doj.ca.gov/Verification/Web/Search.aspx?facility=Y` | `https://ca-rcf.evokeplatform.com/app/publicPortal/verification` | CA Registry Search Tool moved to evokeplatform public portal |
| `https://secure.nmag.gov/CharitySearch/` | `https://secure.nmdoj.gov/CharitySearch/` | NM charity search host now secure.nmdoj.gov |
| `https://apps.ilsos.gov/corporatellc/` | `https://apps.ilsos.gov/businessentitysearch/` | IL SOS corporatellc path retired; Business Entity Search is businessentitysearch |
| `https://cofs.lara.state.mi.us/SearchApi/Search/Search` | `https://mibusinessregistry.lara.state.mi.us/search/business` | MI COFS retired Jun 2025; MiBusiness Registry is official |
| `https://www.corporations.pa.gov/search/bussearch` | `https://file.dos.pa.gov/search/business` | PA corporations.pa.gov SSL/404; DOS Business Filing Services search |
| `https://www.legislature.mi.gov/mileg.aspx?page=getobject&objectname=mcl-act-169-of-1975` | `https://www.legislature.mi.gov/Laws/MCL?objectName=MCL-ACT-169-OF-1975` | MI legislature canonical Laws/MCL URL |
| `https://sos.nh.gov/corporation-ucc-securities/corporation/` | `https://www.sos.nh.gov/corporations-0` | NH SOS corporation path intermittent 503; corporations-0 hub |
| `https://db.dcp.utah.gov/registered.html` | `https://commerce.utah.gov/dcp/for-businesses/charities/` | UT DCP db.dcp host DNS-dead; charities info on commerce.utah.gov |

Full applied list is in local `applied_updates.json` (+ `task_a_updates.json` for this chase pass).

## Needs-verify chase (this pass)

### Resolved / false-positive (no longer open)
- IL Dept. of Agriculture hubs — **200 with browser UA** (prior HEAD false positive)
- GA ecorp BusinessSearch — **200 with browser UA**
- Oregon DOJ Charities (+ complaint) — **200 with browser UA**
- Maine AccessGov charitable complaint — **200 with browser UA**
- Alaska charity public query (TLP PubQry) — **200 with browser UA**
- VA COS root `https://cos.vdacs.virginia.gov/` — **200** (cgi search already replaced earlier)
- IL/MI/PA/NH path migrations listed above applied

### Still open (soft TLS / cookie / portal timeout — left alone)
- https://apps.dos.ny.gov/publicInquiry/ — TLS EOF from audit client; still the official NY DOS Public Inquiry URL (landing at dos.ny.gov also soft-403)
- https://apps.ilsos.gov/businessentitysearch/ — timeout from audit client on apps.ilsos.gov (path corrected; leave soft)
- https://cis.scc.virginia.gov/EntitySearch/Index — TLS handshake fail from audit client; still official SCC CIS
- https://mblsportal.sos.state.mn.us/Business/Search — TLS handshake fail; still official MN MBLS (sos.mn.gov variant also TLS-fail from client)
- https://www.alabama.gov/ — local issuer cert from audit client; **-k → 200**
- https://www.pfr.maine.gov/ALMSOnline/Welcome.aspx — cookie/AspxAutoDetect redirect loop without cookies
- https://www.pfr.maine.gov/ALMSOnline/ALMSQuery/Welcome.aspx — same cookie loop; still the official OPOR verification DB

### Soft-fail 403 bot-block (left alone; likely OK in browsers)
- Unchanged set of ~44 official-domain 403s (MS SOS charities, KS AG, OH SOS, PA file.dos.pa.gov, NH QuickStart, MI MiBusiness Registry, etc.)

## False positives on initial HEAD pass

Several links returned 404/errors on bare HEAD but **200 with browser UA + GET** (kept as-is): Oregon DOJ Charities, Illinois Dept. of Agriculture hubs, Georgia ecorp BusinessSearch, Maine AccessGov complaint form, Alaska charity public query.

## PR #2 / fork note

Open PR #2 (`FineComputer14451:main` → `EliteGreyIT67:main`) includes `tools/state_data.json` (different path than main’s `tools/osint_app/state_data.json`). Audit PR #3 targets main-branch paths; a separate sync applies the same logical URL replacements into PR #2’s `tools/state_data.json` without touching modular tool JS.

## Constraints honored

- No fabricated phone/email/address data
- Prefer fewer high-confidence URL fixes over speculative rewrites
- JSON schema identical for OSINT app consumers
- Soft 403s marked soft-fail / needs-verify rather than mass-rewritten
