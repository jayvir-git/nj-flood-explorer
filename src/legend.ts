/** The minScale FEMA publishes on layer 28. Above it the service draws nothing. */
export const FLOOD_MIN_SCALE = 36111.909643

// Six OVERBURDENED_COMMUNITY_CRITERI values, ordered by how many statutory axes
// they meet (1 → 2 → 3). Cyan/blue withheld so FEMA flood zones stay readable (D8/D16).
export const EJ_CRITERIA: ReadonlyArray<readonly [string, string]> = [
  // 1 criterion — lighter weight, still distinct after 45% opacity over gray-vector
  ['Low Income', '#fd8d3c'],
  ['Minority', '#8073ac'],
  // 2 criteria — mid weight
  ['Low Income and Minority', '#e66101'],
  ['Low Income and Limited English', '#c51b7d'],
  ['Minority and Limited English', '#4d9221'],
  // 3 criteria — heaviest
  ['Low Income, Minority, and Limited English', '#542788'],
]

/** Legend headings for D16's criteria-count ordering. */
export const EJ_LEGEND_GROUPS: ReadonlyArray<{
  heading: string
  values: ReadonlyArray<string>
}> = [
  { heading: 'Meets one criterion', values: ['Low Income', 'Minority'] },
  {
    heading: 'Meets two criteria',
    values: [
      'Low Income and Minority',
      'Low Income and Limited English',
      'Minority and Limited English',
    ],
  },
  {
    heading: 'Meets three criteria',
    values: ['Low Income, Minority, and Limited English'],
  },
]

// FEMA's own labels and colours, from layer 28's drawingInfo. These are the only
// two classes its renderer draws for the zone/subtype combinations that exist in
// New Jersey inside the SFHA filter; floodways are red, everything else cyan.
// Second string is the plain-language legend line (FEMA term kept, gloss added).
export const FLOOD_CLASSES: ReadonlyArray<readonly [string, string, string]> = [
  ['1% Annual Chance Flood Hazard', '#00e6ff', '1% annual chance flood hazard (high-risk zone)'],
  ['Regulatory Floodway', '#ff0000', 'Regulatory floodway (channel kept clear for flood water)'],
]

export const MUNICIPALITY_OUTLINE = '#4a4a4a'
