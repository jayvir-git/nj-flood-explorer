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
  N.J.S.A. 13:1D-157 et seq., with the classification and percentage fields
  (definition of "overburdened community" is at 13:1D-158; see D15).
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

## D6. Flood zones drawn server-side, and only at zoom 15 and closer
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
Superseded for EJ hue assignment by D16 (P1); the cyan/blue withhold still stands.
The two thematic layers are read together, so the EJ fill must not compete with
the flood zones on top of it. FEMA draws the 1% annual chance zone in cyan, so
cyan and blue are withheld from the EJ palette, which uses six qualitative hues
for the six values of OVERBURDENED_COMMUNITY_CRITERI at 45% opacity. The hue
assignment is stable but not yet meaningful; refining it is P1's job.

## D9. "No flood zone drawn" is split into four different sentences
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
Current after P3: see D18 (after: 15.0 MB / 1,231 JS chunks; P3's own before-edit
baseline was 15.6 MB / ~1,229).

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

## D12. Exposure is a binary intersects test, and coverage is judged per block group
The metric: a block group counts as flood-exposed if at least one Special Flood
Hazard Area polygon (SFHA_TF = 'T', per D7) intersects it. Conservative, cheap to
compute, and explainable in one sentence. Rejected: area-weighted percentages, which
are more informative and belong in FUTURE.md, not in the slice that first has to get
the counting right.

The missing-data guard was designed at the wrong scale and had to be demoted. It
began as a municipality-level ladder: if the flood query returned nothing for the
town, ask again unfiltered, and treat zero-and-zero as absent data. Atlantic City
broke it. Fourteen SFHA polygons do intersect the city's municipal polygon, because
that polygon is planimetric and reaches into water neighbouring FEMA panels cover,
so the ladder never reached its missing-data branch. The app would have reported 9
of 41 block groups exposed, 22% (41 rather than 42 because of the fold in D13),
while FEMA in fact publishes no flood polygon of
any kind for 32 of those 41. The most flood-exposed city in New Jersey would have
been rendered three-quarters safe by a guard written to prevent exactly that.

So coverage is now judged at the same unit as the metric. One unfiltered query
fetches the town's flood polygons carrying SFHA_TF, and each block group falls into
one of three buckets: exposed (touches a 'T' polygon), outside the hazard area
(touches only 'F' polygons), or unmapped (touches nothing). Percentages are computed
only over the mapped block groups and every one of them names its denominator in the
copy. The unmapped bucket is shown in the chart and the table whenever it is
nonzero, never as a footnote. Dropping the filter makes the result set larger, so
the pagination in queryAll matters more than it did.

The denominator is narrower than it looks. The NJDEP layer holds 3,180 records and
every one is already designated overburdened; there are no non-overburdened block
groups in it to compare against. All copy therefore says "overburdened community
block groups intersecting [town]" and never "block groups in [town]": the first is
literally true, and the second would be wrong twice over, once about the boundary
and once about the population. S7 has to say this outright, and a Census TIGER
denominator is parked in FUTURE.md.

### Atlantic City search-area correction (evidence)
Two block groups intersecting Atlantic City were filed as unmapped when the flood
query was scoped to the municipality, and are mapped (and in the Special Flood
Hazard Area) when the search area is the union of the block groups' extents:

