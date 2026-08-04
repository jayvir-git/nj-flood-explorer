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
  | {
      kind: 'selected'
      name: string
      county: string
      munCode: string
      geometry: Polygon
    }
  | { kind: 'error' }

export type ExposureState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ready'; result: ExposureResult }
  | { kind: 'error' }

export type TownOption = {
  name: string
  county: string
  munCode: string
}

type Layers = {
  flood: ReturnType<typeof createFloodZoneLayer>
  ej: ReturnType<typeof createOverburdenedLayer>
  muni: ReturnType<typeof createMunicipalityLayer>
  selection: ReturnType<typeof createSelectionLayer>
}

const NAME = SOURCES.njMunicipalities.fields.name
const COUNTY = SOURCES.njMunicipalities.fields.county
const MUN_CODE = SOURCES.njMunicipalities.fields.munCode

export function NjMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<MapView | null>(null)
  const layersRef = useRef<Layers | null>(null)
  const destroyTimer = useRef<number | undefined>(undefined)
  const pickTownRef = useRef<(munCode: string | null) => void>(() => {})
  const latestSelect = useRef(0)

  const [visibility, setVisibility] = useState<Record<LayerKey, boolean>>({
    flood: true,
    ej: true,
    muni: true,
  })
  const [floodStatus, setFloodStatus] = useState<FloodStatus>('checking')
  const [selection, setSelection] = useState<SelectionState>({ kind: 'idle' })
  const [exposure, setExposure] = useState<ExposureState>({ kind: 'idle' })
  const [aboutOpen, setAboutOpen] = useState(false)
  const [towns, setTowns] = useState<TownOption[]>([])

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
    let latestFlood = 0

    async function loadTownList() {
      try {
        const { features } = await municipalities.queryFeatures({
          where: '1=1',
          outFields: [NAME, COUNTY, MUN_CODE],
          returnGeometry: false,
          orderByFields: [NAME],
          num: 2000,
        })
        setTowns(
          features.map((feature) => ({
            name: feature.attributes[NAME] as string,
            county: feature.attributes[COUNTY] as string,
            munCode: feature.attributes[MUN_CODE] as string,
          })),
        )
      } catch {
        setTowns([])
      }
    }

    async function finishSelection(feature: Graphic, token: number) {
      const geometry = feature.geometry as Polygon
      highlight.removeAll()
      highlight.addMany(SELECTION_SYMBOLS.map((symbol) => new Graphic({ geometry, symbol })))
      setSelection({
        kind: 'selected',
        name: feature.attributes[NAME],
        county: feature.attributes[COUNTY],
        munCode: feature.attributes[MUN_CODE],
        geometry,
      })

      setExposure({ kind: 'pending' })
      try {
        const sublayer = flood.findSublayerById(SOURCES.femaNfhl.floodHazardZonesLayerId)
        if (!sublayer) throw new Error('flood sublayer missing')
        const result = await analyzeExposure(geometry, overburdened, sublayer)
        if (token === latestSelect.current) setExposure({ kind: 'ready', result })
      } catch {
        if (token === latestSelect.current) setExposure({ kind: 'error' })
      }
    }

    async function selectMunicipalityAt(point: Point) {
      const token = ++latestSelect.current
      setSelection({ kind: 'pending' })
      setExposure({ kind: 'idle' })

      try {
        const { features } = await municipalities.queryFeatures({
          geometry: point,
          spatialRelationship: 'intersects',
          returnGeometry: true,
          outFields: [NAME, COUNTY, MUN_CODE],
          outSpatialReference: settledView.spatialReference,
        })
        if (token !== latestSelect.current) return
        // Shared-boundary clicks: first result wins (D11).
        const feature = features[0]
        if (!feature) {
          highlight.removeAll()
          setSelection({ kind: 'idle' })
          return
        }
        await finishSelection(feature, token)
      } catch {
        if (token !== latestSelect.current) return
        highlight.removeAll()
        setSelection({ kind: 'error' })
      }
    }

    async function selectMunicipalityByCode(munCode: string | null) {
      const token = ++latestSelect.current
      if (!munCode) {
        highlight.removeAll()
        setSelection({ kind: 'idle' })
        setExposure({ kind: 'idle' })
        return
      }

      setSelection({ kind: 'pending' })
      setExposure({ kind: 'idle' })

      try {
        const escaped = munCode.replace(/'/g, "''")
        const { features } = await municipalities.queryFeatures({
          where: `${MUN_CODE} = '${escaped}'`,
          returnGeometry: true,
          outFields: [NAME, COUNTY, MUN_CODE],
          outSpatialReference: settledView.spatialReference,
        })
        if (token !== latestSelect.current) return
        const feature = features[0]
        if (!feature) {
          highlight.removeAll()
          setSelection({ kind: 'idle' })
          return
        }
        await finishSelection(feature, token)
      } catch {
        if (token !== latestSelect.current) return
        highlight.removeAll()
        setSelection({ kind: 'error' })
      }
    }

    pickTownRef.current = (munCode) => {
      void selectMunicipalityByCode(munCode)
    }

    void loadTownList()

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
          setFloodStatus('zoomed-out')
          return
        }
        setFloodStatus('checking')
        const inSfha = await sublayer.queryFeatureCount({
          geometry: extent,
          where: `${SOURCES.femaNfhl.fields.sfha} = 'T'`,
        })
        if (token !== latestFlood) return
        if (inSfha > 0) {
          setFloodStatus('ok')
          return
        }
        const anyZone = await sublayer.queryFeatureCount({ geometry: extent })
        if (token === latestFlood) setFloodStatus(anyZone > 0 ? 'outside-sfha' : 'unmapped')
      } catch {
        if (token === latestFlood) setFloodStatus('error')
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

  // Map area first in the DOM so layer toggles precede the town picker in tab
  // order; CSS order keeps the side panel on the left.
  return (
    <div className="map-shell">
      <div className="map-area">
        <div className="map" ref={containerRef} />
        <LayerPanel
          visibility={visibility}
          onToggle={(key) => setVisibility((current) => ({ ...current, [key]: !current[key] }))}
          floodStatus={floodStatus}
        />
      </div>
      <TownPanel
        selection={selection}
        exposure={exposure}
        towns={towns}
        aboutOpen={aboutOpen}
        onOpenAbout={() => setAboutOpen(true)}
        onCloseAbout={() => setAboutOpen(false)}
        onPickTown={(munCode) => pickTownRef.current(munCode)}
      />
    </div>
  )
}
