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

## Phase 5: interaction accessibility pass (2026-08-23)

P2 ran axe/Lighthouse and scored accessibility 100. That score is real but it audits
the DEFAULT page state and cannot drive the interaction. Every defect below is either
interaction-dependent or lives in a subtree that only renders after a town is
selected, which is why an automated pass on initial load could not see any of them.
This phase is the manual pass that P2's tooling could not perform.

**A1. Announce the town summary.** Done. `3abaf1e`
The `.town-status` live region existed with aria-live="polite" and was never written
to, so the app's one core interaction was silent to screen readers.
Evidence: single-source `exposureSummarySentence()` feeds both the visible panel and
the region; one loading announcement and one result announcement per selection.

**A2. Focus management across view swaps.** Done. `dd1cb59`
Opening "About the data" unmounted the focused button and dropped focus to <body>,
returning keyboard users to the top of the document.
Evidence: opening focuses `#about-title`; Back returns focus to whichever of the two
triggers opened the view (panel button or Sources button); activeElement never <body>.

**A3. Chart is not a hidden tab stop.** Done. `cca5ebd`
Recharts sets tabIndex=0 and role="application" on the root svg, inside the
aria-hidden="true" chart wrapper: a focusable element hidden from the accessibility
tree (WCAG 4.1.2, axe aria-hidden-focus). Invisible to Lighthouse because the chart
only exists after a town is selected.
Evidence: `accessibilityLayer={false}` on <BarChart>; svg reports tabindex=null and
role=null; nothing in the wrapper is focusable.

**A4. Page has an H1.** Done. `1f7119b`
No H1 existed in any view; headings started at H2.
Evidence: visible H1 in the panel, present in all three states, outline reads
H1 > H2 > H3 with no skipped levels.

**A5. Accessible names on the ArcGIS elements.** Done. `7dfac97`
Accept: every element in the accept selector has an accessible name EXCEPT
.esri-attribution__sources, an SDK-owned tab stop with no public naming path,
carved out and justified in D19.
Evidence: MapView.aria.label names the view surface; 12 nodes, 1 documented
exception.

**A6. Skip link.** Done. `c8403fc`
Accept: first Tab on load reveals a skip link; Enter moves focus to the town select.
Evidence: first Tab focuses the `.sr-only` skip link and `:focus` unclips it;
Enter moves focus to `#town-select`.

**A7. Landmark label matches contents.** Done. `e797806`
Accept: the aside's accessible name describes everything inside it.
Evidence: aside labelled "NJ Flood Exposure Explorer" in every view, matching
the H1, chooser, summary, and About contents.

## Phase 6: mobile layout pass (2026-08-24)

P2 lists "mobile layout" as part of the UX/accessibility pass and marks it Done. As with the
Lighthouse 100 in Phase 5, the pass ran and left real defects standing. Measured on the live
app at 390x844: the answer panel is capped at 307px as an internal scroll box, the map takes
58% of the screen, and the always-open legend covers 47% of the map. The result inverts the
product's own answer-first principle on the device where it matters most.

**M1. Let the page scroll on mobile.** Done. `c9bd2cb`
Accept: at 390x844 with a town selected, the verdict sentence, chart, table and sources are
all reachable by scrolling the PAGE, with no inner scroll box and nothing clipped.
Evidence: Camden at 390x844 — `.town-panel` scrollHeight === clientHeight; summary, chart,
table, and sources in the document; page scrollHeight 1013 > 844.

**M1b. No horizontal page scroll from panel padding.** Done. `c4b9b63`
Accept: at 390x844, documentElement.scrollWidth === clientWidth === 390, and the panel's
border-box width is 390.
Evidence: scoped `box-sizing: border-box` on `.town-panel` in the 700px query (D21).

**M2. Collapse the legend behind a disclosure on mobile.** Done. `4915615`
Accept: the legend is closed by default under 700px, opens from a labelled control, and the
map is unobscured on load.
Evidence: 390x844 — "Map layers" button `aria-expanded="false"` on load, three toggles in a
`hidden` region; open reveals all three labelled checkboxes. Zoom `.status` stays mounted
(sr-only when collapsed). Desktop: no button, `.panel` still the named region. Camden table
scrollWidth === clientWidth (350); page 390===390.

**M3. Give the map a sensible fixed height on mobile.** Done. `5d1e3ca`
Accept: the map is large enough to read and no longer claims the majority of the screen.
Evidence: stacked `.map-area` is 60vh (390×844 → 506px); legend cover 3% on load.
Breakpoint raised to 800px (`NARROW_MAX_WIDTH`, D23–D24) so 768×1024 is column not a
368px sidebar map. Window resize across 800px: button and column appear/disappear
together; layer toggles never stranded. 360/390/768/1280: scrollWidth === clientWidth.

**D-1 / D-2. Mobile legend affordance and cap.** Done. `3680924`
Evidence: same "Map layers" button shows + collapsed and − expanded (`aria-hidden` mark);
expanded `.panel` `max-height: calc(100% - 16px)` `overflow-y: auto` stays inside the map.

**D26. One About the data control.** Done.
Evidence: only the `.town-about` button remains; Sources is links only; Back still restores
focus to that button (A2).