- GEOID 340010121002 (NJDEP NAME = Pleasantville). Unfiltered NFHL layer 28 count
  against this block group's geometry returns 6. None of those 6 also intersect
  the Atlantic City municipal polygon. Browser-runnable query:
  https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=%7b%22rings%22%3a%5b%5b%5b-8292596.4682044629%2c4774010.4517430691%5d%2c%5b-8292661.8128180737%2c4773941.1947606672%5d%2c%5b-8292694.9859165195%2c4773906.0624222727%5d%2c%5b-8292833.3561567701%2c4773757.9034169484%5d%2c%5b-8292985.3072452657%2c4773593.3328968566%5d%2c%5b-8293092.7306419006%2c4773479.8773493301%5d%2c%5b-8293253.2533274051%2c4773320.63841959%5d%2c%5b-8293317.5961090056%2c4773229.7898614286%5d%2c%5b-8293432.2551505705%2c4773060.4769624742%5d%2c%5b-8293479.4546787227%2c4772976.3974125134%5d%2c%5b-8293514.1863068817%2c4772924.711883747%5d%2c%5b-8293567.3970766114%2c4772841.4972884394%5d%2c%5b-8293634.4113800162%2c4772896.3497217074%5d%2c%5b-8294945.5328789838%2c4773958.6168332985%5d%2c%5b-8295324.2419203976%2c4774267.3259929586%5d%2c%5b-8295544.3205641732%2c4774446.8826929573%5d%2c%5b-8295599.4237180473%2c4774491.8083931897%5d%2c%5b-8295654.4156463882%2c4774536.8782527819%5d%2c%5b-8295671.5588476118%2c4774550.8456061073%5d%2c%5b-8296445.0069547296%2c4775176.2299049478%5d%2c%5b-8296787.5371481869%2c4775453.7269441774%5d%2c%5b-8296847.427017034%2c4775502.2573129786%5d%2c%5b-8296879.8209549356%2c4775528.1785942987%5d%2c%5b-8297349.3667603685%2c4775908.7982451543%5d%2c%5b-8297312.5199661078%2c4775949.8421183862%5d%2c%5b-8297235.3755960055%2c4776029.626015896%5d%2c%5b-8297196.6363557726%2c4776069.2303000446%5d%2c%5b-8297156.6726214774%2c4776114.4512294028%5d%2c%5b-8297074.5188301094%2c4776200.141197443%5d%2c%5b-8297038.340037073%2c4776237.5858230498%5d%2c%5b-8296970.3238429371%2c4776311.7553028651%5d%2c%5b-8296944.7203578195%2c4776338.3987818426%5d%2c%5b-8296848.3175786249%2c4776441.3731951406%5d%2c%5b-8296829.7272034641%2c4776462.4002035884%5d%2c%5b-8296802.4539917642%2c4776500.1338351443%5d%2c%5b-8296739.2245042436%2c4776593.7483438496%5d%2c%5b-8296726.534069485%2c4776611.0311834347%5d%2c%5b-8296655.9574975483%2c4776712.7120599234%5d%2c%5b-8296629.2407335211%2c4776752.6070210161%5d%2c%5b-8296591.3921177695%2c4776807.7687961161%5d%2c%5b-8296558.4415195677%2c4776857.6020028982%5d%2c%5b-8296512.9119448708%2c4776919.8217270598%5d%2c%5b-8296343.483595741%2c4776837.1501947017%5d%2c%5b-8296211.2359337574%2c4776774.3548446754%5d%2c%5b-8296021.5474632345%2c4776682.3228899017%5d%2c%5b-8295873.9377488615%2c4776608.8708206061%5d%2c%5b-8295654.6383166369%2c4776505.0306104356%5d%2c%5b-8295642.8384349914%2c4776488.6122276923%5d%2c%5b-8295632.3744725483%2c4776495.3811535584%5d%2c%5b-8295616.2330531552%2c4776499.9898619624%5d%2c%5b-8295596.752151872%2c4776517.5605617389%5d%2c%5b-8295584.1730156848%2c4776534.1230610469%5d%2c%5b-8295570.8147840975%2c4776529.3703645598%5d%2c%5b-8295559.7940438995%2c4776524.473637661%5d%2c%5b-8295541.6489785993%2c4776520.584988106%5d%2c%5b-8295528.1793309133%2c4776526.057787599%5d%2c%5b-8295508.4757662928%2c4776529.0822729161%5d%2c%5b-8295488.7722308449%2c4776539.451856941%5d%2c%5b-8295485.6553100487%2c4776532.3947659712%5d%2c%5b-8295481.5364458458%2c4776526.4899521722%5d%2c%5b-8295474.7460331526%2c4776526.4898713855%5d%2c%5b-8295461.9442609176%2c4776525.3377323467%5d%2c%5b-8295448.1405564221%2c4776521.1611293731%5d%2c%5b-8295440.7934671585%2c4776525.3377326187%5d%2c%5b-8295433.0011335546%2c4776548.6693133255%5d%2c%5b-8295387.8054634817%2c4776644.0125676468%5d%2c%5b-8295368.9923962271%2c4776684.6273525404%5d%2c%5b-8295312.2194605656%2c4776724.9542847695%5d%2c%5b-8295295.2989091855%2c4776740.9410709683%5d%2c%5b-8295279.7141284682%2c4776776.5153249074%5d%2c%5b-8295284.2783332318%2c4776778.8197569652%5d%2c%5b-8295278.8236298263%2c4776795.3827010579%5d%2c%5b-8295281.9405799983%2c4776804.8883524202%5d%2c%5b-8295283.3877026569%2c4776810.7934201099%5d%2c%5b-8295278.8236805443%2c4776822.0274395384%5d%2c%5b-8295270.029346928%2c4776835.7099741539%5d%2c%5b-8295255.1125551388%2c4776849.3925481783%5d%2c%5b-8295246.8749256246%2c4776857.4580186335%5d%2c%5b-8295237.9693000317%2c4776861.9228073275%5d%2c%5b-8295222.0506179305%2c4776866.9638168104%5d%2c%5b-8295201.1225491762%2c4776878.053862514%5d%2c%5b-8295184.0907404702%2c4776885.9753996851%5d%2c%5b-8295174.4059479106%2c4776891.5923872339%5d%2c%5b-8295156.1495292298%2c4776900.5220719082%5d%2c%5b-8295139.4515551468%2c4776909.1638097959%5d%2c%5b-8295126.6498734383%2c4776923.1344467383%5d%2c%5b-8295061.3052661372%2c4776928.3194380524%5d%2c%5b-8295035.1451947186%2c4776913.4846187653%5d%2c%5b-8295025.0150994025%2c4776901.5303638121%5d%2c%5b-8294657.8832583753%2c4776464.4166891705%5d%2c%5b-8294513.947169167%2c4776293.1769843148%5d%2c%5b-8294029.4845186882%2c4775716.3985910174%5d%2c%5b-8293006.3467361024%2c4774498.7201627698%5d%2c%5b-8292596.4682044629%2c4774010.4517430691%5d%5d%5d%2c%22spatialReference%22%3a%7b%22wkid%22%3a102100%7d%7d&geometryType=esriGeometryPolygon&inSR=102100&spatialRel=esriSpatialRelIntersects&where=1%3d1&returnCountOnly=true&f=json
