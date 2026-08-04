import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js'
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer.js'
import MapImageLayer from '@arcgis/core/layers/MapImageLayer.js'
import Sublayer from '@arcgis/core/layers/support/Sublayer.js'
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer.js'
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer.js'
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js'
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol.js'
import { SOURCES } from './config/sources'
import {
  EJ_CRITERIA,
  FLOOD_MIN_SCALE,
  MUNICIPALITY_OUTLINE,
} from './legend'

export {
  EJ_CRITERIA,
  EJ_LEGEND_GROUPS,
  FLOOD_CLASSES,
  FLOOD_MIN_SCALE,
  MUNICIPALITY_OUTLINE,
} from './legend'

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
