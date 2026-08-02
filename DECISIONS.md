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
