import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import type { ExposureResult } from '../exposure'
import { fetchTownByCode, fetchTownList, type TownGeometry, type TownOption } from '../towns'
import { LayerPanel } from './LayerPanel'
import { TownPanel } from './TownPanel'

const MapStage = lazy(() => import('./MapStage'))

export type LayerKey = 'flood' | 'ej' | 'muni'
export type FloodStatus =
  | 'checking'
  | 'ok'
  | 'zoomed-out'
  | 'outside-sfha'
  | 'unmapped'
  | 'error'
  | 'loading-map'

export type SelectionState =
  | { kind: 'idle' }
  | { kind: 'pending'; name?: string }
  | {
      kind: 'selected'
      name: string
      county: string
      munCode: string
      geometry: TownGeometry
    }
  | { kind: 'error' }

export type ExposureState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'ready'; result: ExposureResult }
  | { kind: 'error' }

export type { TownOption }

export function NjMap() {
  const [visibility, setVisibility] = useState<Record<LayerKey, boolean>>({
    flood: true,
    ej: true,
    muni: true,
  })
  const [floodStatus, setFloodStatus] = useState<FloodStatus>('loading-map')
  const [selection, setSelection] = useState<SelectionState>({ kind: 'idle' })
  const [exposure, setExposure] = useState<ExposureState>({ kind: 'idle' })
  const [aboutOpen, setAboutOpen] = useState(false)
  const [towns, setTowns] = useState<TownOption[]>([])
  // Start the ArcGIS chunk after the shell's first paint so it does not race FCP.
  const [mapRequested, setMapRequested] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchTownList()
      .then((list) => {
        if (!cancelled) setTowns(list)
      })
      .catch(() => {
        if (!cancelled) setTowns([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMapRequested(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const onPickTown = useCallback(async (munCode: string | null) => {
    if (!munCode) {
      setSelection({ kind: 'idle' })
      setExposure({ kind: 'idle' })
      return
    }
    setSelection({
      kind: 'pending',
      name: towns.find((town) => town.munCode === munCode)?.name,
    })
    setExposure({ kind: 'idle' })
    try {
      const town = await fetchTownByCode(munCode)
      setSelection({
        kind: 'selected',
        name: town.name,
        county: town.county,
        munCode: town.munCode,
        geometry: town.geometry,
      })
    } catch {
      setSelection({ kind: 'error' })
    }
  }, [towns])

  const onSelectionChange = useCallback((next: SelectionState) => {
    setSelection(next)
  }, [])

  const onExposureChange = useCallback((next: ExposureState) => {
    setExposure(next)
  }, [])

  const onFloodStatusChange = useCallback((status: FloodStatus) => {
    setFloodStatus(status)
  }, [])

  return (
    <div className="map-shell">
      <main className="map-area" aria-label="Map">
        {mapRequested ? (
          <Suspense
            fallback={<div className="map map-placeholder">Loading map&hellip;</div>}
          >
            <MapStage
              visibility={visibility}
              selection={selection}
              onSelectionChange={onSelectionChange}
              onExposureChange={onExposureChange}
              onFloodStatusChange={onFloodStatusChange}
            />
          </Suspense>
        ) : (
          <div className="map map-placeholder">Loading map&hellip;</div>
        )}
        <LayerPanel
          visibility={visibility}
          onToggle={(key) => setVisibility((current) => ({ ...current, [key]: !current[key] }))}
          floodStatus={floodStatus}
        />
      </main>
      <TownPanel
        selection={selection}
        exposure={exposure}
        towns={towns}
        aboutOpen={aboutOpen}
        onOpenAbout={() => setAboutOpen(true)}
        onCloseAbout={() => setAboutOpen(false)}
        onPickTown={(munCode) => {
          void onPickTown(munCode)
        }}
      />
    </div>
  )
}
