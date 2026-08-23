import { useEffect, useRef, useState } from 'react'
import EsriMap from '@arcgis/core/Map.js'
import Graphic from '@arcgis/core/Graphic.js'
import Polygon from '@arcgis/core/geometry/Polygon.js'
import type Point from '@arcgis/core/geometry/Point.js'
import type PolygonType from '@arcgis/core/geometry/Polygon.js'
import MapView from '@arcgis/core/views/MapView.js'
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js'
import '@arcgis/core/assets/esri/themes/light/main.css'
import { SOURCES } from '../config/sources'
import { analyzeExposure } from '../exposure'
import {
  FLOOD_MIN_SCALE,
  SELECTION_SYMBOLS,
  createFloodZoneLayer,
  createMunicipalityLayer,
  createOverburdenedLayer,
  createSelectionLayer,
} from '../layers'
import type { ExposureState, FloodStatus, LayerKey, SelectionState } from './NjMap'

const NJ_CENTER: [number, number] = [-74.55, 40.07]
const NJ_ZOOM = 8

const NAME = SOURCES.njMunicipalities.fields.name
const COUNTY = SOURCES.njMunicipalities.fields.county
const MUN_CODE = SOURCES.njMunicipalities.fields.munCode

type Layers = {
  flood: ReturnType<typeof createFloodZoneLayer>
  ej: ReturnType<typeof createOverburdenedLayer>
  muni: ReturnType<typeof createMunicipalityLayer>
  selection: ReturnType<typeof createSelectionLayer>
}

type Props = {
  visibility: Record<LayerKey, boolean>
  selection: SelectionState
  onSelectionChange: (selection: SelectionState) => void
  onExposureChange: (exposure: ExposureState) => void
  onFloodStatusChange: (status: FloodStatus) => void
}