- GEOID 340010133011 (NJDEP NAME = Ventnor City). Unfiltered NFHL layer 28 count
  against this block group's geometry returns 7. None of those 7 also intersect
  the Atlantic City municipal polygon. Browser-runnable query:
  https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=%7b%22rings%22%3a%5b%5b%5b-8292523.8878390798%2c4772483.5961501971%5d%2c%5b-8292391.1949785426%2c4772243.3227824755%5d%2c%5b-8291881.796787641%2c4771399.1726292567%5d%2c%5b-8291554.7399676554%2c4770857.2206431832%5d%2c%5b-8291680.3083201973%2c4770749.2655207878%5d%2c%5b-8291771.4790749466%2c4770668.0840761941%5d%2c%5b-8291871.2213494275%2c4770579.2745992057%5d%2c%5b-8291855.413911337%2c4770555.6690211305%5d%2c%5b-8291824.3558064224%2c4770503.4202566948%5d%2c%5b-8291787.8430629028%2c4770453.1867725812%5d%2c%5b-8291846.0631837118%2c4770415.0439581871%5d%2c%5b-8291905.5077589629%2c4770377.6211076751%5d%2c%5b-8291962.9485753309%2c4770341.349778099%5d%2c%5b-8292021.0573875811%2c4770305.0785931442%5d%2c%5b-8292080.0568183241%2c4770268.807568321%5d%2c%5b-8292137.386286757%2c4770232.1048963889%5d%2c%5b-8292206.5156867383%2c4770188.0617275406%5d%2c%5b-8292277.4262751993%2c4770144.0188434506%5d%2c%5b-8292350.5631518941%2c4770099.9762485651%5d%2c%5b-8292421.3624440767%2c4770054.7823008513%5d%2c%5b-8292458.5431887163%2c4770032.7610248756%5d%2c%5b-8292488.8221091097%2c4770013.0427745227%5d%2c%5b-8292521.4386785915%2c4769992.1732075438%5d%2c%5b-8292523.4424389722%2c4769970.1521369973%5d%2c%5b-8292531.9027506569%2c4769951.7293293271%5d%2c%5b-8292537.5800181404%2c4769941.5104548428%5d%2c%5b-8292547.0422095507%2c4769931.7233547345%5d%2c%5b-8292556.2816878045%2c4769924.6708545862%5d%2c%5b-8292564.0740466556%2c4769918.4819843238%5d%2c%5b-8292583.4435852841%2c4769905.8164230688%5d%2c%5b-8292611.6074949047%2c4769886.0984142739%5d%2c%5b-8292639.8826079397%2c4769864.3654644685%5d%2c%5b-8292695.7649880117%2c4769821.0435956605%5d%2c%5b-8292757.7700710641%2c4769907.2556442199%5d%2c%5b-8292823.4485520357%2c4769997.2106410228%5d%2c%5b-8292909.8324470362%2c4770112.6420411682%5d%2c%5b-8292929.3134463346%2c4770139.8447953463%5d%2c%5b-8292961.7073444715%2c4770182.1604894977%5d%2c%5b-8292986.5316329338%2c4770215.696520729%5d%2c%5b-8293035.8462005882%2c4770279.458464398%5d%2c%5b-8293070.8005216597%2c4770330.9865795914%5d%2c%5b-8293085.7173820091%2c4770346.5313727288%5d%2c%5b-8293133.4734469475%2c4770413.0288872188%5d%2c%5b-8293158.4090193799%2c4770447.141457079%5d%2c%5b-8293215.4046588773%2c4770524.7226515058%5d%2c%5b-8293237.5572001422%2c4770556.5326145254%5d%2c%5b-8293249.8023576718%2c4770573.8049515076%5d%2c%5b-8293255.0344132595%2c4770580.7139178114%5d%2c%5b-8293263.0494143376%2c4770593.3804631848%5d%2c%5b-8293337.9673715616%2c4770694.4247619351%5d%2c%5b-8293360.787938158%2c4770725.0837110272%5d%2c%5b-8293370.4727321072%2c4770738.1822448131%5d%2c%5b-8293377.7084846934%2c4770748.4019120838%5d%2c%5b-8293392.8479653569%2c4770769.8488636175%5d%2c%5b-8293412.662792461%2c4770797.9171527978%5d%2c%5b-8293455.5208664406%2c4770855.9251028514%5d%2c%5b-8293519.9748895727%2c4770944.7370476555%5d%2c%5b-8293522.3125958117%2c4770947.7597431717%5d%2c%5b-8293556.710301741%2c4770993.5334473662%5d%2c%5b-8293702.5388630005%2c4771188.0021109404%5d%2c%5b-8293706.7690403517%2c4771193.3281815602%5d%2c%5b-8293746.6214716621%2c4771187.1384779429%5d%2c%5b-8293777.4568998646%2c4771180.5169985089%5d%2c%5b-8293904.0272091283%2c4771153.0233727694%5d%2c%5b-8293967.4793438287%2c4771138.1970804268%5d%2c%5b-8293984.0659669489%2c4771131.2876833407%5d%2c%5b-8294018.129749842%2c4771123.0828219736%5d%2c%5b-8293925.6231961073%2c4771243.5652288273%5d%2c%5b-8293919.7233302742%2c4771254.2173587056%5d%2c%5b-8293897.1254221657%2c4771294.6663831538%5d%2c%5b-8293870.4087979132%2c4771344.9040102968%5d%2c%5b-8293850.4825409809%2c4771405.6502109244%5d%2c%5b-8293835.4543661894%2c4771454.4489422617%5d%2c%5b-8293831.5582118491%2c4771507.4224801734%5d%2c%5b-8293825.101751918%2c4771558.8128638417%5d%2c%5b-8293813.8583724648%2c4771626.7578544505%5d%2c%5b-8293804.6189354621%2c4771710.5382535933%5d%2c%5b-8293781.0191504592%2c4771909.6273523616%5d%2c%5b-8293768.440064759%2c4772004.4947121013%5d%2c%5b-8293768.2174073718%2c4772066.2526505766%5d%2c%5b-8293776.6776976697%2c4772129.738410796%5d%2c%5b-8293778.5701336348%2c4772208.9162533656%5d%2c%5b-8293780.4626184152%2c4772242.1710731741%5d%2c%5b-8293777.3456148542%2c4772284.0636978913%5d%2c%5b-8293765.7684235554%2c4772321.9255828587%5d%2c%5b-8293729.4783299388%2c4772419.532183852%5d%2c%5b-8293690.961781634%2c4772513.9725131448%5d%2c%5b-8293642.4263662389%2c4772644.6932518985%5d%2c%5b-8293567.3970766114%2c4772841.4972884394%5d%2c%5b-8293514.1863068817%2c4772924.711883747%5d%2c%5b-8293479.4546787227%2c4772976.3974125134%5d%2c%5b-8293361.4559686081%2c4772908.1552772187%5d%2c%5b-8293253.3647354841%2c4772850.2794728875%5d%2c%5b-8293231.1008027988%2c4772837.6101511698%5d%2c%5b-8293150.5054057203%2c4772791.684049136%5d%2c%5b-8293115.8850593101%2c4772784.4856364382%5d%2c%5b-8293090.8382030465%2c4772781.1743295472%5d%2c%5b-8293053.7687182892%2c4772771.5284433011%5d%2c%5b-8292931.2059784681%2c4772704.0075805746%5d%2c%5b-8292886.678119584%2c4772677.5176424822%5d%2c%5b-8292731.6099952748%2c4772585.3791836891%5d%2c%5b-8292646.6732561858%2c4772541.6138443928%5d%2c%5b-8292567.3023837171%2c4772501.8794995826%5d%2c%5b-8292523.8878390798%2c4772483.5961501971%5d%5d%5d%2c%22spatialReference%22%3a%7b%22wkid%22%3a102100%7d%7d&geometryType=esriGeometryPolygon&inSR=102100&spatialRel=esriSpatialRelIntersects&where=1%3d1&returnCountOnly=true&f=json

