import type { WarLossCategory } from './categories';

/** Compact representation of an individual geolocated equipment loss event. */
export type LossMapPoint = [lng: number, lat: number, sideIdx: number, catIdx: number, modelIdx: number, date: string, posts: number[], sources?: string[]];

/** Section dataset for losses-map. */
export interface LossesMapSectionData {
  /** Sequential list of equipment category IDs matching catIdx. */
  categories: WarLossCategory[];
  /** Sequential dictionary of English model names matching modelIdx. */
  models: string[];
  /** Side identifier list matching sideIdx. */
  sides: ['RF', 'UA', 'UNK'];
  /** Flat packed points array: [lng, lat, sideIdx, catIdx, modelIdx, date, posts, sources?]. */
  points: LossMapPoint[];
}
