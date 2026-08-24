import { Suspense, lazy, useEffect, useRef } from 'react'
import { exposureSummarySentence } from '../exposure'
import { AboutData } from './AboutData'
import type { ExposureState, SelectionState, TownOption } from './NjMap'

const ExposureSummary = lazy(() =>
  import('./ExposureSummary').then((module) => ({ default: module.ExposureSummary })),
)

// COUNTY comes back upper case from the service; NAME does not.
function titleCase(value: string) {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

type Props = {
  selection: SelectionState
  exposure: ExposureState
  towns: TownOption[]
  aboutOpen: boolean
  onOpenAbout: () => void
  onCloseAbout: () => void
  onPickTown: (munCode: string | null) => void
}

export function TownPanel({
  selection,
  exposure,
  towns,
  aboutOpen,
  onOpenAbout,
  onCloseAbout,
  onPickTown,
}: Props) {
  const panelAboutRef = useRef<HTMLButtonElement>(null)
  const wasAboutOpen = useRef(false)

  useEffect(() => {
    if (wasAboutOpen.current && !aboutOpen) {
      panelAboutRef.current?.focus()
    }
    wasAboutOpen.current = aboutOpen
  }, [aboutOpen])

  const selectedCode = selection.kind === 'selected' ? selection.munCode : ''
  const townName =
    selection.kind === 'selected' || selection.kind === 'pending' ? selection.name : undefined
  const statusText = townStatusText(selection, exposure, townName)
  const statusIsAnnouncementOnly = exposure.kind === 'ready' && selection.kind === 'selected'

  return (
    <aside className="town-panel" aria-label="NJ Flood Exposure Explorer">
      <h1 className="app-title">NJ Flood Exposure Explorer</h1>
      {aboutOpen ? (
        <AboutData onClose={onCloseAbout} />
      ) : (
        <>
          <div className="town-picker">
            <label htmlFor="town-select">Town</label>
            <select
              id="town-select"
              value={selectedCode}
              disabled={towns.length === 0}
              onChange={(event) => onPickTown(event.target.value || null)}
            >
              <option value="">Choose a town…</option>
              {towns.map((town) => (
                <option key={town.munCode} value={town.munCode}>
                  {town.name} ({titleCase(town.county)})
                </option>
              ))}
            </select>
          </div>

          <div
            className={statusIsAnnouncementOnly ? 'town-status sr-only' : 'town-status'}
            aria-live="polite"
          >
            {statusText}
          </div>

          {selection.kind === 'idle' && !statusText && (
            <p className="town-prompt">Choose a town from the list, or click it on the map.</p>
          )}

          {selection.kind === 'selected' && (
            <>
              <h2 className="town-name">{selection.name}</h2>
              <p className="town-county">{titleCase(selection.county)} County</p>
              {exposure.kind === 'ready' && (
                <Suspense fallback={<p className="town-status">Loading summary…</p>}>
                  <ExposureSummary town={selection.name} exposure={exposure.result} />
                </Suspense>
              )}
            </>
          )}

          <p className="town-about">
            <button
              type="button"
              className="text-button"
              ref={panelAboutRef}
              onClick={onOpenAbout}
            >
              About the data
            </button>
          </p>
        </>
      )}
    </aside>
  )
}

function townStatusText(
  selection: SelectionState,
  exposure: ExposureState,
  townName: string | undefined,
): string {
  if (selection.kind === 'error') {
    return 'The town-boundary service is not responding. Choose another town, or try again.'
  }
  if (exposure.kind === 'error') {
    return 'Exposure figures could not be calculated. A data service did not answer. Choose another town, or try this one again.'
  }
  if (exposure.kind === 'ready' && selection.kind === 'selected') {
    const sentence = exposureSummarySentence(selection.name, exposure.result)
    if (exposure.result.kind === 'no-overburdened' || exposure.result.kind === 'unmapped') {
      return `${sentence} Choose another town.`
    }
    return sentence
  }
  if (townName && (selection.kind === 'pending' || selection.kind === 'selected')) {
    return `Loading flood exposure summary for ${townName}.`
  }
  return ''
}