Mechanism: the flood query used the municipality polygon as its search area.
Atlantic City's municipal query returns 14 NFHL polygons; the intersection of that
set with the polygons that touch either GEOID above is empty. The NFHL polygons
those block groups actually intersect lie entirely outside the municipal boundary,
so the client-side intersects test against the municipality-scoped result set found
nothing and filed both as unmapped. Not geometry generalization, not pagination
truncation (exceededTransferLimit was unset on the 14-polygon municipal result),
and not a server-vs-geometryEngine disagreement: the polygons were never fetched.

The intersecting count fell from 42 to 41 because NJDEP returns 42 rows for Atlantic
City and GEOID 340010120002 is stored twice (Egg Harbor Township and Pleasantville
parts); folding by GEOID yields 41 distinct block groups.

## D13. NJDEP records are block-group parts, folded together by GEOID
The NJDEP layer's rows are not census block groups. A block group straddling a
municipal line is stored once per municipality, clipped to it, with the NAME field
holding the municipality rather than anything about the block group. GEOID
340010120002 is filed twice, as Egg Harbor Township and as Pleasantville, with
different geometries of 65 and 225 vertices. Statewide the layer's 3,180 rows cover
3,168 distinct block groups; 12 are split this way.

Counting rows would therefore have reported 42 block groups intersecting Atlantic
City where there are 41, double-counting the one whose two halves both reach the
city. So rows are folded together by GEOID and a block group counts as exposed if
any of its parts intersects a Special Flood Hazard Area. All 12 split block groups
carry the same criterion on both parts, so folding never has to reconcile a
disagreement. The fold is scoped to one municipality's results, which also disposes
of the two non-numeric GEOIDs in the layer, 9835R and 9850R: each is one area split
across two adjacent towns, 9850R being Ramapough tribal land across Mahwah and
Ringwood, so no unrelated rows can ever collide under a shared GEOID.

