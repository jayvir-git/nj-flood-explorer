# Build plan: vertical slices

Each slice has one acceptance criterion. A slice is done when the criterion passes
in the running app and the change is committed. Ideas beyond the current slice go
to FUTURE.md.

**Status: S1–S7 and P1–P4 are complete.** Remaining ideas live only in FUTURE.md.

## Phase 1: walking skeleton

**S1. Map on screen.** Done.
Vite + React + TS app renders an ArcGIS MapView, basemap `gray-vector`, centered on
New Jersey (approx. -74.55, 40.07, zoom 8).
Accept: `npm run dev` shows the map, no console errors.
Evidence: MapView on NJ; StrictMode AbortError fixed via deferred destroy (D5).

**S2. Three layers.** Done.
Municipal boundaries (outline only), NJDEP overburdened communities (categorical
fill by OVERBURDENED_COMMUNITY_CRITERI, semi-transparent), FEMA flood hazard zones
(layer 28, filtered to Special Flood Hazard Area zones, semi-transparent).
FEMA publishes layer 28 with a 1:36,112 scale limit, so flood zones cannot be drawn
at state zoom, nor at the zoom where a whole municipality fits (DECISIONS.md D6).
Accept: boundaries and the EJ fill visible together at every zoom; flood zones
readable over the EJ fill at zoom 15 over ground FEMA maps as a flood zone.
Evidence: three layers live; flood only from zoom 15 in practice (D6).

**S3. Layer toggles + legend.** Done.
Checkbox per layer; ArcGIS Legend widget or a simple custom legend. Also a status
cue for the flood layer, whose blank screen has four different meanings: zoomed
past 1:36,112, FEMA mapped this ground and put it outside the hazard area, FEMA
has not mapped this ground at all (Atlantic City, DECISIONS.md D9), and the layer
is broken.
Accept: each layer can be turned on/off; legend matches visible layers; the flood
layer's blank state says which of the four it is.
Evidence: custom toggles + legend; four flood status sentences (D9).

**S4. Deploy.** Done.
Vercel deployment from the repo.
Accept: public URL renders the same as local.
Evidence: https://nj-flood-explorer.vercel.app (D10).

## Phase 2: the interaction

**S5. Click a municipality.** Done.
Click selects the municipality under the cursor (query NJ_Municipalities by
geometry), highlights its boundary, shows its NAME and COUNTY in a side panel.
Accept: clicking anywhere in NJ highlights the right town and names it.
Evidence: click path + shared-boundary first-result rule (D11).

**S6. Exposure summary.** Done.
On selection, query the EJ layer for block groups intersecting the municipality;
query flood zones intersecting those block groups. Side panel shows: plain-language
summary sentence, one chart (block groups by EJ criterion, flooded vs not), one
table (counts and percentages).
A municipality FEMA has not mapped must never be summarised as unexposed; absence
of NFHL data is not a finding about flood risk (DECISIONS.md D9). Coverage is
judged per block group, not per municipality (DECISIONS.md D12).
Accept: numbers for 2 hand-checked towns (one coastal, one inland) match manual
queries against the same services, and Atlantic City reports per-block-group
missingness (no data for 32 of 41) with percentages computed only over mapped
block groups.
Evidence: Margate 2/2; Princeton 9 of 10; Atlantic City 32 unmapped, 9 of 9 mapped
(D12–D14).

**S7. About the data.** Done.
In-app section: the three sources with links, NJDEP's quoted definition of
overburdened community, data limitations (NFHL currency and coverage gaps,
block-group resolution, planimetric boundaries). Must also state plainly that the
NJDEP layer contains only communities designated overburdened under the NJ EJ Law
(3,180 block groups statewide), so non-overburdened block groups are not shown or
counted anywhere in the app: a deliberate lens, not an omission (DECISIONS.md D12).
Accept: every number in the panel is one click from its source.
Evidence: About quotes N.J.S.A. 13:1D-158 from the chapter text (D15).

## Phase 3: improvement passes (only after S1-S7 all pass)

**P1. Cartography pass.** Done.
Color choices defensible in DECISIONS.md, contrast checked.
Evidence: criteria-count EJ palette (D16).

**P2. UX/accessibility pass.** Done.
Keyboard focus order, ARIA on panel, mobile layout, plain-language review of all
copy.
Evidence: town `<select>` (D17); Lighthouse accessibility **100**.

**P3. Performance pass.** Done.
Run Lighthouse, record scores in DECISIONS.md, fix the top items it names.
Evidence: before/after scores and bundle figures in D18; entry deferred off ArcGIS.

**P4. Content pass.** Done.
README finalized (author-written, `4e8f244`, read-only thereafter); DECISIONS.md
hygiene (heading/pointer/statute consistency; plan marked executed).
