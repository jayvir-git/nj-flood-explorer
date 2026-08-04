# Raw material for the README

Facts and numbers used when writing the README (finished at `4e8f244`). Not prose
to reuse. Everything here was measured against the live services or decided in
DECISIONS.md. Numbers measured 2026-08-02.

## The three sources

| | FEMA NFHL | NJDEP Overburdened Communities | NJOGIS Municipalities |
|---|---|---|---|
| What | National Flood Hazard Layer, layer 28 "Flood Hazard Zones" | Block groups meeting the NJ EJ Law criteria | NJ municipal boundaries |
| Type | MapServer, server-rendered | MapServer feature layer | Hosted FeatureServer |
| Records | 36,839 SFHA polygons in a bounding box around NJ | 3,180 block groups | 564 municipalities |
| Record cap | 2,000 per query | 2,000 | 2,000 |
| Authority | federal system of record for regulatory flood zones | the state's own layer implementing N.J.S.A. 13:1D-157 et seq. | state GIS office |

URLs and field names live in `src/config/sources.ts`, verified by hand in a browser.

## Numbers worth citing

- FEMA layer 28 `minScale` is **1:36,111.909643**. Above that scale the service
  returns an empty image. Not a client setting; confirmed a `dynamicLayers`
  override does not lift it.
- Web Mercator zoom 14 works out to 1:36,112 — **0.6 scale units above the limit**,
  so it renders blank. Flood zones need zoom 15.
- Web Mercator inflates nominal scale by about **1.3x** at New Jersey's latitude,
  so zoom 15 spans only ~3 km of ground across a typical viewport.
- Consequence, and the honest headline limitation: **no New Jersey municipality
  fits on screen beside its own flood zones.**
- Server-side export of layer 28 returns in **200–450 ms** within its scale range.
- A bare count query against layer 28 over NJ took **14.6 s** — why the flood layer
  is server-rendered rather than a client-side FeatureLayer.

## The six EJ criteria and their block-group counts

| Criterion | Block groups |
|---|---|
| Minority | 1,678 |
| Low Income and Minority | 1,168 |
| Low Income | 198 |
| Low Income, Minority, and Limited English | 122 |
| Minority and Limited English | 12 |
| Low Income and Limited English | 2 |

Field is `OVERBURDENED_COMMUNITY_CRITERI`. Total 3,180.

## Definitions to quote, never paraphrase

- "Overburdened community" — quote the Legislature chapter text (D15) and link
  https://dep.nj.gov/ej/ for the layer. Definition is N.J.S.A. 13:1D-158; the act
  as a whole is 13:1D-157 et seq. Do not restate the thresholds in your own
  words; the percentages are legal definitions, not descriptions.
- "Special Flood Hazard Area" — the app filters on FEMA's own `SFHA_TF = 'T'`
  flag rather than a hand-listed set of zone codes, so the definition stays FEMA's.

## Limitations to be honest about

- **Scale.** Flood zones only from zoom 15 in (above).
- **Currency.** NFHL is the effective regulatory map, not a forecast, and not
  current risk. It is amended by LOMRs and revised county by county.
- **Resolution.** The EJ data is census block groups, not parcels or addresses.
  A block group can be partly flood-exposed; the app cannot say which houses are.
- **Boundaries.** Municipal boundaries are planimetric and extend over water —
  a point can be inside Atlantic City and be open ocean. This caused a real
  false-alarm bug report during S2.
- **Coverage gaps, and the headline caveat.** FEMA's layer 28 does not cover all
  of New Jersey. Atlantic City returns no flood zone polygon at all — not Zone X,
  nothing — at every one of 25 points tested inside the municipal boundary, while
  Margate City next door returns Zone VE from panel 34001C on the identical query.
  A 2 km view over Morristown comes back empty the same way. Eleven other towns
  sampled are covered. So a blank map means one of two opposite things, and the
  app now says which: FEMA mapped this ground and put it outside the hazard area,
  or FEMA has not mapped it. Worth stating plainly in the README, because
  Atlantic City is among the most flood-exposed cities in the state and a naive
  reading of this data would report it as 0% exposed. (D9)
- **Not a flood determination.** Nothing here substitutes for a FEMA flood map
  determination or an elevation certificate.

## Why the stack (compress from DECISIONS.md, don't duplicate it)

- ArcGIS Maps SDK over Leaflet/MapLibre: all three sources are Esri REST services;
  native FeatureLayer, server-side queries, legends. Cost is bundle size, accepted
  and deferred to the performance pass. (D1)
- No backend: every query runs client-side against public services. A proxy would
  add an operations burden and a failure mode without adding a capability. (D3)
- Municipality as the unit of answer: people identify with their town and NJ
  hazard planning is municipal, even though block groups are the data's unit. (D4)
- Cyan is reserved for flood zones so the EJ fill underneath never competes. (D8)
- EJ palette is ordered by how many statutory criteria a block group meets (1→2→3),
  not an arbitrary qualitative shuffle. (D16 / P1)

## AI-tooling disclosure — raw material, your voice

Write this yourself; below is only what actually happened, to save you
reconstructing it.

- You wrote the scope discipline, the data rules, and the slice plan up front
  (`.cursor/rules/project.mdc`, `docs/PLAN.md`) and held the agent to them.
- Source URLs, layer IDs, and field names were verified by hand in a browser
  before any code used them, and the rules forbid the agent inventing or
  substituting them.
- Every non-obvious choice was recorded in `DECISIONS.md` as it was made,
  including what was rejected and why.
- Where the plan collided with reality, the agent stopped and asked rather than
  improvising: the FEMA scale limit forced S2's acceptance criterion to be
  rewritten, and you chose the approach.
- One reported bug in S2 turned out to be the service's scale gate plus a view
  centred on open water. It was diagnosed with network evidence — a temporary
  logging proxy, replayed requests, feature counts for all 34 views — and the
  finding was that no code change was warranted.

Sections still to fill in from sessions not covered here: the initial scaffold,
and everything from S3 onward.

## Mechanics

- Live: https://nj-flood-explorer.vercel.app — Vercel, redeploys on push to main.
- Run locally: `npm install && npm run dev`
- What's next: point at `FUTURE.md`, don't restate it.