## D14. Flood polygons are fetched over the block groups' extent, not the town's
The first working version scoped both queries to the municipality, which is wrong
for the flood one and produced a wrong answer that looked plausible. Block groups do
not nest inside municipal boundaries, so a block group counted as intersecting a
town can lie mostly outside it; if the flood query stops at the town line, FEMA's
coverage of that block group's far side is invisible and the block group is filed as
unmapped when FEMA maps it perfectly well.

Atlantic City showed it. Scoped to the city, the flood query returns 14 polygons,
and two block groups came back unmapped: GEOID 340010121002, which NJDEP files under
Pleasantville, and GEOID 340010133011, filed under Ventnor City. Both are mapped by
FEMA, and both are in a Special Flood Hazard Area, on polygons that sit outside
Atlantic City and so never entered the query. The city read as 34 unmapped and 7
exposed instead of 32 and 9.

The search area is therefore the union of the block groups' own extents. It is a
superset of every block group, so no intersecting polygon can be missed, and the
client-side test still decides precisely; the extra polygons are fetched and
discarded. Verified against a per-block-group hand-check that asks FEMA's server for
each block group separately: zero disagreements across Margate City, Princeton and
Atlantic City. The cost is volume, and it is not hypothetical. Princeton's extent
returns 1,419 flood polygons against a 2,000-record cap, so a larger town will page,
which is why queryAll honours exceededTransferLimit rather than trusting one round
trip.

