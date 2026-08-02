import { useEffect, useRef } from 'react'
import EsriMap from '@arcgis/core/Map.js'
import MapView from '@arcgis/core/views/MapView.js'
import '@arcgis/core/assets/esri/themes/light/main.css'
import {
  createFloodZoneLayer,
  createMunicipalityLayer,
  createOverburdenedLayer,
} from '../layers'

const NJ_CENTER: [number, number] = [-74.55, 40.07]
const NJ_ZOOM = 8

export function NjMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<MapView | null>(null)
  const destroyTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    window.clearTimeout(destroyTimer.current)
    viewRef.current ??= new MapView({
      container,
      map: new EsriMap({
        basemap: 'gray-vector',
        layers: [
          createOverburdenedLayer(),
          createFloodZoneLayer(),
          createMunicipalityLayer(),
        ],
      }),
      center: NJ_CENTER,
      zoom: NJ_ZOOM,
    })

    return () => {
      // StrictMode remounts immediately after cleanup; destroying the view here
      // aborts the basemap request in flight, so defer past a possible remount.
      destroyTimer.current = window.setTimeout(() => {
        viewRef.current?.destroy()
        viewRef.current = null
      })
    }
  }, [])

  return <div className="map" ref={containerRef} />
}
