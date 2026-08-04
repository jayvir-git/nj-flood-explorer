# NJ Flood Exposure Explorer

**Live:** https://nj-flood-explorer.vercel.app

One question: how flood-exposed is my New Jersey town, and who bears it?

An interactive map of FEMA flood hazard zones over NJDEP overburdened communities
(under the New Jersey Environmental Justice Law). Click a municipality for a
plain-language summary, one chart, and one table. The app counts only overburdened
community block groups intersecting that town — a deliberate lens, not a full
census of every block group.

## The data

Three public services. URLs and field names are pinned in
[`src/config/sources.ts`](src/config/sources.ts) after hand verification in a
browser.

| Source | What it is | Links |
|---|---|---|
| **FEMA National Flood Hazard Layer** (layer 28) | Federal system of record for regulatory flood zones. The app filters on FEMA's own Special Flood Hazard Area flag (`SFHA_TF = 'T'`). | [About](https://www.fema.gov/flood-maps/national-flood-hazard-layer) · [Service](https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer) |
| **NJDEP Overburdened Communities** | The state's published layer of census block groups that meet the EJ Law criteria. 3,180 records / 3,168 distinct block groups. | [About](https://dep.nj.gov/ej/) · [Service](https://mapsdep.nj.gov/arcgis/rest/services/Features/Government/MapServer/42) |
| **NJOGIS municipal boundaries** | Official municipal outlines used to select a town. | [About](https://njogis-newjersey.opendata.arcgis.com/datasets/municipal-boundaries-of-nj-hosted-3424) · [Service](https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/NJ_Municipalities_3857/FeatureServer/0) |

**“Overburdened community”** is a legal term. The app quotes the statute
(N.J.S.A. 13:1D-158) rather than paraphrasing thresholds — see
[P.L. 2020, c. 92](https://www.njleg.state.nj.us/2020/Bills/PL20/92_.HTM) and the
in-app *About the data* section.

**“Flood-exposed”** here means a block group touches at least one Special Flood
Hazard Area polygon — a yes/no intersects test, not a share of area.

## Limitations (read these)

- **Coverage gaps are not safety.** FEMA's digital layer does not cover every
  place in New Jersey. Atlantic City is the clearest case: most overburdened
  block groups intersecting the city have *no* flood polygon at all, while
  Margate City next door is mapped. The app reports missing data as missing —
  never as “unexposed.”
- **Flood zones on the map only at neighborhood zoom.** FEMA's service will not
  draw layer 28 above about 1:36,000. No whole municipality fits on screen next
  to its flood zones. Panel numbers come from direct queries and are not limited
  by that zoom rule.
- **Block groups, not parcels.** A block group can be only partly in the hazard
  area; the app cannot say which houses are.
- **Boundaries are messy.** Municipal outlines are planimetric and can run into
  water. Block groups do not nest inside towns, so counts say “intersecting”
  a municipality.
- **Not a flood determination.** This does not replace a FEMA map determination
  or an elevation certificate. NFHL is the effective regulatory map, not a
  forecast of future risk.

## Why these choices

Recorded as they were made in [`DECISIONS.md`](DECISIONS.md). Short version:

- ArcGIS Maps SDK, because all three sources are Esri REST services.
- No backend — queries run in the browser against the public services.
- Municipality as the unit of answer; block groups are the unit of the EJ data.
- Coverage and exposure judged per block group so a town with partial FEMA
  coverage cannot be summarized as mostly safe.

## How it was built

Vite + React + TypeScript, ArcGIS Maps SDK for the map, Recharts for the chart.
Deployed on Vercel.

Most of the code was written by AI coding agents; the process around them is the
human part, and it is the part this repo is careful about. The scope rules and
the slice plan ([`docs/PLAN.md`](docs/PLAN.md)) were fixed before the first line
of code: agents build one slice at a time, may not add or invent data sources
(the three services are pinned in [`src/config/sources.ts`](src/config/sources.ts),
and every URL, layer id, and field name was checked against the live service
before use), and must record each non-obvious choice in
[`DECISIONS.md`](DECISIONS.md) with what was rejected and why. Every slice ended
with an acceptance check in the running app, and the exposure numbers were
accepted only after they matched hand-run queries against the same public
services — a discipline that caught three real data traps (FEMA's scale gate,
Atlantic City's coverage hole, and NJDEP storing block-group parts rather than
block groups) that a quicker build would have shipped as silent errors. When the
data contradicted the plan, the plan was amended in the open, not papered over.
The decision log is the receipt.

## Run locally

```bash
npm install
npm run dev
```

## Repo guide

- [`docs/PLAN.md`](docs/PLAN.md) — build plan (slices S1–S7, then improvement passes)
- [`DECISIONS.md`](DECISIONS.md) — why each non-obvious choice was made
- [`FUTURE.md`](FUTURE.md) — ideas deliberately out of scope
- [`src/config/sources.ts`](src/config/sources.ts) — the three data sources
- [`docs/README-notes.md`](docs/README-notes.md) — measured facts used to write this file