## D15. Overburdened-community definition quoted from the Legislature chapter text
The About section quotes the definition of "overburdened community" from
P.L. 2020, c. 92, §2 (N.J.S.A. 13:1D-158), retrieved from
https://www.njleg.state.nj.us/2020/Bills/PL20/92_.HTM. Rejected: typing the thresholds
from memory, and citing dep.nj.gov/ej as the quote's source when that origin and
NJDEP's hosted ej-law.pdf returned only Incapsula/bot-challenge HTML from this
environment. The definition lives in 13:1D-158 (definitions), not 13:1D-157
(findings); the About section names both the chapter URL and the correct section
cite. The live NJDEP service and info URLs in sources.ts remain the links for the
layer itself.

## D16. EJ palette ordered by number of statutory criteria met (P1)
P1 replaces the arbitrary qualitative shuffle from D8. Each of the six
OVERBURDENED_COMMUNITY_CRITERI values is coloured by how many of the law's three
axes it meets (low income, minority / tribal, limited English):

| Criteria | Value | Hex |
|---|---|---|
| 1 | Low Income | `#fd8d3c` |
| 1 | Minority | `#8073ac` |
| 2 | Low Income and Minority | `#e66101` |
| 2 | Low Income and Limited English | `#c51b7d` |
| 2 | Minority and Limited English | `#4d9221` |
| 3 | Low Income, Minority, and Limited English | `#542788` |

Lighter / mid / darkest tracks 1 → 2 → 3. Hue families still hint at which axes
are involved (warm for income, purple for minority, magenta when limited English
pairs with income, green when it pairs with minority) without claiming a
perceptual "mix" of the single-axis colours. Cyan and blue stay withheld so FEMA's
`#00e6ff` / `#ff0000` flood drawingInfo remains the only cool flood signal (D8).
Fill opacity stays 0.45; raising it did not fix neighbour luminance ratios and
would only bury the basemap.

Rejected: a single-hue sequential scale by criteria count (loses which axes fire);
keeping the old Dark2-like order with a prose rationale bolted on (the order was
still meaningless); inventing our own flood colours (the MapImageLayer uses FEMA's
renderer).

