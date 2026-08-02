// Authoritative data sources. URLs, layer IDs, and field names below were
// manually verified against the live services on 2026-08-02. Do not modify or
// substitute without re-verifying in a browser (see .cursor/rules).

export const SOURCES = {
  /** FEMA National Flood Hazard Layer. Regulatory flood zones = layer 28. Max 2000 records/query. */
  femaNfhl: {
    url: "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer",
    floodHazardZonesLayerId: 28,
    infoUrl: "https://www.fema.gov/flood-maps/national-flood-hazard-layer",
    fields: {
      zone: "FLD_ZONE",
      subtype: "ZONE_SUBTY",
      /** FEMA's own Special Flood Hazard Area flag, "T" or "F". */
      sfha: "SFHA_TF",
    },
  },
  /** NJDEP Overburdened Communities under the NJ EJ Law (N.J.S.A. 13:1D-157). Census block groups. */
  njdepOverburdened: {
    url: "https://mapsdep.nj.gov/arcgis/rest/services/Features/Government/MapServer/42",
    infoUrl: "https://dep.nj.gov/ej/",
    fields: {
      criterion: "OVERBURDENED_COMMUNITY_CRITERI",
      lowIncomePct: "LOW_INCOME_PCT",
      minorityPct: "MINORITY_PCT",
      limitedEnglishPct: "PCTLINGUAGEISO",
      geoid: "GEOID",
      county: "COUNTY",
      name: "NAME",
    },
  },
  /** NJOGIS municipal boundaries, Web Mercator (matches basemap). Max 2000 records/query. */
  njMunicipalities: {
    url: "https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/NJ_Municipalities_3857/FeatureServer/0",
    infoUrl:
      "https://njogis-newjersey.opendata.arcgis.com/datasets/municipal-boundaries-of-nj-hosted-3424",
    fields: {
      name: "NAME",
      county: "COUNTY",
      munCode: "MUN_CODE",
    },
  },
} as const;
