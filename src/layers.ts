import FeatureLayer from '@arcgis/core/layers/FeatureLayer.js'
import MapImageLayer from '@arcgis/core/layers/MapImageLayer.js'
import Sublayer from '@arcgis/core/layers/support/Sublayer.js'
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer.js'
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer.js'
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol.js'
import SimpleLineSymbol from '@arcgis/core/symbols/SimpleLineSymbol.js'
import { SOURCES } from './config/sources'

// The six values of OVERBURDENED_COMMUNITY_CRITERI, read from the live service.
// Cyan is reserved for the FEMA flood zones drawn on top of this fill.
const EJ_CRITERIA: ReadonlyArray<readonly [string, string]> = [
  ['Low Income', '#e6ab02'],
  ['Minority', '#7570b3'],
  ['Low Income and Limited English', '#e7298a'],
  ['Low Income and Minority', '#d95f02'],
  ['Minority and Limited English', '#66a61e'],
  ['Low Income, Minority, and Limited English', '#a6761d'],
]

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
  // FEMA publishes layer 28 with minScale 1:36,112, so the service returns an
  // empty image above that scale; the layer appears only at zoom 14 and closer.
  return new MapImageLayer({
    url: SOURCES.femaNfhl.url,
    title: 'FEMA flood hazard zones',
    opacity: 0.65,
    sublayers: [
      new Sublayer({
        id: SOURCES.femaNfhl.floodHazardZonesLayerId,
        title: 'Special Flood Hazard Area',
        definitionExpression: `${SOURCES.femaNfhl.fields.sfha} = 'T'`,
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
        outline: new SimpleLineSymbol({ color: '#4a4a4a', width: 0.8 }),
      }),
    }),
  })
}