Contrast check: chart series on white — exposed `#0b6a8a` 6.1:1, unmapped
`#8a3200` 8.3:1; outside-SFHA `#c9c9c9` 1.7:1 left muted on purpose (status fill,
not text). Map fills at 0.45 over gray-vector distinguish by hue more than by
WCAG luminance (adjacent blended pairs sit near 1.0–1.5:1); flood cyan remains a
separate hue family from every EJ swatch. Selection halo and municipal outline
unchanged. Chart series unchanged — they encode exposure status, not EJ class.

## D17. Keyboard town picker shares the map-click selection path (P2)
Selection was map-canvas click only, which left keyboard users unable to reach the
app's core purpose. P2 adds a native `<select>` of municipalities, populated once
from the NJOGIS service with `returnGeometry: false`, that resolves a choice by
`MUN_CODE` with geometry and feeds the same highlight and exposure path as a click.
It is an accessibility affordance, not a search product: no typeahead library, no
second interaction model. Rejected: relying on map keyboard focus (ArcGIS MapView
has no equivalent town-pick gesture for assistive tech); hitTest against drawn
features (D2/D3 — the service remains authoritative).

P2 Lighthouse accessibility on the local production build
(`vite preview`, Lighthouse 12.8.2, accessibility category only): **100**. No
audits scored 0. Keyboard path: layer toggles → town `<select>` → panel → About.

## D18. Performance pass: defer ArcGIS off the critical path (P3)
Baseline on the local production build before changes (`npm run build`,
`vite preview`, Lighthouse performance; D10's recorded bundle was 15.2 MB over
1,224 chunks — this run measured **15.6 MB / ~1,229 JS chunks** before edits):

| | Score | LCP | TBT | CLS | FCP |
|---|---:|---:|---:|---:|---:|
| Mobile before | 29 | 22134 ms | 1522 ms | 0.009 | 15538 ms |
| Desktop before | 50 | 6259 ms | 202 ms | 0.004 | 4471 ms |

Top named items: unused JavaScript (ArcGIS-dominated), preconnect to data origins,
unused CSS (ArcGIS theme). Desktop also flagged HTTP/2 against localhost preview.

