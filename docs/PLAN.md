# Build plan: vertical slices

Each slice has one acceptance criterion. A slice is done when the criterion passes
in the running app and the change is committed. Ideas beyond the current slice go
to FUTURE.md.

## Phase 1: walking skeleton

**S1. Map on screen.**
Vite + React + TS app renders an ArcGIS MapView, basemap `gray-vector`, centered on
New Jersey (approx. -74.55, 40.07, zoom 8).
Accept: `npm run dev` shows the map, no console errors.

**S2. Three layers.**
Municipal boundaries (outline only), NJDEP overburdened communities (categorical
fill by OVERBURDENED_COMMUNITY_CRITERI, semi-transparent), FEMA flood hazard zones
(layer 28, filtered to Special Flood Hazard Area zones, semi-transparent).
FEMA publishes layer 28 with a 1:36,112 scale limit, so flood zones cannot be drawn
at state zoom, nor at the zoom where a whole municipality fits (DECISIONS.md D6).
Accept: boundaries and the EJ fill visible together at every zoom; flood zones
readable over the EJ fill at zoom 15 over ground FEMA maps as a flood zone.

**S3. Layer toggles + legend.**
Checkbox per layer; ArcGIS Legend widget or a simple custom legend. Also a status
cue for the flood layer, which draws nothing above 1:36,112: "zoomed too far out",
"no flood zone mapped here" and "layer broken" are currently one blank screen.
Accept: each layer can be turned on/off; legend matches visible layers; the flood
layer's blank state says which of the three it is.

**S4. Deploy.**
Vercel deployment from the repo.
Accept: public URL renders the same as local.

## Phase 2: the interaction

**S5. Click a municipality.**
Click selects the municipality under the cursor (query NJ_Municipalities by
geometry), highlights its boundary, shows its NAME and COUNTY in a side panel.
Accept: clicking anywhere in NJ highlights the right town and names it.

**S6. Exposure summary.**
On selection, query the EJ layer for block groups intersecting the municipality;
query flood zones intersecting those block groups. Side panel shows: plain-language
summary sentence, one chart (block groups by EJ criterion, flooded vs not), one
table (counts and percentages).
Accept: numbers for 2 hand-checked towns (one coastal, one inland) match manual
queries against the same services.

**S7. About the data.**
In-app section: the three sources with links, NJDEP's quoted definition of
overburdened community, data limitations (NFHL currency, block-group resolution,
planimetric boundaries).
Accept: every number in the panel is one click from its source.

## Phase 3: improvement passes (only after S1-S7 all pass)

**P1. Cartography pass:** color choices defensible in DECISIONS.md, contrast checked.
**P2. UX/accessibility pass:** keyboard focus order, ARIA on panel, mobile layout,
plain-language review of all copy.
**P3. Performance pass:** run Lighthouse, record scores in DECISIONS.md, fix the
top items it names (likely: lazy-load ArcGIS modules, defer NFHL until zoomed).
**P4. Content pass:** README finalized (author-written), DECISIONS.md cleaned.
