import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import { SOURCES } from '../config/sources'
import type { CriterionTally, ExposureResult } from '../exposure'

const CHART_WIDTH = 366
const AXIS_WIDTH = 150

const SERIES = [
  { key: 'exposed', name: 'Flood-exposed', color: '#0b6a8a' },
  { key: 'outsideSfha', name: 'Outside the hazard area', color: '#c9c9c9' },
  { key: 'unmapped', name: 'No FEMA data', color: '#8a3200' },
] as const

function percent(part: number, whole: number) {
  return whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`
}

// The criteria are legal categories and are never shortened, so the axis wraps
// them instead.
function wrap(label: string, maxChars: number) {
  const lines: string[] = []
  let line = ''
  for (const word of label.split(' ')) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines
}

type TickProps = { x?: number; y?: number; payload?: { value?: string } }

function WrappedTick({ x = 0, y = 0, payload }: TickProps) {
  const lines = wrap(payload?.value ?? '', 22)
  return (
    <text x={x} y={y} textAnchor="end" fontSize={10} fill="#444">
      {lines.map((line, index) => (
        <tspan key={line} x={x} dy={index === 0 ? -(lines.length - 1) * 5 : 11}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

export function ExposureSummary({ town, exposure }: { town: string; exposure: ExposureResult }) {
  if (exposure.kind === 'no-overburdened') {
    return (
      <section className="exposure">
        <p className="exposure-summary">
          NJDEP designates no overburdened communities intersecting {town}, so this app has
          nothing to report for it.
        </p>
        <Sources />
      </section>
    )
  }

  if (exposure.kind === 'unmapped') {
    return (
      <section className="exposure">
        <p className="exposure-summary warning">
          FEMA&rsquo;s National Flood Hazard Layer publishes no data for any of the{' '}
          {exposure.blockGroups} overburdened community block group
          {exposure.blockGroups === 1 ? '' : 's'} intersecting {town}.
        </p>
        <p className="exposure-note">
          No exposure figure can be derived. A blank flood map is not a finding that the
          area is unexposed.
        </p>
        <Sources />
      </section>
    )
  }

  const { blockGroups, mapped, exposed, unmapped, byCriterion } = exposure
  const shown = SERIES.filter((series) =>
    byCriterion.some((tally) => tally[series.key] > 0),
  )

  return (
    <section className="exposure">
      <p className="exposure-summary">
        {unmapped > 0 ? (
          <>
            FEMA publishes no flood hazard data for {unmapped} of the {blockGroups}{' '}
            overburdened community block groups intersecting {town}; of the {mapped} it maps,{' '}
            {exposed} intersect a Special Flood Hazard Area.
          </>
        ) : (
          <>
            {exposed} of the {blockGroups} overburdened community block group
            {blockGroups === 1 ? '' : 's'} intersecting {town} intersect a FEMA Special Flood
            Hazard Area.
          </>
        )}
      </p>

      <BarChart
        width={CHART_WIDTH}
        height={74 + byCriterion.length * 46}
        data={byCriterion}
        layout="vertical"
        margin={{ top: 4, right: 14, bottom: 4, left: 4 }}
      >
        <CartesianGrid horizontal={false} stroke="#ededed" />
        <XAxis type="number" allowDecimals={false} fontSize={11} />
        <YAxis
          type="category"
          dataKey="criterion"
          width={AXIS_WIDTH}
          tick={<WrappedTick />}
          interval={0}
        />
        <Tooltip cursor={{ fill: '#f5f5f5' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {shown.map((series) => (
          <Bar
            key={series.key}
            dataKey={series.key}
            name={series.name}
            stackId="a"
            fill={series.color}
          />
        ))}
      </BarChart>

      <table className="exposure-table">
        <thead>
          <tr>
            <th scope="col">Overburdened community criterion</th>
            <th scope="col">Block groups</th>
            {unmapped > 0 && <th scope="col">No FEMA data</th>}
            <th scope="col">Exposed, of those FEMA maps</th>
          </tr>
        </thead>
        <tbody>
          {byCriterion.map((tally) => (
            <Row key={tally.criterion} tally={tally} showUnmapped={unmapped > 0} />
          ))}
          <tr className="exposure-total">
            <th scope="row">All</th>
            <td>{blockGroups}</td>
            {unmapped > 0 && <td>{unmapped}</td>}
            <td>
              {exposed} of {mapped} ({percent(exposed, mapped)})
            </td>
          </tr>
        </tbody>
      </table>

      <Sources />
    </section>
  )
}

function Row({ tally, showUnmapped }: { tally: CriterionTally; showUnmapped: boolean }) {
  const mapped = tally.exposed + tally.outsideSfha
  return (
    <tr>
      <th scope="row">{tally.criterion}</th>
      <td>{tally.total}</td>
      {showUnmapped && <td>{tally.unmapped}</td>}
      <td>
        {mapped === 0 ? (
          '—'
        ) : (
          <>
            {tally.exposed} of {mapped} ({percent(tally.exposed, mapped)})
          </>
        )}
      </td>
    </tr>
  )
}

function Sources() {
  return (
    <p className="exposure-sources">
      Sources:{' '}
      <a href={SOURCES.njdepOverburdened.url} target="_blank" rel="noreferrer">
        NJDEP overburdened communities
      </a>
      ,{' '}
      <a href={SOURCES.femaNfhl.url} target="_blank" rel="noreferrer">
        FEMA National Flood Hazard Layer
      </a>
      ,{' '}
      <a href={SOURCES.njMunicipalities.url} target="_blank" rel="noreferrer">
        NJOGIS municipal boundaries
      </a>
      .
    </p>
  )
}
