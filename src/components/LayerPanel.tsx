import type { ReactNode } from 'react'
import { EJ_CRITERIA, FLOOD_CLASSES, MUNICIPALITY_OUTLINE } from '../layers'
import type { FloodStatus, LayerKey } from './NjMap'

const FLOOD_MESSAGES: Partial<Record<FloodStatus, string>> = {
  'zoomed-out': 'Zoom in to see flood zones. FEMA publishes them only at 1:36,000 and closer.',
  'outside-sfha': 'FEMA maps this area as outside the Special Flood Hazard Area.',
  unmapped: 'FEMA publishes no flood hazard data here. Blank does not mean safe.',
  error: 'The FEMA flood zone service is not responding.',
}

const FLOOD_WARNINGS = new Set<FloodStatus>(['unmapped', 'error'])

type Props = {
  visibility: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
  floodStatus: FloodStatus
}

export function LayerPanel({ visibility, onToggle, floodStatus }: Props) {
  const floodMessage = FLOOD_MESSAGES[floodStatus]

  return (
    <div className="panel">
      <LayerToggle
        label="Flood hazard zones"
        checked={visibility.flood}
        onChange={() => onToggle('flood')}
      >
        <ul className="swatches">
          {FLOOD_CLASSES.map(([label, color]) => (
            <li key={label}>
              <span className="swatch" style={{ background: color }} />
              {label}
            </li>
          ))}
        </ul>
        <p
          className={FLOOD_WARNINGS.has(floodStatus) ? 'status warning' : 'status'}
          aria-live="polite"
        >
          {floodMessage ?? ''}
        </p>
      </LayerToggle>

      <LayerToggle
        label="Overburdened communities"
        checked={visibility.ej}
        onChange={() => onToggle('ej')}
      >
        <ul className="swatches">
          {EJ_CRITERIA.map(([label, color]) => (
            <li key={label}>
              <span className="swatch" style={{ background: color }} />
              {label}
            </li>
          ))}
        </ul>
      </LayerToggle>

      <LayerToggle
        label="Municipal boundaries"
        checked={visibility.muni}
        onChange={() => onToggle('muni')}
      >
        <ul className="swatches">
          <li>
            <span className="swatch line" style={{ borderColor: MUNICIPALITY_OUTLINE }} />
            Municipality
          </li>
        </ul>
      </LayerToggle>
    </div>
  )
}

type ToggleProps = {
  label: string
  checked: boolean
  onChange: () => void
  children: ReactNode
}

function LayerToggle({ label, checked, onChange, children }: ToggleProps) {
  return (
    <section className="layer">
      <label className="layer-label">
        <input type="checkbox" checked={checked} onChange={onChange} />
        {label}
      </label>
      {checked && children}
    </section>
  )
}
