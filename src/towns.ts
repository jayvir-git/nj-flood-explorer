import { SOURCES } from './config/sources'

const NAME = SOURCES.njMunicipalities.fields.name
const COUNTY = SOURCES.njMunicipalities.fields.county
const MUN_CODE = SOURCES.njMunicipalities.fields.munCode

export type TownOption = {
  name: string
  county: string
  munCode: string
}

/** Esri JSON polygon as returned by the municipalities service. */
export type TownGeometry = {
  rings: number[][][]
  spatialReference: { wkid: number }
}

type TownFeature = {
  attributes: Record<string, string>
  geometry?: TownGeometry
}

type TownQueryResponse = {
  features?: TownFeature[]
  spatialReference?: TownGeometry['spatialReference']
  error?: unknown
}

async function queryMunicipalities(params: Record<string, string>): Promise<{
  features: TownFeature[]
  spatialReference?: TownGeometry['spatialReference']
}> {
  const body = new URLSearchParams({ f: 'json', ...params })
  const response = await fetch(SOURCES.njMunicipalities.url + '/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) throw new Error(`municipality query ${response.status}`)
  const json = (await response.json()) as TownQueryResponse
  if (json.error) throw new Error('municipality query failed')
  return { features: json.features ?? [], spatialReference: json.spatialReference }
}

/** One-shot list for the keyboard picker; no geometry (D17). */
export async function fetchTownList(): Promise<TownOption[]> {
  const { features } = await queryMunicipalities({
    where: '1=1',
    outFields: [NAME, COUNTY, MUN_CODE].join(','),
    returnGeometry: 'false',
    orderByFields: NAME,
    resultRecordCount: '2000',
  })
  return features.map((feature) => ({
    name: feature.attributes[NAME],
    county: feature.attributes[COUNTY],
    munCode: feature.attributes[MUN_CODE],
  }))
}

export async function fetchTownByCode(munCode: string): Promise<{
  name: string
  county: string
  munCode: string
  geometry: TownGeometry
}> {
  const escaped = munCode.replace(/'/g, "''")
  const { features, spatialReference } = await queryMunicipalities({
    where: `${MUN_CODE} = '${escaped}'`,
    outFields: [NAME, COUNTY, MUN_CODE].join(','),
    returnGeometry: 'true',
    outSR: '102100',
  })
  const feature = features[0]
  if (!feature?.geometry?.rings?.length) throw new Error('town not found')
  // Esri puts spatialReference on the FeatureSet, not each geometry.
  const geometry: TownGeometry = {
    rings: feature.geometry.rings,
    spatialReference:
      feature.geometry.spatialReference ?? spatialReference ?? { wkid: 102100 },
  }
  return {
    name: feature.attributes[NAME],
    county: feature.attributes[COUNTY],
    munCode: feature.attributes[MUN_CODE],
    geometry,
  }
}
