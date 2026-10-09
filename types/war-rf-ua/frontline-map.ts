/** Summary metrics comparing territorial control claims between sources (km²). */
export interface FrontlineSummary {
  /** Date of the latest frontline snapshot in YYYY-MM-DD format. */
  latestDate: string;
  /** Internationally recognized total territory of Ukraine (603,628 km²). */
  totalUkraineKm2: number;
  /** Territory with consensus Russian control agreed by both sources (km²). */
  consensusRfKm2: number;
  /** Territory under consensus Ukrainian control (km²). */
  consensusUaKm2: number;
  /** Total area of territorial contradiction / discrepancy between sources (km²). */
  disputedKm2: number;
  /** Territory marked occupied by DeepState (km²). */
  dsOccupiedKm2: number;
  /** Territory in DeepState grey zone (km²). */
  dsGreyKm2: number;
  /** Territory marked liberated by DeepState (km²). */
  dsLiberatedKm2: number;
  /** Territory claimed under Russian control by LostArmour (km²). */
  laClaimedKm2: number;
  /** Granular discrepancy sub-categories explaining exact causes of difference. */
  discrepancies: {
    /** LostArmour claims control on territory DeepState marks as Liberated (km²). */
    laClaimsLiberatedKm2: number;
    /** LostArmour claims control on territory DeepState marks as Grey Zone (km²). */
    laClaimsGreyKm2: number;
    /** LostArmour claims control on sovereign Ukrainian territory (km²). */
    laClaimsUaKm2: number;
    /** DeepState marks occupied, but LostArmour does not claim (km²). */
    dsClaimsOccupiedKm2: number;
    /** DeepState grey zone outside LostArmour claims (km²). */
    neutralGreyKm2: number;
  };
}

/** Daily territorial history entry tracking control dynamics and discrepancies. */
export interface FrontlineTimelinePoint {
  /** Timestamp date in YYYY-MM-DD format. */
  date: string;
  /** Consensus Russian control area (km²). */
  consensusRfKm2: number;
  /** Consensus Ukrainian control area (km²). */
  consensusUaKm2: number;
  /** Contradiction / discrepancy area between sources (km²). */
  disputedKm2: number;
  /** LostArmour claimed control area (km²). */
  laClaimedKm2: number;
  /** DeepState occupied area (km²). */
  dsOccupiedKm2: number;
  /** DeepState grey zone area (km²). */
  dsGreyKm2: number;
  /** Day-over-day net territorial change in consensus Russian control (km²). */
  deltaKm2: number;
}

/** Vector polygon geometry represented as array of polygon rings [[[lng, lat], ...]]. */
export type FrontlineMultiPolygonCoords = [number, number][][][];

/** Map layer geometry payloads driving MapLibre GL visualization. */
export interface FrontlineMapLayers {
  /** Consensus Russian control polygons (Both sources agree) - Red. */
  consensusRf: FrontlineMultiPolygonCoords;
  /** Discrepancy / contradiction polygons between sources - Grey. */
  disputed: FrontlineMultiPolygonCoords;
  /** DeepState frontline outline / claimed advance (occupied + grey zone). */
  deepstate: FrontlineMultiPolygonCoords;
  /** LostArmour frontline outline / claimed advance. */
  lostarmour: FrontlineMultiPolygonCoords;
}

/** Compact polyline-encoded layer set where each ring is an ASCII delta-encoded string. */
export interface EncodedFrontlineLayers {
  /** Consensus Russian control polygons - array of polygons [rings[encodedRingStr]]. */
  c: string[][];
  /** Disputed / contradiction polygons - array of polygons [rings[encodedRingStr]]. */
  d: string[][];
  /** DeepState frontline outline. */
  ds: string[][];
  /** LostArmour frontline outline. */
  la: string[][];
}

/** Historical day entry: ready map layers, compact encoded layers, or a reference date if unchanged. */
export type DayFrontlineEntry = FrontlineMapLayers | EncodedFrontlineLayers | { ref: string };

/** Frontline territorial control comparison dataset. */
export interface WarFrontlineDataset {
  /** High-level summary metrics for the latest date. */
  summary: FrontlineSummary;
  /** Daily time series of territorial claims and discrepancies spanning full history. */
  timeline: FrontlineTimelinePoint[];
  /** Latest map layers with decoded multi-polygon coordinates. */
  layers: FrontlineMapLayers;
  /** Daily historical map layers indexed by YYYY-MM-DD date. */
  days?: Record<string, DayFrontlineEntry>;
}

/** Section dataset for frontline-map. */
export type FrontlineMapSectionData = WarFrontlineDataset;