export default function MapStage({
  visibility,
  selection,
  onSelectionChange,
  onExposureChange,
  onFloodStatusChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<MapView | null>(null)
  const layersRef = useRef<Layers | null>(null)
  const destroyTimer = useRef<number | undefined>(undefined)
  const latestSelect = useRef(0)
  const selectionKey = useRef<string | null>(null)
  const exposedFor = useRef<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    window.clearTimeout(destroyTimer.current)

    let view = viewRef.current
    let layers = layersRef.current
    if (!view || !layers) {
      layers = {
        ej: createOverburdenedLayer(),
        flood: createFloodZoneLayer(),
        muni: createMunicipalityLayer(),
        selection: createSelectionLayer(),
      }
      view = new MapView({
        container,
        map: new EsriMap({
          basemap: 'gray-vector',
          layers: [layers.ej, layers.flood, layers.muni, layers.selection],
        }),
        center: NJ_CENTER,
        zoom: NJ_ZOOM,
        aria: {
          label: 'Map of New Jersey flood hazard zones and overburdened communities',
        },
      })
      viewRef.current = view
      layersRef.current = layers
    }
    setMapReady(true)

    const settledView = view
    const flood = layers.flood
    const municipalities = layers.muni
    const highlight = layers.selection
    let latestFlood = 0

    async function selectAtPoint(mapPoint: Point) {
      const token = ++latestSelect.current
      exposedFor.current = null
      onSelectionChange({ kind: 'pending' })
      onExposureChange({ kind: 'idle' })
      try {
        const { features } = await municipalities.queryFeatures({
          geometry: mapPoint,
          spatialRelationship: 'intersects',
          returnGeometry: true,
          outFields: [NAME, COUNTY, MUN_CODE],
          outSpatialReference: settledView.spatialReference,
        })
        if (token !== latestSelect.current) return
        const feature = features[0]
        if (!feature?.geometry) {
          highlight.removeAll()
          selectionKey.current = null
          onSelectionChange({ kind: 'idle' })
          return
        }
        const geometry = feature.geometry as PolygonType
        selectionKey.current = feature.attributes[MUN_CODE]
        highlight.removeAll()
        highlight.addMany(SELECTION_SYMBOLS.map((symbol) => new Graphic({ geometry, symbol })))
        onSelectionChange({
          kind: 'selected',
          name: feature.attributes[NAME],
          county: feature.attributes[COUNTY],
          munCode: feature.attributes[MUN_CODE],
          geometry: {
            rings: geometry.rings as number[][][],
            spatialReference: { wkid: geometry.spatialReference.wkid ?? 102100 },
          },
        })
      } catch {
        if (token !== latestSelect.current) return
        highlight.removeAll()
        selectionKey.current = null
        onSelectionChange({ kind: 'error' })
      }
    }

    async function describeFloodLayer() {
      const token = ++latestFlood
      const extent = settledView.extent
      if (!extent) return
      try {
        await flood.load()
        const sublayer = flood.findSublayerById(SOURCES.femaNfhl.floodHazardZonesLayerId)
        if (!sublayer) throw new Error('flood sublayer missing')
        if (token !== latestFlood) return
        if (settledView.scale > FLOOD_MIN_SCALE) {
          onFloodStatusChange('zoomed-out')
          return
        }
        onFloodStatusChange('checking')
        const inSfha = await sublayer.queryFeatureCount({
          geometry: extent,
          where: `${SOURCES.femaNfhl.fields.sfha} = 'T'`,
        })
        if (token !== latestFlood) return
        if (inSfha > 0) {
          onFloodStatusChange('ok')
          return
        }
        const anyZone = await sublayer.queryFeatureCount({ geometry: extent })
        if (token === latestFlood) onFloodStatusChange(anyZone > 0 ? 'outside-sfha' : 'unmapped')
      } catch {
        if (token === latestFlood) onFloodStatusChange('error')
      }
    }

    const handle = reactiveUtils.watch(
      () => settledView.stationary,
      (stationary) => {
        if (stationary) void describeFloodLayer()
      },
      { initial: true },
    )

    const clickHandle = settledView.on('click', (event) => {
      void selectAtPoint(event.mapPoint)
    })

    return () => {
      handle.remove()
      clickHandle.remove()
      destroyTimer.current = window.setTimeout(() => {
        viewRef.current?.destroy()
        viewRef.current = null
        layersRef.current = null
      })
    }
  }, [onExposureChange, onFloodStatusChange, onSelectionChange])

  useEffect(() => {
    const layers = layersRef.current
    if (!layers) return
    layers.flood.visible = visibility.flood
    layers.ej.visible = visibility.ej
    layers.muni.visible = visibility.muni
  }, [visibility])

  useEffect(() => {
    const layers = layersRef.current
    if (!mapReady || !layers) return

    if (selection.kind === 'idle') {
      layers.selection.removeAll()
      selectionKey.current = null
      exposedFor.current = null
      return
    }
    if (selection.kind !== 'selected') return
    if (exposedFor.current === selection.munCode) return

    if (selectionKey.current !== selection.munCode) {
      selectionKey.current = selection.munCode
      const geometry = Polygon.fromJSON(selection.geometry)
      layers.selection.removeAll()
      layers.selection.addMany(
        SELECTION_SYMBOLS.map((symbol) => new Graphic({ geometry, symbol })),
      )
    }

    const token = ++latestSelect.current
    const munCode = selection.munCode
    onExposureChange({ kind: 'pending' })
    const geometry = Polygon.fromJSON(selection.geometry)

    void (async () => {
      try {
        const sublayer = layers.flood.findSublayerById(SOURCES.femaNfhl.floodHazardZonesLayerId)
        if (!sublayer) throw new Error('flood sublayer missing')
        const result = await analyzeExposure(geometry, layers.ej, sublayer)
        if (token === latestSelect.current) {
          exposedFor.current = munCode
          onExposureChange({ kind: 'ready', result })
        }
      } catch {
        if (token === latestSelect.current) onExposureChange({ kind: 'error' })
      }
    })()
  }, [selection, onExposureChange, mapReady])

  return <div className="map" ref={containerRef} />
}
