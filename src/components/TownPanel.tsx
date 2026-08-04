import { AboutData } from './AboutData'
import { ExposureSummary } from './ExposureSummary'
import type { ExposureState, SelectionState, TownOption } from './NjMap'

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
  if (aboutOpen) {
    return (
      <aside className="town-panel" aria-label="About the data">
        <AboutData onClose={onCloseAbout} />
      </aside>
    )
  }

  const selectedCode = selection.kind === 'selected' ? selection.munCode : ''
  const statusText =
    selection.kind === 'pending'
      ? 'Looking up town…'
      : selection.kind === 'error'
        ? 'The town-boundary service is not responding.'
        : exposure.kind === 'pending'
          ? 'Looking up flood exposure…'
          : exposure.kind === 'error'
            ? 'Exposure figures could not be calculated. A data service did not answer.'
            : ''

  return (
    <aside className="town-panel" aria-label="Town flood exposure">
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

      <div className="town-status" aria-live="polite">
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
            <ExposureSummary
              town={selection.name}
              exposure={exposure.result}
              onOpenAbout={onOpenAbout}
            />
          )}
        </>
      )}

      <p className="town-about">
        <button type="button" className="text-button" onClick={onOpenAbout}>
          About the data
        </button>
      </p>
    </aside>
  )
}
