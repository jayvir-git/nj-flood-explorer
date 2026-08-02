import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js'
import MapImageLayer from '@arcgis/core/layers/MapImageLayer.js'
import Sublayer from '@arcgis/core/layers/support/Sublayer.js'
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer.js'
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer.js'
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js'
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol.js'
import { SOURCES } from './config/sources'

/** The minScale FEMA publishes on layer 28. Above it the service draws nothing. */
export const FLOOD_MIN_SCALE = 36111.909643

// The six values of OVERBURDENED_COMMUNITY_CRITERI, read from the live service.
// Cyan is reserved for the FEMA flood zones drawn on top of this fill.
export const EJ_CRITERIA: ReadonlyArray<readonly [string, string]> = [
  ['Low Income', '#e6ab02'],
  ['Minority', '#7570b3'],
  ['Low Income and Limited English', '#e7298a'],
  ['Low Income and Minority', '#d95f02'],
  ['Minority and Limited English', '#66a61e'],
  ['Low Income, Minority, and Limited English', '#a6761d'],
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
