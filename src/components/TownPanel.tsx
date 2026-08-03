import type { SelectionState } from './NjMap'

// COUNTY comes back upper case from the service; NAME does not.
function titleCase(value: string) {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

export function TownPanel({ selection }: { selection: SelectionState }) {
  return (
    <aside className="town-panel" aria-live="polite">
      {selection.kind === 'idle' && (
        <p className="town-prompt">Click any municipality to see who it is.</p>
      )}
      {selection.kind === 'pending' && <p className="town-prompt">Looking up&hellip;</p>}
      {selection.kind === 'error' && (
        <p className="town-prompt warning">
          The municipal boundary service is not responding.
        </p>
      )}
      {selection.kind === 'selected' && (
        <>
          <h2 className="town-name">{selection.name}</h2>
          <p className="town-county">{titleCase(selection.county)} County</p>
        </>
      )}
    </aside>
  )
}