**Changed (measurement-backed):**
- Dynamic-import `MapStage` (ArcGIS MapView + layers) with a map-slot placeholder
  so the shell (picker, panel, About, layer legend) paints without the SDK; start
  that import after the first animation frame so it does not race FCP. LCP/FCP were
  dominated by SDK boot/render delay (D10's lever).
- Split legend constants into `legend.ts` with no `@arcgis/core` imports —
  `LayerPanel` had been statically importing `layers.ts` and pulling the SDK
  into the entry despite the lazy map.
- `build.modulePreload: false` — Vite was emitting ~200 `modulepreload` links
  for the lazy ArcGIS graph into `index.html`, undoing the split.
- Lazy-load `ExposureSummary` / Recharts (unused JS inside the former entry).
- `preconnect` to basemaps.arcgis.com, services2.arcgis.com, mapsdep.nj.gov,
  hazards.fema.gov (named by the preconnect audit; SDK assets are bundled, not CDN).
- Town list / pick via REST in `towns.ts` so the shell does not need FeatureLayer;
  attach FeatureSet-root `spatialReference` to geometries (Esri omits it on each
  feature) so picker-driven exposure matches map-click numbers.

After (same harness; accessibility category still **100**, D17):

| | Score | LCP | TBT | CLS | FCP |
|---|---:|---:|---:|---:|---:|
| Mobile after | 53 | 3183 ms | 4036 ms | 0.003 | 2177 ms |
| Desktop after | 43 | 6384 ms | 571 ms | 0.002 | 542 ms |

Bundle after: **15.0 MB**, 1,231 JS chunks; entry JS ~190 KB (was ~1.9 MB when the
SDK rode the main graph). TBT rose because FCP moved earlier and ArcGIS parse/boot
now falls inside the FCP→TTI window rather than delaying first paint; mobile score
still improved on LCP/FCP. Desktop score dipped on the same TBT attribution; shell
FCP is much faster on both.

**Rejected:**
- HTTP/2 fix for `vite preview` — localhost preview artifact; production on
  Vercel is already HTTP/2.
- Stripping or rewriting ArcGIS theme CSS — unused-CSS savings are the SDK skin
  required once the map loads; no safe subset without new tooling.
- Deferring NFHL until zoomed (PLAN.md hint) — not what this audit's top items
  named once the preload leak was fixed; flood layer already respects FEMA minScale.
- SSR / new dependencies / inventing flood colours — out of P3 scope.

## D19. ArcGIS attribution sources have no public name or tab-order API (A5)
The map surface is named through the public `MapView.aria.label` property
(DOMContainer since 4.34). `_updateAria()` writes that string onto
`.esri-view-surface` and leaves `role="application"` in place so arrow-key
panning stays announced as an application.

The other unnamed tab stop, `.esri-attribution__sources`, is not reachable
the same way. In `@arcgis/core` 5.1.15 the attribution UI is a private
`views/Attribution` instance (`_attribution` on DOMContainer). Its only
constructor inputs are `attributionItems` and `mode`. When the credit line
overflows it sets `tabindex="0"` on the sources div so the line can be
expanded; it never sets an accessible name. The sources div has visible text
but `role=generic`, which does not compute an accessible name from contents.
The public view surface exposes `attributionItems` (read the text),
`attributionMode` (light/dark), `attributionHeight` (read), and
`attributionVisible` (hide the whole bar). Hiding the bar with no replacement
is rejected: Esri's ToS requires attribution on an ArcGIS Online basemap, and
we use `gray-vector`. The deprecated `widgets/Attribution` `label` property
is widget chrome, is not applied to the sources div, and is not what v5
instantiates.

Alternative considered: set `view.attributionVisible = false` and render the
attribution ourselves from the public readonly `view.attributionItems` array,
in our own accessible markup. This is a supported public-API path and still
displays attribution, so it does not breach the gray-vector requirement.
Rejected: it trades one stray tab stop for hand-maintained, licensing-sensitive
markup that must stay correct as basemap sources change. The failure mode of
getting basemap attribution wrong is worse than the failure mode of an unnamed
tab stop that has visible text and is announced by most screen readers.

Also rejected: `querySelector` / setting `tabIndex` or `aria-label` on SDK DOM
(monkey-patch; breaks on the next upgrade); forking or patching
`@arcgis/core`. Recorded as a third-party limitation. Parked in FUTURE.md.

## D20. Mobile height lock is the html/body/#root/shell chain (M1)
The inner scroll box on `.town-panel` was not just `max-height: 48%`. That cap
only existed because `.map-shell` is `height: 100%` / `min-height: 100%` and
`html, body, #root` are also `height: 100%`, so the document cannot grow and
the panel has to clip. Unlocking only the shell would still leave the page
inside a viewport-tall `#root`.

On viewports ≤700px only: `html, body, #root` and `.map-shell` become
`height: auto; min-height: 100%`, and the panel drops `max-height` and
`overflow-y: auto` so it sizes to its content and the PAGE scrolls. Desktop
rules are unchanged. Rejected: raising `max-height` to a larger percentage
(the panel's height depends on how many criterion rows the town has).

## D21. Mobile panel uses a scoped border-box, not a global reset (M1b)
At 390px the panel's `width: 100%` is the content box. Horizontal padding is
20px + 20px, `box-sizing` is the initial `content-box`, and no sheet sets
otherwise, so the border box is 430px and the page scrolls sideways by exactly
that extra 40px.

Chose `box-sizing: border-box` on `.town-panel` inside the existing
`max-width: 700px` block. That keeps `width: 100%` as the override of the
desktop 400px width and makes 100% include the padding. Rejected: dropping
`width: 100%` and relying on flex stretch (`width: auto`) — it still has to
override the 400px, and the used width then depends on stretch vs content-box
rather than the arithmetic that was measured. Rejected: a global
`*, *::before, *::after { box-sizing: border-box }` reset in this pass — it
would shrink the desktop panel from 440px border-box to 400px. Parked in
FUTURE.md.
