import { useEffect, useRef, useState } from 'react'
import EsriMap from '@arcgis/core/Map.js'
import Graphic from '@arcgis/core/Graphic.js'
import MapView from '@arcgis/core/views/MapView.js'
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js'
import type Point from '@arcgis/core/geometry/Point.js'
import type Polygon from '@arcgis/core/geometry/Polygon.js'
import '@arcgis/core/assets/esri/themes/light/main.css'
import { SOURCES } from '../config/sources'
import { analyzeExposure, type ExposureResult } from '../exposure'
import {
  FLOOD_MIN_SCALE,
  SELECTION_SYMBOLS,
  createFloodZoneLayer,
  createMunicipalityLayer,
  createOverburdenedLayer,
  createSelectionLayer,
} from '../layers'
import { LayerPanel } from './LayerPanel'
import { TownPanel } from './TownPanel'

const NJ_CENTER: [number, number] = [-74.55, 40.07]
const NJ_ZOOM = 8

export type LayerKey = 'flood' | 'ej' | 'muni'
export type FloodStatus =
  | 'checking'
  | 'ok'
  | 'zoomed-out'
  | 'outside-sfha'
  | 'unmapped'
  | 'error'

/** The selected municipality's geometry is kept as returned; S6 queries against it. */
export type SelectionState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'selected'; name: string; county: string; geometry: Polygon }
  | { kind: 'error' }

export type ExposureState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ready'; result: ExposureResult }
  | { kind: 'error' }

type Layers = {
  flood: ReturnType<typeof createFloodZoneLayer>
  ej: ReturnType<typeof createOverburdenedLayer>
  muni: ReturnType<typeof createMunicipalityLayer>
  selection: ReturnType<typeof createSelectionLayer>
}

export function NjMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<MapView | null>(null)
  const layersRef = useRef<Layers | null>(null)
  const destroyTimer = useRef<number | undefined>(undefined)

  const [visibility, setVisibility] = useState<Record<LayerKey, boolean>>({
    flood: true,
    ej: true,
    muni: true,
  })
  const [floodStatus, setFloodStatus] = useState<FloodStatus>('checking')
  const [selection, setSelection] = useState<SelectionState>({ kind: 'idle' })
  const [exposure, setExposure] = useState<ExposureState>({ kind: 'idle' })
  const [aboutOpen, setAboutOpen] = useState(false)

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
      })
      viewRef.current = view
      layersRef.current = layers
    }

    const settledView = view
    const flood = layers.flood
    const municipalities = layers.muni
    const overburdened = layers.ej
    const highlight = layers.selection
    let latest = 0
    let latestClick = 0

    async function selectMunicipalityAt(point: Point) {
      const token = ++latestClick
      setSelection({ kind: 'pending' })
      setExposure({ kind: 'idle' })

      let feature
      try {
        const { features } = await municipalities.queryFeatures({
          geometry: point,
          spatialRelationship: 'intersects',
          returnGeometry: true,
          outFields: [
            SOURCES.njMunicipalities.fields.name,
            SOURCES.njMunicipalities.fields.county,
          ],
          outSpatialReference: settledView.spatialReference,
        })
        if (token !== latestClick) return
        // A click on a shared boundary intersects both municipalities, and nothing
        // in the click favours either, so the service's first result wins (D11).
        feature = features[0]
      } catch {
        if (token !== latestClick) return
        highlight.removeAll()
        setSelection({ kind: 'error' })
        return
      }

      highlight.removeAll()
      if (!feature) {
        setSelection({ kind: 'idle' })
        return
      }

      const geometry = feature.geometry as Polygon
      highlight.addMany(SELECTION_SYMBOLS.map((symbol) => new Graphic({ geometry, symbol })))
      setSelection({
        kind: 'selected',
        name: feature.attributes[SOURCES.njMunicipalities.fields.name],
        county: feature.attributes[SOURCES.njMunicipalities.fields.county],
        geometry,
      })

      setExposure({ kind: 'pending' })
      try {
        const sublayer = flood.findSublayerById(SOURCES.femaNfhl.floodHazardZonesLayerId)
        if (!sublayer) throw new Error('flood sublayer missing')
        const result = await analyzeExposure(geometry, overburdened, sublayer)
        if (token === latestClick) setExposure({ kind: 'ready', result })
      } catch {
        if (token === latestClick) setExposure({ kind: 'error' })
      }
    }

    async function describeFloodLayer() {
      const token = ++latest
      const extent = settledView.extent
      if (!extent) return
      try {
        // Load first: a dead service outranks "zoom in" as an explanation.
        await flood.load()
        const sublayer = flood.findSublayerById(SOURCES.femaNfhl.floodHazardZonesLayerId)
        if (!sublayer) throw new Error('flood sublayer missing')
        if (token !== latest) return
        if (settledView.scale > FLOOD_MIN_SCALE) {
          setFloodStatus('zoomed-out')
          return
        }
        setFloodStatus('checking')
        const inSfha = await sublayer.queryFeatureCount({
          geometry: extent,
          where: `${SOURCES.femaNfhl.fields.sfha} = 'T'`,
        })
        if (token !== latest) return
        if (inSfha > 0) {
          setFloodStatus('ok')
          return
        }
        // Nothing drawn. Distinguish ground FEMA mapped and placed outside the
        // hazard area from ground FEMA has not mapped at all.
        const anyZone = await sublayer.queryFeatureCount({ geometry: extent })
        if (token === latest) setFloodStatus(anyZone > 0 ? 'outside-sfha' : 'unmapped')
      } catch {
        if (token === latest) setFloodStatus('error')
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
      void selectMunicipalityAt(event.mapPoint)
    })

    return () => {
      handle.remove()
      clickHandle.remove()
      // StrictMode remounts immediately after cleanup; destroying the view here
      // aborts the basemap request in flight, so defer past a possible remount.
      destroyTimer.current = window.setTimeout(() => {
        viewRef.current?.destroy()
        viewRef.current = null
        layersRef.current = null
      })
    }
  }, [])

  useEffect(() => {
    const layers = layersRef.current
    if (!layers) return
    layers.flood.visible = visibility.flood
    layers.ej.visible = visibility.ej
    layers.muni.visible = visibility.muni
  }, [visibility])

  return (
    <div className="map-shell">
      <TownPanel
        selection={selection}
        exposure={exposure}
        aboutOpen={aboutOpen}
        onOpenAbout={() => setAboutOpen(true)}
        onCloseAbout={() => setAboutOpen(false)}
      />
      <div className="map-area">
        <div className="map" ref={containerRef} />
        <LayerPanel
          visibility={visibility}
          onToggle={(key) => setVisibility((current) => ({ ...current, [key]: !current[key] }))}
          floodStatus={floodStatus}
        />
      </div>
    </div>
  )
}
