# Decisions

Running log of non-obvious choices: what was chosen, what was rejected, why.
Newest at the bottom.

## D1. ArcGIS Maps SDK for JavaScript over Leaflet/MapLibre
All three data sources are Esri REST services (FEMA NFHL, NJDEP, NJOGIS). The
ArcGIS SDK consumes them natively (FeatureLayer, server-side queries, legends)
where Leaflet would need plugins and hand-rolled query code. Cost: heavier bundle;
accepted, and addressed later in the performance pass.

## D2. Data sources pinned to authoritative services, verified by hand
- FEMA NFHL MapServer layer 28 (Flood Hazard Zones): the federal system of record
  for regulatory flood zones.
- NJDEP "Overburdened Communities under the New Jersey EJ Law"
  (Features/Government/MapServer/42): the state's own published layer implementing
  N.J.S.A. 13:1D-157, with the classification and percentage fields.
- NJOGIS NJ_Municipalities_3857 hosted FeatureServer: the state GIS office's
  municipal boundaries, already in Web Mercator to match the basemap.
Each URL and its field names were opened and checked in a browser before use.
Rejected: copying data into the repo (staleness, size); a backend (nothing here
needs one).

## D3. No backend
All queries run client-side against public feature services. Rejected a FastAPI
proxy: it would add an operations burden and a failure mode without adding a
capability this scope needs.

## D4. Municipality as the unit of answer
People identify with their town, and NJ hazard planning happens at municipal
level. Block groups are the unit of the EJ data and appear in the detail, but the
question the app answers is asked town by town. Rejected: address-level lookup
(out of scope; FUTURE.md).

## D5. MapView created once, destroyed on a deferred cleanup
React StrictMode runs an effect's cleanup and then re-runs the effect on mount.
Destroying the MapView synchronously in cleanup aborted the basemap request in
flight and logged an ArcGIS error on every dev page load. The view is now held in
a ref, created once, and destroyed on a timer that the remount cancels. Rejected:
dropping StrictMode (the rest of the app keeps the benefit of its checks), and
tolerating the error (a permanent red herring in the console would hide real
layer-load failures in later slices).

## D6. Flood zones drawn server-side, and only at zoom 14 and closer
FEMA publishes NFHL layer 28 with minScale 1:36,112 (web Mercator zoom 14) and
returns an empty image above that scale. The limit is the service's own: a
dynamicLayers minScale override leaves county and state extents blank, and every
other substantive NFHL layer is capped the same way. Client-side rendering was
rejected as the way around it: 36,839 SFHA polygons cover New Jersey against a
2,000-record cap, and a bare count query takes ~15s, so a FeatureLayer would be
slow and would silently drop features. Server-side export answers in 200-450ms
inside the allowed range, so the layer is a MapImageLayer honouring the service
scale range. Consequence: S2's "visible at state zoom" holds for the boundaries
and the EJ fill; flood zones appear only from zoom 14 in. This is a limitation of
the data, and S7 has to say so.

Corrected after tracing an apparent "flood zones never render" bug to the service
rather than our code: zoom 14 computes to 1:36,112, a hair above FEMA's
1:36,111.909643, so the layer in practice needs zoom 15, where a viewport spans
roughly 3km of ground and no whole New Jersey municipality fits beside its flood
zones. Because an out-of-range view, an area FEMA maps no flood zone in, and a
broken layer are all drawn as nothing at all, the map has to tell the reader which
one it is.

## D7. Special Flood Hazard Area filtered on SFHA_TF
The filter is SFHA_TF = 'T' rather than a hand-listed set of FLD_ZONE values, so
the definition of "Special Flood Hazard Area" stays FEMA's rather than becoming
ours. The field was verified present on layer 28 and added to sources.ts.

## D8. Cyan reserved for flood zones; EJ criteria get a qualitative palette
The two thematic layers are read together, so the EJ fill must not compete with
the flood zones on top of it. FEMA draws the 1% annual chance zone in cyan, so
cyan and blue are withheld from the EJ palette, which uses six qualitative hues
for the six values of OVERBURDENED_COMMUNITY_CRITERI at 45% opacity. The hue
assignment is stable but not yet meaningful; refining it is P1's job.

## D9. "No flood zone drawn" is split into three different sentences
Chasing why Atlantic City showed no flood zones turned up a hole in the data. Four
points on AC land (boardwalk, marina district, inlet, Ventnor border) and 21 points
sampled across the municipal polygon all return zero features from layer 28 with no
filter at all: not Zone X, nothing. Margate City, one municipality away, returns
Zone VE from panel 34001C on the identical query, so this is FEMA's coverage and not
our projection or our filter. Eleven other towns sampled all return a polygon.

So a blank flood layer means one of four things, and the difference matters more
here than almost anywhere else in the app: Atlantic City is one of the most
flood-exposed cities in the state, and "no flood zones shown" would read as
reassurance. The status line therefore separates zoomed past the scale limit, FEMA
mapping this ground and placing it outside the Special Flood Hazard Area, FEMA
publishing nothing for this ground, and the service failing. Distinguishing the
middle two costs a second count query with the SFHA filter dropped, and only when
the first count comes back zero.

Rejected: reporting Atlantic City as 0% flood-exposed, which is what a naive count
would produce and is the most dangerous wrong answer this app could give. S6 and S7
carry the consequence.

## D10. Deployed on Vercel unconfigured, and the bundle left alone until P3
Vercel detects the Vite framework by itself, so there is no vercel.json and no build
overrides; the first `vercel deploy --prod` was the only manual step, and the CLI
found the GitHub remote and connected it, so pushes now deploy themselves. The
production build is 15.2 MB over 1,224 chunks and Vite warns that several exceed
500 kB, essentially all of it the ArcGIS SDK. Deliberately not touched: P3 owns
performance, and code-splitting the SDK before the app's shape is settled would be
optimising a moving target. The number is recorded so P3 starts from a measurement.

The live site logged "Access to storage is not allowed from this context" four
times, which was a browser extension and not the app: it vanishes in an incognito
window, the app stores nothing, and the only two bundled chunks that reach for
localStorage (IdentityManager, and video.js inside VideoLayer) both wrap it in
try/catch and neither loads here. Noted so the same console line does not get
investigated twice.

## D11. A click on a shared boundary takes the service's first result
Municipalities share edges, so a click landing exactly on one intersects two of them
and the service returns both. Nothing in the click favours either: the point is
equally inside each, and a cursor carries no sub-pixel intent. The first returned
feature is taken. Rejected: querying with "contains" instead, since a boundary point
is contained by neither and the click would clear the selection, which reads as a
bug; and prompting the reader to choose, which is a lot of interface for a case
measured in fractions of a pixel. The case is rare enough at floating-point
precision that it may never occur in practice. It is written down because the
alternative is code that silently assumes exactly one result.

The selected geometry is stored exactly as returned, unsimplified. S6 uses it as the
spatial filter for its own queries, and a smoothed outline would quietly change
which block groups and flood zones count as intersecting it.
