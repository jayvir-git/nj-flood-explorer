import { useEffect, useRef, useState } from 'react'
import EsriMap from '@arcgis/core/Map.js'
import MapView from '@arcgis/core/views/MapView.js'
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils.js'
import '@arcgis/core/assets/esri/themes/light/main.css'
import { SOURCES } from '../config/sources'
import {
  FLOOD_MIN_SCALE,
  createFloodZoneLayer,
  createMunicipalityLayer,
  createOverburdenedLayer,
} from '../layers'
import { LayerPanel } from './LayerPanel'

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

type Layers = {
  flood: ReturnType<typeof createFloodZoneLayer>
  ej: ReturnType<typeof createOverburdenedLayer>
  muni: ReturnType<typeof createMunicipalityLayer>
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
      }
      view = new MapView({
        container,
        map: new EsriMap({
          basemap: 'gray-vector',
          layers: [layers.ej, layers.flood, layers.muni],
        }),
        center: NJ_CENTER,
        zoom: NJ_ZOOM,
      })
      viewRef.current = view
      layersRef.current = layers
    }

    const settledView = view
    const flood = layers.flood
    let latest = 0

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

    return () => {
      handle.remove()
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
      <div className="map" ref={containerRef} />
      <LayerPanel
        visibility={visibility}
        onToggle={(key) => setVisibility((current) => ({ ...current, [key]: !current[key] }))}
        floodStatus={floodStatus}
      />
    </div>
  )
}
