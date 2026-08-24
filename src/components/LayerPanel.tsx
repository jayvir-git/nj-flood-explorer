import { useEffect, useState, type ReactNode } from 'react'
import {
  EJ_CRITERIA,
  EJ_LEGEND_GROUPS,
  FLOOD_CLASSES,
  MUNICIPALITY_OUTLINE,
} from '../legend'
import { NARROW_MEDIA } from '../layout'
import type { FloodStatus, LayerKey } from './NjMap'

const FLOOD_MESSAGES: Partial<Record<FloodStatus, string>> = {
  'loading-map': 'Loading map…',
  'zoomed-out':
    'Zoom in to see flood zones. FEMA only draws them at neighborhood scale (about 1:36,000 and closer).',
  'outside-sfha':
    'FEMA maps this view as outside the Special Flood Hazard Area (the high-risk flood zones).',
  unmapped: 'FEMA publishes no flood hazard data here. Blank does not mean safe.',
  error: 'The FEMA flood zone service is not responding.',
}

const FLOOD_WARNINGS = new Set<FloodStatus>(['unmapped', 'error'])

const COLOR_BY_CRITERION = new Map(EJ_CRITERIA.map(([value, color]) => [value, color]))

type Props = {
  visibility: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
  floodStatus: FloodStatus
}

export function LayerPanel({ visibility, onToggle, floodStatus }: Props) {
  const narrow = useNarrowViewport()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!narrow) setOpen(false)
  }, [narrow])

  const floodMessage = FLOOD_MESSAGES[floodStatus]
  const statusClass = FLOOD_WARNINGS.has(floodStatus) ? 'status warning' : 'status'
  const layers = (
    <LegendLayers
      visibility={visibility}
      onToggle={onToggle}
      status={
        narrow ? null : (
          <p className={statusClass} aria-live="polite">
            {floodMessage ?? ''}
          </p>
        )
      }
    />
  )

  if (!narrow) {
    return (
      <div className="panel" role="region" aria-label="Map layers">
        {layers}
      </div>
    )
  }

  return (
    <div className="panel">
      <button
        type="button"
        className="legend-toggle"
        aria-expanded={open}
        aria-controls="map-layers"
        onClick={() => setOpen((current) => !current)}
      >
        Map layers
        <span className="legend-toggle-mark" aria-hidden="true">
          {open ? '−' : '+'}
        </span>
      </button>
      <p className={open ? statusClass : `${statusClass} sr-only`} aria-live="polite">
        {floodMessage ?? ''}
      </p>
      <div id="map-layers" role="region" aria-label="Map layers" hidden={!open}>
        {layers}
      </div>
    </div>
  )
}

function useNarrowViewport() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_MEDIA).matches)

  useEffect(() => {
    const query = window.matchMedia(NARROW_MEDIA)
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  return narrow
}

function LegendLayers({
  visibility,
  onToggle,
  status,
}: {
  visibility: Record<LayerKey, boolean>
  onToggle: (key: LayerKey) => void
  status: ReactNode
}) {
  return (
    <>
      <LayerToggle
        label="Flood hazard zones"
        checked={visibility.flood}
        onChange={() => onToggle('flood')}
      >
        <ul className="swatches">
          {FLOOD_CLASSES.map(([key, color, legend]) => (
            <li key={key}>
              <span className="swatch" style={{ background: color }} />
              {legend}
            </li>
          ))}
        </ul>
        {status}
      </LayerToggle>

      <LayerToggle
        label="Overburdened communities"
        checked={visibility.ej}
        onChange={() => onToggle('ej')}
      >
        {EJ_LEGEND_GROUPS.map((group) => (
          <div key={group.heading} className="legend-group">
            <p className="legend-group-heading">{group.heading}</p>
            <ul className="swatches">
              {group.values.map((value) => (
                <li key={value}>
                  <span
                    className="swatch"
                    style={{ background: COLOR_BY_CRITERION.get(value) }}
                  />
                  {value}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </LayerToggle>

      <LayerToggle
        label="Municipal boundaries"
        checked={visibility.muni}
        onChange={() => onToggle('muni')}
      >
        <ul className="swatches">
          <li>
            <span className="swatch line" style={{ borderColor: MUNICIPALITY_OUTLINE }} />
            Town boundary
          </li>
        </ul>
      </LayerToggle>
    </>
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
