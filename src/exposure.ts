import type Graphic from '@arcgis/core/Graphic.js'
import type Extent from '@arcgis/core/geometry/Extent.js'
import type Polygon from '@arcgis/core/geometry/Polygon.js'
import * as intersectsOperator from '@arcgis/core/geometry/operators/intersectsOperator.js'
import type FeatureLayer from '@arcgis/core/layers/FeatureLayer.js'
import type Sublayer from '@arcgis/core/layers/support/Sublayer.js'
import type FeatureSet from '@arcgis/core/rest/support/FeatureSet.js'
import { SOURCES } from './config/sources'

/** Both services cap a query at 2,000 records and page with start/num (D6). */
const PAGE_SIZE = 2000

export type CriterionTally = {
  criterion: string
  /** Block groups intersecting at least one Special Flood Hazard Area polygon. */
  exposed: number
  /** Block groups FEMA maps, none of it a Special Flood Hazard Area. */
  outsideSfha: number
  /** Block groups FEMA publishes no flood polygon for at all (D9). */
  unmapped: number
  total: number
}

export type Exposure = {
  kind: 'summary'
  blockGroups: number
  mapped: number
  exposed: number
  unmapped: number
  byCriterion: CriterionTally[]
}

export type ExposureResult =
  | { kind: 'no-overburdened' }
  | { kind: 'unmapped'; blockGroups: number }
  | Exposure

/** The one-sentence panel verdict; also what the town-status live region announces. */
export function exposureSummarySentence(town: string, exposure: ExposureResult): string {
  if (exposure.kind === 'no-overburdened') {
    return `NJDEP lists no overburdened communities intersecting ${town}, so this app has nothing to report for it.`
  }
  if (exposure.kind === 'unmapped') {
    const noun = exposure.blockGroups === 1 ? 'group' : 'groups'
    return `FEMA’s National Flood Hazard Layer publishes no data for any of the ${exposure.blockGroups} overburdened community block ${noun} intersecting ${town}.`
  }
  const { blockGroups, mapped, exposed, unmapped } = exposure
  if (unmapped > 0) {
    return `FEMA publishes no flood hazard data for ${unmapped} of the ${blockGroups} overburdened community block groups intersecting ${town}; of the ${mapped} it maps, ${exposed} intersect a Special Flood Hazard Area (high-risk flood zone).`
  }
  const noun = blockGroups === 1 ? 'group' : 'groups'
  return `${exposed} of the ${blockGroups} overburdened community block ${noun} intersecting ${town} intersect a FEMA Special Flood Hazard Area (high-risk flood zone).`
}

async function queryAll(run: (start: number) => Promise<FeatureSet>) {
  const features: Graphic[] = []
  for (;;) {
    const set = await run(features.length)
    features.push(...set.features)
    // A truncated result would understate exposure without saying so, so page
    // until the service stops reporting more. Dropping the SFHA filter makes the
    // result set larger, so this matters more here than it would have.
    if (!set.exceededTransferLimit || set.features.length === 0) return features
  }
}

export async function analyzeExposure(
  municipality: Polygon,
  ejLayer: FeatureLayer,
  floodSublayer: Sublayer,
): Promise<ExposureResult> {
  const blockGroups = await queryAll((start) =>
    ejLayer.queryFeatures({
      geometry: municipality,
      spatialRelationship: 'intersects',
      outFields: [
        SOURCES.njdepOverburdened.fields.criterion,
        SOURCES.njdepOverburdened.fields.geoid,
      ],
      returnGeometry: true,
      outSpatialReference: municipality.spatialReference,
      start,
      num: PAGE_SIZE,
    }),
  )
  if (blockGroups.length === 0) return { kind: 'no-overburdened' }

  // Block groups spill past the municipal line, and a block group mapped only on
  // its far side would look unmapped if the flood query stopped at that line, so
  // the search area is the block groups' own extent, not the town's (D14).
  let searchArea: Extent | null = null
  for (const part of blockGroups) {
    const extent = part.geometry?.extent
    if (!extent) continue
    searchArea = searchArea ? searchArea.union(extent) : extent.clone()
  }

  // Unfiltered: a block group FEMA has not mapped and one FEMA maps outside the
  // hazard area both draw nothing, and only the SFHA_TF value separates them.
  const floodZones = await queryAll((start) =>
    floodSublayer.queryFeatures({
      geometry: searchArea ?? municipality,
      where: '1=1',
      outFields: [SOURCES.femaNfhl.fields.sfha],
      returnGeometry: true,
      outSpatialReference: municipality.spatialReference,
      start,
      num: PAGE_SIZE,
    }),
  )

  // A block group straddling a municipal line is stored once per municipality, so
  // the records are block-group parts and are folded back together by GEOID (D13).
  const census = new Map<string, { criterion: string; exposed: boolean; mapped: boolean }>()
  for (const part of blockGroups) {
    const geoid: string = part.attributes[SOURCES.njdepOverburdened.fields.geoid]
    const criterion: string = part.attributes[SOURCES.njdepOverburdened.fields.criterion]

    const geometry = part.geometry
    let touchesFema = false
    let touchesSfha = false
    if (geometry) {
      // The same part is tested against every flood polygon in the town.
      intersectsOperator.accelerateGeometry(geometry)
      for (const zone of floodZones) {
        if (!zone.geometry || !intersectsOperator.execute(geometry, zone.geometry)) continue
        touchesFema = true
        if (zone.attributes[SOURCES.femaNfhl.fields.sfha] === 'T') {
          touchesSfha = true
          break
        }
      }
    }

    const entry = census.get(geoid) ?? { criterion, exposed: false, mapped: false }
    entry.exposed = entry.exposed || touchesSfha
    entry.mapped = entry.mapped || touchesFema
    census.set(geoid, entry)
  }

  const tallies = new Map<string, CriterionTally>()
  let exposed = 0
  let unmapped = 0
  for (const { criterion, exposed: isExposed, mapped } of census.values()) {
    const tally = tallies.get(criterion) ?? {
      criterion,
      exposed: 0,
      outsideSfha: 0,
      unmapped: 0,
      total: 0,
    }
    tally.total += 1
    if (isExposed) {
      tally.exposed += 1
      exposed += 1
    } else if (mapped) {
      tally.outsideSfha += 1
    } else {
      tally.unmapped += 1
      unmapped += 1
    }
    tallies.set(criterion, tally)
  }

  if (unmapped === census.size) return { kind: 'unmapped', blockGroups: census.size }

  return {
    kind: 'summary',
    blockGroups: census.size,
    mapped: census.size - unmapped,
    exposed,
    unmapped,
    byCriterion: [...tallies.values()].sort((a, b) => b.total - a.total),
  }
}
