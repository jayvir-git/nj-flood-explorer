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
