import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js'
import MapImageLayer from '@arcgis/core/layers/MapImageLayer.js'
import Sublayer from '@arcgis/core/layers/support/Sublayer.js'
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer.js'
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer.js'
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js'
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol.js'
import { SOURCES } from './config/sources'

/** The minScale FEMA publishes on layer 28. Above it the service draws nothing. */
export const FLOOD_MIN_SCALE = 36111.909643

// Six OVERBURDENED_COMMUNITY_CRITERI values, ordered by how many statutory axes
// they meet (1 → 2 → 3). Cyan/blue withheld so FEMA flood zones stay readable (D8/D16).
export const EJ_CRITERIA: ReadonlyArray<readonly [string, string]> = [
  // 1 criterion — lighter weight, still distinct after 45% opacity over gray-vector
  ['Low Income', '#fd8d3c'],
  ['Minority', '#8073ac'],
  // 2 criteria — mid weight
  ['Low Income and Minority', '#e66101'],
  ['Low Income and Limited English', '#c51b7d'],
  ['Minority and Limited English', '#4d9221'],
  // 3 criteria — heaviest
  ['Low Income, Minority, and Limited English', '#542788'],
]

// FEMA's own labels and colours, from layer 28's drawingInfo. These are the only
// two classes its renderer draws for the zone/subtype combinations that exist in
// New Jersey inside the SFHA filter; floodways are red, everything else cyan.
export const FLOOD_CLASSES: ReadonlyArray<readonly [string, string]> = [
  ['1% Annual Chance Flood Hazard', '#00e6ff'],
  ['Regulatory Floodway', '#ff0000'],
]

export const MUNICIPALITY_OUTLINE = '#4a4a4a'

export function createOverburdenedLayer() {
  return new FeatureLayer({
    url: SOURCES.njdepOverburdened.url,
    title: 'Overburdened communities',
    opacity: 0.45,
    renderer: new UniqueValueRenderer({
      field: SOURCES.njdepOverburdened.fields.criterion,
      uniqueValueInfos: EJ_CRITERIA.map(([value, color]) => ({
        value,
        label: value,
        symbol: new SimpleFillSymbol({
          color,
          outline: new SimpleLineSymbol({ color: [255, 255, 255, 0.4], width: 0.3 }),
        }),
      })),
    }),
  })
}

export function createFloodZoneLayer() {
  return new MapImageLayer({
    url: SOURCES.femaNfhl.url,
    title: 'FEMA flood hazard zones',
    opacity: 0.65,
    sublayers: [
      new Sublayer({
        id: SOURCES.femaNfhl.floodHazardZonesLayerId,
        title: 'Special Flood Hazard Area',
        definitionExpression: `${SOURCES.femaNfhl.fields.sfha} = 'T'`,
        // Mirrors the service limit so no pointless blank image is requested.
        minScale: FLOOD_MIN_SCALE,
      }),
    ],
  })
}

// White beneath near-black: the selected outline has to read over the EJ fill, the
// flood zones and the basemap without taking a hue from any of them.
export const SELECTION_SYMBOLS = [
  new SimpleFillSymbol({
    color: [0, 0, 0, 0],
    outline: new SimpleLineSymbol({ color: '#ffffff', width: 5 }),
  }),
  new SimpleFillSymbol({
    color: [0, 0, 0, 0],
    outline: new SimpleLineSymbol({ color: '#111111', width: 2 }),
  }),
]

export function createSelectionLayer() {
  return new GraphicsLayer({ title: 'Selected municipality', listMode: 'hide' })
}

export function createMunicipalityLayer() {
  return new FeatureLayer({
    url: SOURCES.njMunicipalities.url,
    title: 'Municipal boundaries',
    renderer: new SimpleRenderer({
      symbol: new SimpleFillSymbol({
        color: [0, 0, 0, 0],
        outline: new SimpleLineSymbol({ color: MUNICIPALITY_OUTLINE, width: 0.8 }),
      }),
    }),
  })
}
