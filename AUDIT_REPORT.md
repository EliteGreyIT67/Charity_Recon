# State Resource Link Audit Report

**Date:** 2026-09-04 (America/New_York)  
**Repo:** EliteGreyIT67/Charity_Recon  
**Scope:** `STATE_RESOURCES.md` and `tools/osint_app/state_data.json` on `main`  
**Method:** `gh api` file download; URL extract + dedupe; parallel `curl -L` HTTP checks (HEAD then GET / browser UA / HTTP/1.1 fallbacks); replacement research via official .gov pages and verified HTTP 200s only.

## Counts

| Metric | Value |
|--------|------:|
| Unique URLs checked | 500 |
| OK (2xx, no redirect) | 338 |
| Redirect-OK (ended 2xx) | 65 |
| Soft-fail (403 / likely bot-block) | 44 |
| Broken (4xx/5xx/timeout/DNS/TLS) initial | 53 |
| High-confidence URL updates applied (rules) | 39 |
| Occurrences updated in Markdown | 26 |
| Occurrences updated in JSON | 15 |
| Broken left after fix (true unresolved / soft TLS) | ~12 (mostly TLS/soft; see needs-verify) |
| Needs-verify items | See list below |

## Files updated

- `STATE_RESOURCES.md` (root) — structure preserved; last-updated set to September 4, 2026; HTML `<!-- needs verify: ... -->` comments added near a few items
- `tools/osint_app/state_data.json` — schema unchanged (`states`, `stateResources`, `stateAnimalWelfareResources`); only `u` (and a few `n` labels where agency path renamed)

**Both main JSON and markdown were updated** and logical resources were synced where both referenced the same resource (CA registry, KY AG/SOS, NM DOJ/SOS, UT commerce, VA DACS, AZ ACC, WI DFI, TX SOS, etc.).

## Sample of high-confidence updates

| Old | New | Note |
|-----|-----|------|
| `https://rct.doj.ca.gov/Verification/Web/Search.aspx?facility=Y` | `https://ca-rcf.evokeplatform.com/app/publicPortal/verification` | CA Registry Search Tool moved to evokeplatform public portal |
| `https://secure.nmag.gov/CharitySearch/` | `https://secure.nmdoj.gov/CharitySearch/` | NM charity search host now secure.nmdoj.gov |
| `https://ag.ky.gov/Pages/default.aspx` | `https://www.ag.ky.gov/Pages/default.aspx` | KY AG prefer www. |
| `https://ag.ky.gov/about/Office-Divisions/OCP/Pages/default.aspx` | `https://www.ag.ky.gov/about/Office-Divisions/OCP/Pages/default.aspx` | KY AG prefer www. |
| `https://ag.ky.gov/Resources/Consumer-Resources/charity/Pages/regs.aspx` | `https://www.ag.ky.gov/Resources/Consumer-Resources/charity/Pages/regs.aspx` | KY AG prefer www. |
| `https://ag.ky.gov/Resources/Consumer-Resources/Consumers/Pages/Consumer-Complaints.aspx` | `https://www.ag.ky.gov/Resources/Consumer-Resources/Consumers/Pages/Consumer-Complaints.aspx` | KY AG prefer www. |
| `https://sos.ky.gov/Pages/default.aspx` | `https://www.sos.ky.gov/Pages/default.aspx` | KY SOS prefer www. |
| `https://sos.ky.gov/bus/business-filings/OnlineServices/Pages/default.aspx` | `https://www.sos.ky.gov/bus/business-filings/OnlineServices/Pages/default.aspx` | KY SOS prefer www. |
| `https://db.dcp.utah.gov/registered.html` | `https://commerce.utah.gov/dcp/for-businesses/charities/` | UT DCP db.dcp host DNS-dead; charities info on commerce.utah.gov |
| `https://db.dcp.utah.gov/complaints.html` | `https://commerce.utah.gov/dcp/for-consumers/file-a-complaint/` | UT DCP complaints moved under commerce.utah.gov |
| `https://dcp.utah.gov/` | `https://commerce.utah.gov/dcp/` | UT DCP canonical is commerce.utah.gov/dcp/ |
| `https://businessregistration.utah.gov/EntitySearch/OnlineEntitySearch` | `https://businessregistration.utah.gov/` | UT entity search path causes redirect loop; use portal root |

Full applied list is in local `applied_updates.json`.

## Needs verify (not schema-breaking; listed here + MD HTML comments)

### TLS/SSL from audit client
- https://apps.dos.ny.gov/publicInquiry/
- https://apps.ilsos.gov/corporatellc/
- https://cis.scc.virginia.gov/EntitySearch/Index
- https://cofs.lara.state.mi.us/SearchApi/Search/Search
- https://mblsportal.sos.state.mn.us/Business/Search
- https://www.alabama.gov/
- https://www.corporations.pa.gov/search/bussearch
- https://www.legislature.mi.gov/... (session URL; cleaned to non-session form)

### 403 bot-block soft-fail (likely OK in browsers)
- http://search.sunbiz.org/Inquiry/CorporationSearch/ByName
- https://businesssearch.ohiosos.gov/
- https://charities.sos.ms.gov/forms/Charities/Charities/ComplaintForm
- https://charities.sos.ms.gov/online/portal/ch/page/charities-search/Portal.aspx
- https://charities.sos.ms.gov/online/portal/ch/page/charities-search/portal.aspx
- https://corp.sos.ms.gov/corp/portal/c/page/corpBusinessIdSearch/portal.aspx?#clear=1
- https://corp.sos.ms.gov/corp/portal/c/page/corpbusinessidsearch/portal.aspx
- https://dec.alaska.gov/eh/vet/
- https://file.dos.pa.gov/
- https://file.dos.pa.gov/search/business
- https://hbe.ehawaii.gov/documents/search.html
- https://mibusinessregistry.lara.state.mi.us/search/business
- https://quickstart.sos.nh.gov/online/BusinessInquire
- https://www.ag.ks.gov/
- https://www.ag.ks.gov/divisions/public-protection/resources/charitable-organization-registration-directory
- ... +29 more

### VA COS dedicated search UI
- https://cos.vdacs.virginia.gov/ (cgi path 404; root updated, search UI unconfirmed)

### Intermittent / cookie issues
- https://sos.nh.gov/corporation-ucc-securities/corporation/ (503)
- https://www.pfr.maine.gov/ALMSOnline/* (cookie redirect loops without cookies)

## False positives on initial HEAD pass

Several links returned 404/errors on bare HEAD but **200 with browser UA + GET** (kept as-is): Oregon DOJ Charities, Illinois Dept. of Agriculture hubs, Georgia ecorp BusinessSearch, Maine AccessGov complaint form, Alaska charity public query.

## PR #2 / fork note

Open PR #2 (`FineComputer14451:main` → `EliteGreyIT67:main`) includes `tools/state_data.json` (different path than main’s `tools/osint_app/state_data.json`). **This audit PR targets main-branch paths only** and does not merge or rewrite PR #2 modular tool work. After PR #2 lands, consider syncing charity/business URLs from `tools/osint_app/state_data.json` into any modular `tools/state_data.json` copy.

## Constraints honored

- No fabricated phone/email/address data
- Prefer fewer high-confidence URL fixes over speculative rewrites
- JSON schema identical for OSINT app consumers
- Soft 403s marked soft-fail / needs-verify rather than mass-rewritten
