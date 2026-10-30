import type {
  DayFrontlineEntry,
  EncodedFrontlineLayers,
  FrontlineDayMeta,
  FrontlineMapLayers,
  FrontlineMultiPolygonCoords,
  FrontlineSummary,
  FrontlineTimelinePoint,
  WarFrontlineDataset,
} from '@graphs/shared/types/war-rf-ua/frontline';
import { XMLParser } from 'fast-xml-parser';
import polygonClipping from 'polygon-clipping';
import { fileExists, getRawDataPath, readJson, writeJsonAsyncToR2, writeJsonAsyncToSite } from '@/utils/fs';
import { fetchWithRetry } from '@/utils/http';
import { getLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { round } from '@/utils/math';

const DATA_FRONTLINE_PATH = getRawDataPath('war-rf-ua', 'data-frontline.json');
const UKRAINE_TOTAL_KM2 = 603628;
const BASELINE_DATE = '2022-02-23';
const START_DATE = '2022-04-03';
const LA_START_DATE = '2023-01-28';
const RDP_EPSILON = 0.0015;

type Pair = [number, number];
type Ring = Pair[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

/** Computes geodesic area of a polygon ring using the WGS-84 authalic radius in km². */
function ringAreaKm2(ring: Pair[]): number {
  const R = 6371.0072;
  let total = 0;
  const len = ring.length;
  if (len < 3) return 0;
  for (let i = 0; i < len; i++) {
    const p1 = ring[i];
    const p2 = ring[(i + 1) % len];
    const lon1 = (p1[0] * Math.PI) / 180;
    const lat1 = (p1[1] * Math.PI) / 180;
    const lon2 = (p2[0] * Math.PI) / 180;
    const lat2 = (p2[1] * Math.PI) / 180;
    total += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  return Math.abs((total * R * R) / 2);
}

/** Checks if a polygon ring lies within the Ukraine + Kursk/Belgorod theater bounding box. */
function isRingInTheaterBounds(ring: Pair[]): boolean {
  if (ring.length === 0) return false;
  for (const [lon, lat] of ring) {
    if (lon < 22.0 || lon > 41.0 || lat < 44.0 || lat > 53.5) {
      return false;
    }
  }
  return true;
}

/** Deduplicates consecutive identical vertices in a ring while preserving closure with at least 4 points. */
function deduplicateRing(ring: Pair[]): Pair[] {
  if (ring.length < 4) return [];
  const deduped: Pair[] = [];
  for (const [lon, lat] of ring) {
    if (deduped.length === 0 || deduped[deduped.length - 1][0] !== lon || deduped[deduped.length - 1][1] !== lat) {
      deduped.push([lon, lat]);
    }
  }
  if (deduped.length > 1 && deduped[0][0] === deduped[deduped.length - 1][0] && deduped[0][1] === deduped[deduped.length - 1][1]) {
    deduped.pop();
  }
  if (deduped.length < 3) return [];
  deduped.push([deduped[0][0], deduped[0][1]]);
  return deduped;
}

/** Computes total area of a MultiPolygon in km² subtracting inner holes. */
function getMultiPolyAreaKm2(mp: MultiPolygon): number {
  let total = 0;
  for (const poly of mp) {
    if (!poly || poly.length === 0) continue;
    let area = ringAreaKm2(poly[0]);
    for (let i = 1; i < poly.length; i++) {
      area -= ringAreaKm2(poly[i]);
    }
    total += Math.max(0, area);
  }
  return total;
}

/** Cleans and normalizes polygon ring coordinates with 5 decimal precision (~1m). */
function cleanRing(ring: Pair[]): Pair[] {
  if (ring.length < 3) return [];
  const cleaned: Pair[] = [];
  for (let i = 0; i < ring.length; i++) {
    const pt = ring[i];
    const lon = Math.round(pt[0] * 1e5) / 1e5;
    const lat = Math.round(pt[1] * 1e5) / 1e5;
    if (cleaned.length === 0 || cleaned[cleaned.length - 1][0] !== lon || cleaned[cleaned.length - 1][1] !== lat) {
      cleaned.push([lon, lat]);
    }
  }
  if (cleaned.length < 3) return [];
  const first = cleaned[0];
  const last = cleaned[cleaned.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    cleaned.push([first[0], first[1]]);
  }
  return cleaned;
}

/** Squared Euclidean distance between two 2D points. */
const distSq = (p1: Pair, p2: Pair): number => {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return dx * dx + dy * dy;
};

/** Squared perpendicular distance from point p to line segment v-w. */
const distToSegmentSq = (p: Pair, v: Pair, w: Pair): number => {
  const l2 = distSq(v, w);
  if (l2 === 0) return distSq(p, v);
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  return distSq(p, [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])]);
};

/** Ramer-Douglas-Peucker line simplification. */
const rdp = (points: Pair[], epsilon: number): Pair[] => {
  if (points.length <= 2) return points;
  let maxD = 0;
  let index = 0;
  const epsSq = epsilon * epsilon;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegmentSq(points[i], points[0], points[points.length - 1]);
    if (d > maxD) {
      maxD = d;
      index = i;
    }
  }
  if (maxD > epsSq) {
    const r1 = rdp(points.slice(0, index + 1), epsilon);
    const r2 = rdp(points.slice(index), epsilon);
    return r1.slice(0, -1).concat(r2);
  }
  return [points[0], points[points.length - 1]];
};

/** Simplifies a closed polygon ring while preserving ring closure and precision. */
const simplifyRing = (ring: Pair[], epsilon: number, precision = 4): Pair[] => {
  if (ring.length < 4) return [];
  const isClosed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const pts = isClosed ? ring.slice(0, -1) : ring;
  const midIdx = Math.floor(pts.length / 2);
  const part1 = rdp(pts.slice(0, midIdx + 1), epsilon);
  const part2 = rdp(pts.slice(midIdx), epsilon);
  const simplified = part1.slice(0, -1).concat(part2);
  if (isClosed) {
    simplified.push([simplified[0][0], simplified[0][1]]);
  }
  const factor = 10 ** precision;
  const rounded: Pair[] = simplified.map((p) => [Math.round(p[0] * factor) / factor, Math.round(p[1] * factor) / factor]);
  return deduplicateRing(rounded);
};

/** Simplifies MultiPolygon rings and filters out out-of-bounds rings and sub-pixel slivers (including inner holes). */
const simplifyMultiPolygon = (mp: MultiPolygon, epsilon = RDP_EPSILON, minAreaKm2 = 0.05, precision = 4): MultiPolygon => {
  return mp
    .filter((poly) => poly && poly.length > 0 && isRingInTheaterBounds(poly[0]) && ringAreaKm2(poly[0]) >= minAreaKm2)
    .map((poly) => {
      const outer = simplifyRing(poly[0], epsilon, precision);
      if (outer.length < 4 || ringAreaKm2(outer) < minAreaKm2) return [];
      const holes = poly
        .slice(1)
        .filter((hole) => isRingInTheaterBounds(hole) && ringAreaKm2(hole) >= minAreaKm2)
        .map((hole) => simplifyRing(hole, epsilon, precision))
        .filter((hole) => hole.length >= 4 && ringAreaKm2(hole) >= minAreaKm2);
      return [outer, ...holes];
    })
    .filter((poly) => poly.length > 0);
};

/** Encodes a single integer using variable-length zigzag base-64 delta encoding. */
function encodeNumber(num: number): string {
  let sgnNum = num < 0 ? ~(num << 1) : num << 1;
  let s = '';
  while (sgnNum >= 0x20) {
    s += String.fromCharCode((0x20 | (sgnNum & 0x1f)) + 63);
    sgnNum >>= 5;
  }
  s += String.fromCharCode(sgnNum + 63);
  return s;
}

/** Encodes a polygon ring of coordinates into an ASCII polyline string. */
function encodeRing(ring: Pair[], factor = 1e4): string {
  let prevLng = 0;
  let prevLat = 0;
  let out = '';
  for (const [lng, lat] of ring) {
    const l1 = Math.round(lng * factor);
    const l2 = Math.round(lat * factor);
    out += encodeNumber(l1 - prevLng);
    out += encodeNumber(l2 - prevLat);
    prevLng = l1;
    prevLat = l2;
  }
  return out;
}

/** Encodes a MultiPolygon into a compact array of polygon ring strings. */
function encodeMultiPolygon(mp: MultiPolygon, factor = 1e4): string[][] {
  const result: string[][] = [];
  for (const poly of mp) {
    const polyRings: string[] = [];
    for (const ring of poly) {
      if (ring && ring.length >= 3) {
        polyRings.push(encodeRing(ring, factor));
      }
    }
    if (polyRings.length > 0) result.push(polyRings);
  }
  return result;
}

/** Decodes a variable-length zigzag delta-encoded polyline number. */
function decodeNumber(str: string, indexRef: { index: number }): number {
  let result = 0;
  let shift = 0;
  let b = 0;
  do {
    b = str.charCodeAt(indexRef.index++) - 63;
    result |= (b & 0x1f) << shift;
    shift += 5;
  } while (b >= 0x20);
  return result & 1 ? ~(result >> 1) : result >> 1;
}

/** Decodes a polyline-encoded string into an array of [lng, lat] coordinates. */
function decodePolylineRing(str: string, factor = 1e4): Pair[] {
  const points: Pair[] = [];
  const indexRef = { index: 0 };
  let lng = 0;
  let lat = 0;
  while (indexRef.index < str.length) {
    lng += decodeNumber(str, indexRef);
    lat += decodeNumber(str, indexRef);
    points.push([lng / factor, lat / factor]);
  }
  return points;
}

/** Decodes an encoded multi-polygon structure into standard MultiPolygon coordinates. */
function decodeMultiPolygon(encoded: string[][], factor = 1e4): FrontlineMultiPolygonCoords {
  return encoded.map((poly) => poly.map((ring) => decodePolylineRing(ring, factor)));
}

interface GeoJsonGeometry {
  type?: string;
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
}

interface GeoJsonFeature {
  type?: string;
  properties?: { name?: string; description?: string; fill?: string; stroke?: string };
  geometry?: GeoJsonGeometry;
}

interface KmlPlacemark {
  name?: string;
  description?: string;
  Polygon?: {
    outerBoundaryIs?: {
      LinearRing?: {
        coordinates?: string;
      };
    };
  };
}

/** Identifies if a DeepState feature represents occupied territory in Ukraine. */
function isOccupiedFeature(name?: string, fill?: string): boolean {
  if (!name && !fill) return false;
  const n = (name || '').toLowerCase();
  const f = (fill || '').toLowerCase();

  if (
    n.includes('придністров') ||
    n.includes('transnistria') ||
    n.includes('салла') ||
    n.includes('естоні') ||
    n.includes('латві') ||
    n.includes('курильськ') ||
    n.includes('цхінвальськ') ||
    n.includes('абхазія') ||
    n.includes('пруссія') ||
    n.includes('карелі') ||
    n.includes('ічкерія') ||
    n.includes('тузла')
  ) {
    return false;
  }

  if (
    n.includes('geojson.status.occupied') ||
    n.includes('geojson.territories.crimea') ||
    n.includes('geojson.territories.ordlo') ||
    n.includes('окупован') ||
    n.includes('occupied') ||
    n.includes('ордло') ||
    n === 'крим' ||
    n.includes('зайняті ворогом')
  ) {
    return true;
  }

  if (f === '#a52714') {
    return true;
  }

  return false;
}

/** Identifies if a DeepState feature represents Crimea territory. */
function isCrimeaTerritoryFeature(f: GeoJsonFeature): boolean {
  if (!f.geometry) return false;
  const name = (f.properties?.name || '').toLowerCase();
  if (name.includes('кримськ') || name.includes('міст') || name.includes('bridge') || name.includes('airfield')) {
    return false;
  }
  return name.includes('geojson.territories.crimea') || name.includes('окупований крим') || name.includes('occupied crimea') || name === 'крим';
}

/** Identifies if a DeepState feature represents pre-invasion 2022 baseline territory (Crimea + ORDLO). */
function isPre2022BaselineFeature(f: GeoJsonFeature): boolean {
  if (isCrimeaTerritoryFeature(f)) return true;
  const name = (f.properties?.name || '').toLowerCase();
  return name.includes('ордло') || name.includes('cadr and calr') || name.includes('geojson.territories.ordlo');
}

/** Identifies if a LostArmour placemark represents Crimea territory (to avoid conflicting boundary slivers). */
function isLaCrimeaPlacemark(p: KmlPlacemark): boolean {
  const n = (p.name || p.description || '').toLowerCase();
  return n.includes('республика крым') || n.includes('севастополь') || n.includes('occupied crimea') || n.includes('крым');
}

/** Checks if a polygon ring is located within the Crimean peninsula boundary. */
function isCrimeaPolygon(poly: Polygon): boolean {
  if (!poly?.[0] || poly[0].length === 0) return false;
  const ring = poly[0];
  let inCrimeaCount = 0;
  for (const [lng, lat] of ring) {
    if (lat < 46.05 && lat > 44.2 && lng > 32.4 && lng < 36.65) {
      inCrimeaCount++;
    }
  }
  return inCrimeaCount > ring.length * 0.7;
}

/** Identifies if a DeepState feature represents grey / contested zone. */
function isGreyFeature(name?: string, fill?: string): boolean {
  if (!name && !fill) return false;
  const n = (name || '').toLowerCase();
  const f = (fill || '').toLowerCase();

  if (n.includes('geojson.status.unknown') || n.includes('unknown status') || n.includes('статус невідомий') || n.includes('під питанням') || n.includes('contested') || n.includes('contensed')) {
    return true;
  }

  if (f === '#bcaaa4' || f === '#bdbdbd') {
    return true;
  }

  return false;
}

/** Converts GeoJSON geometry into standard MultiPolygon rings, unwrapping GeometryCollections recursively. */
function geometryToPolygons(g?: GeoJsonGeometry): MultiPolygon {
  if (!g) return [];
  if (g.type === 'GeometryCollection' && Array.isArray(g.geometries)) {
    const polys: MultiPolygon = [];
    for (const sub of g.geometries) polys.push(...geometryToPolygons(sub));
    return polys;
  }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    const rings = (g.coordinates as Pair[][]).map(cleanRing).filter((r) => r.length >= 4 && isRingInTheaterBounds(r));
    return rings.length > 0 ? [rings] : [];
  }
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    const polys: Polygon[] = [];
    for (const p of g.coordinates as Pair[][][]) {
      const rings = p.map(cleanRing).filter((r) => r.length >= 4 && isRingInTheaterBounds(r));
      if (rings.length > 0) polys.push(rings);
    }
    return polys;
  }
  return [];
}

/** Converts GeoJSON Feature geometry into standard MultiPolygon rings. */
function featureToPolygons(f: GeoJsonFeature): MultiPolygon {
  return geometryToPolygons(f.geometry);
}

/** Generates sequence of YYYY-MM-DD date strings between start and end inclusive. */
function generateDateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  let curr = startStr;
  while (curr <= endStr) {
    dates.push(curr);
    const [y, m, d] = curr.split('-').map(Number);
    const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
    curr = nextDate.toISOString().slice(0, 10);
  }
  return dates;
}

/** Enriches timeline points with day-over-day consensus territorial change. */
function enrichTimelineWithDeltas(timeline: FrontlineTimelinePoint[]): FrontlineTimelinePoint[] {
  const sorted = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((point, i, arr) => {
    if (i === 0) return { ...point, deltaKm2: 0 };
    const prev = arr[i - 1];
    const rawDelta = round(point.consensusRfKm2 - prev.consensusRfKm2, 1);
    const deltaKm2 = rawDelta;
    return { ...point, deltaKm2 };
  });
}

/** Normalizes daily frontline history so the first day of every year is a full layer object and identical days within the same year reference the prior anchor date. */
function normalizeDaysWithYearRefs(days: Record<string, DayFrontlineEntry>): Record<string, DayFrontlineEntry> {
  const sortedDates = Object.keys(days).sort();
  const resolvedByDate = new Map<string, EncodedFrontlineLayers>();

  for (const date of sortedDates) {
    let entry: DayFrontlineEntry | undefined = days[date];
    let depth = 0;
    while (entry && 'ref' in entry && depth < 50) {
      entry = days[entry.ref];
      depth++;
    }
    if (entry && 'c' in entry) {
      resolvedByDate.set(date, entry);
    }
  }

  const normalized: Record<string, DayFrontlineEntry> = {};
  let prevSerialized = '';
  let prevAnchorDate = '';

  for (const date of sortedDates) {
    const layers = resolvedByDate.get(date);
    if (!layers) continue;
    const serialized = JSON.stringify(layers);
    if (serialized === prevSerialized && prevAnchorDate && date.slice(0, 4) === prevAnchorDate.slice(0, 4)) {
      normalized[date] = { ref: prevAnchorDate };
    } else {
      normalized[date] = layers;
      prevSerialized = serialized;
      prevAnchorDate = date;
    }
  }

  return normalized;
}

/** Repairs existing daily frontline layers and timeline metrics by stripping out-of-bounds rings, inner hole slivers, and consecutive duplicate vertices. */
function repairExistingFrontlineDataset(days: Record<string, DayFrontlineEntry>, timelineMap: Record<string, FrontlineTimelinePoint>): boolean {
  const sortedDates = Object.keys(days).sort();
  if (sortedDates.length === 0) return false;

  interface InspectedRing {
    inBounds: boolean;
    valid: boolean;
    encoded: string;
    areaKm2: number;
    changed: boolean;
  }

  interface CleanedLayersResult {
    layers: EncodedFrontlineLayers;
    cAreaKm2: number;
    dAreaKm2: number;
    dsAreaKm2: number;
    laAreaKm2: number;
    removedOutOfBoundsDsAreaKm2: number;
    changed: boolean;
  }

  const ringCache = new Map<string, InspectedRing>();
  const layerCache = new Map<EncodedFrontlineLayers, CleanedLayersResult>();

  const inspectRing = (str: string): InspectedRing => {
    const cached = ringCache.get(str);
    if (cached) return cached;
    const raw = decodePolylineRing(str);
    const inBounds = isRingInTheaterBounds(raw);
    const deduped = deduplicateRing(raw);
    const valid = deduped.length >= 4;
    const changed = !inBounds || !valid || deduped.length !== raw.length;
    const encoded = valid ? (deduped.length === raw.length ? str : encodeRing(deduped)) : '';
    const areaKm2 = valid ? ringAreaKm2(deduped) : 0;
    const res: InspectedRing = { inBounds, valid, encoded, areaKm2, changed };
    ringCache.set(str, res);
    return res;
  };

  const cleanEncodedMultiPolygon = (encodedPolys: string[][], minAreaKm2: number): { encoded: string[][]; areaKm2: number; removedOutOfBoundsAreaKm2: number; changed: boolean } => {
    const out: string[][] = [];
    let totalAreaKm2 = 0;
    let removedOutOfBoundsAreaKm2 = 0;
    let changed = false;

    for (const poly of encodedPolys || []) {
      if (!poly || poly.length === 0) {
        changed = true;
        continue;
      }
      const outer = inspectRing(poly[0]);
      if (!outer.inBounds) {
        let outArea = outer.areaKm2;
        for (let i = 1; i < poly.length; i++) {
          outArea -= inspectRing(poly[i]).areaKm2;
        }
        removedOutOfBoundsAreaKm2 += Math.max(0, outArea);
        changed = true;
        continue;
      }
      if (!outer.valid || outer.areaKm2 < minAreaKm2) {
        changed = true;
        continue;
      }
      if (outer.changed) changed = true;

      const cleanedPoly: string[] = [outer.encoded];
      let polyArea = outer.areaKm2;
      for (let i = 1; i < poly.length; i++) {
        const hole = inspectRing(poly[i]);
        if (!hole.inBounds || !hole.valid || hole.areaKm2 < minAreaKm2) {
          changed = true;
          continue;
        }
        if (hole.changed) changed = true;
        cleanedPoly.push(hole.encoded);
        polyArea -= hole.areaKm2;
      }
      totalAreaKm2 += Math.max(0, polyArea);
      out.push(cleanedPoly);
    }

    return { encoded: out, areaKm2: totalAreaKm2, removedOutOfBoundsAreaKm2, changed };
  };

  const cleanLayers = (entry: EncodedFrontlineLayers): CleanedLayersResult => {
    const cached = layerCache.get(entry);
    if (cached) return cached;
    const cRes = cleanEncodedMultiPolygon(entry.c, 0.05);
    const dRes = cleanEncodedMultiPolygon(entry.d, 0.3);
    const dsRes = cleanEncodedMultiPolygon(entry.ds, 0.05);
    const laRes = cleanEncodedMultiPolygon(entry.la, 0.05);
    const changed = cRes.changed || dRes.changed || dsRes.changed || laRes.changed;
    const res: CleanedLayersResult = {
      layers: changed ? { c: cRes.encoded, d: dRes.encoded, ds: dsRes.encoded, la: laRes.encoded } : entry,
      cAreaKm2: cRes.areaKm2,
      dAreaKm2: dRes.areaKm2,
      dsAreaKm2: dsRes.areaKm2,
      laAreaKm2: laRes.areaKm2,
      removedOutOfBoundsDsAreaKm2: dsRes.removedOutOfBoundsAreaKm2,
      changed,
    };
    layerCache.set(entry, res);
    return res;
  };

  let anyChanged = false;
  const resolvedCleanedByDate = new Map<string, CleanedLayersResult>();

  for (const date of sortedDates) {
    let entry: DayFrontlineEntry | undefined = days[date];
    let depth = 0;
    while (entry && 'ref' in entry && depth < 50) {
      if (entry.ref.slice(0, 4) !== date.slice(0, 4)) {
        anyChanged = true;
      }
      entry = days[entry.ref];
      depth++;
    }
    if (!entry || !('c' in entry)) continue;
    const cleaned = cleanLayers(entry);
    if (cleaned.changed) anyChanged = true;
    resolvedCleanedByDate.set(date, cleaned);

    const pt = timelineMap[date];
    if (pt) {
      const consensusRfKm2 = round(cleaned.cAreaKm2, 1);
      const disputedKm2 = round(cleaned.dAreaKm2, 1);
      const laClaimedKm2 = date >= LA_START_DATE ? round(cleaned.laAreaKm2, 1) : 0;
      const consensusUaKm2 = round(Math.max(0, UKRAINE_TOTAL_KM2 - consensusRfKm2 - disputedKm2), 1);
      let dsOccupiedKm2 = pt.dsOccupiedKm2;
      if (cleaned.removedOutOfBoundsDsAreaKm2 > 0 && dsOccupiedKm2 > round(cleaned.dsAreaKm2, 1)) {
        dsOccupiedKm2 = round(Math.max(0, dsOccupiedKm2 - cleaned.removedOutOfBoundsDsAreaKm2), 1);
      }

      if (pt.consensusRfKm2 !== consensusRfKm2 || pt.disputedKm2 !== disputedKm2 || pt.laClaimedKm2 !== laClaimedKm2 || pt.consensusUaKm2 !== consensusUaKm2 || pt.dsOccupiedKm2 !== dsOccupiedKm2) {
        anyChanged = true;
        timelineMap[date] = {
          ...pt,
          consensusRfKm2,
          consensusUaKm2,
          disputedKm2,
          laClaimedKm2,
          dsOccupiedKm2,
        };
      }
    }
  }

  let prevSerialized = '';
  let prevAnchorDate = '';
  for (const date of sortedDates) {
    const cleaned = resolvedCleanedByDate.get(date);
    if (!cleaned) continue;
    const serialized = JSON.stringify(cleaned.layers);
    if (serialized === prevSerialized && prevAnchorDate && date.slice(0, 4) === prevAnchorDate.slice(0, 4)) {
      const cur = days[date];
      if (!('ref' in cur) || cur.ref !== prevAnchorDate) anyChanged = true;
      days[date] = { ref: prevAnchorDate };
    } else {
      if ('ref' in days[date]) anyChanged = true;
      days[date] = cleaned.layers;
      prevSerialized = serialized;
      prevAnchorDate = date;
    }
  }

  return anyChanged;
}

/** Concurrently fetches HTTP ETags for all historical LostArmour KML files. */
async function fetchLostArmourEtags(dates: string[], concurrency = 32): Promise<Map<string, string>> {
  const etagMap = new Map<string, string>();
  const laDates = dates.filter((d) => d >= LA_START_DATE);
  if (laDates.length === 0) return etagMap;

  let index = 0;
  async function worker() {
    while (index < laDates.length) {
      const idx = index++;
      const date = laDates[idx];
      try {
        const res = await fetch(`https://lostarmour.info/mapinfo/kml/${date}.kml`, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://lostarmour.info/map',
          },
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) {
          const raw = res.headers.get('etag');
          if (raw) {
            etagMap.set(date, raw.replace(/["']/g, '').trim());
          }
        }
      } catch {
        // Individual HEAD failure ignored; cached status preserved
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, laDates.length) }, () => worker());
  await Promise.all(workers);
  return etagMap;
}

/** Parses and maintains comprehensive daily frontline territorial dataset. */
export async function parseFrontline(forceUpdate = false): Promise<WarFrontlineDataset> {
  const logger = getLogger('war-rf-ua');

  let existing: WarFrontlineDataset | null = null;
  if (await fileExists(DATA_FRONTLINE_PATH)) {
    try {
      existing = await readJson<WarFrontlineDataset>(DATA_FRONTLINE_PATH);
    } catch {
      existing = null;
    }
  }

  // 1. Fetch LostArmour metadata for latest available date
  logger.debug('Fetching latest LostArmour frontline metadata...');
  let latestDate = new Date().toISOString().slice(0, 10);
  try {
    const laMetaRes = await fetchWithRetry('https://lostarmour.info/panel/next/api/public/map/kml-meta', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://lostarmour.info/map',
      },
      retries: 2,
      timeoutMs: 8000,
    });
    if (laMetaRes.ok) {
      const meta = (await laMetaRes.json()) as { date?: string };
      if (meta?.date) latestDate = meta.date;
    }
  } catch (err) {
    logger.warn('Failed to fetch LostArmour metadata, defaulting to current date:', err);
  }

  const allDates = [BASELINE_DATE, ...generateDateRange(START_DATE, latestDate)];

  // 2. Concurrently fetch DeepState public history and LostArmour ETags for all dates
  logger.debug(`Fetching upstream metadata (DeepState revisions and ${allDates.length} LostArmour ETags)...`);
  const [dsHistRes, laEtagMap] = await Promise.all([
    fetchWithRetry('https://deepstatemap.live/api/history/public', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      retries: 2,
      timeoutMs: 15000,
    }),
    fetchLostArmourEtags(allDates),
  ]);
  if (!dsHistRes.ok) throw new Error(`Failed to fetch DeepState revisions: HTTP ${dsHistRes.status}`);
  const dsRevisions = (await dsHistRes.json()) as { id: number; createdAt: string; updatedAt: string }[];

  const directDsByDate = new Map<string, { id: number; updatedAt: string }>();
  for (const r of dsRevisions) {
    const dateStr = r.createdAt.slice(0, 10);
    directDsByDate.set(dateStr, { id: r.id, updatedAt: r.updatedAt });
  }
  const sortedDsDates = Array.from(directDsByDate.keys()).sort();

  const resolveDsInfo = (date: string): { id: number; updatedAt: string } | undefined => {
    const direct = directDsByDate.get(date);
    if (direct) return direct;
    if (date === BASELINE_DATE) {
      const first = dsRevisions[0];
      return first ? { id: first.id, updatedAt: first.updatedAt } : undefined;
    }
    let low = 0;
    let high = sortedDsDates.length - 1;
    let bestIdx = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (sortedDsDates[mid] <= date) {
        bestIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (bestIdx >= 0) {
      return directDsByDate.get(sortedDsDates[bestIdx]);
    }
    return undefined;
  };

  const existingDays: Record<string, DayFrontlineEntry> = forceUpdate ? {} : existing?.days || {};
  const existingTimeline: Record<string, FrontlineTimelinePoint> = {};
  if (!forceUpdate && existing?.timeline) {
    for (const p of existing.timeline) {
      existingTimeline[p.date] = p;
    }
  }

  const savedRevisions: Record<string, FrontlineDayMeta> = existing?.meta?.revisions || {};
  const isInitialMetaMigration = !forceUpdate && (!existing?.meta?.revisions || Object.keys(savedRevisions).length === 0);
  const revisions: Record<string, FrontlineDayMeta> = { ...savedRevisions };

  const wasRepaired = !forceUpdate ? repairExistingFrontlineDataset(existingDays, existingTimeline) : false;

  // Determine missing or invalidated dates
  const invalidatedDates: string[] = [];
  const genuinelyMissingDates: string[] = [];

  for (const d of allDates) {
    const day = existingDays[d];
    const pt = existingTimeline[d];
    const isMissing = !day || !pt;
    const isCorrupted =
      !isMissing &&
      (d >= LA_START_DATE
        ? (pt.laClaimedKm2 ?? 0) < 100000 || (pt.consensusRfKm2 ?? 0) < 100000
        : (pt.dsOccupiedKm2 ?? 0) < 40000);

    if (isMissing || isCorrupted) {
      genuinelyMissingDates.push(d);
      continue;
    }

    if (forceUpdate) {
      genuinelyMissingDates.push(d);
      continue;
    }

    if (isInitialMetaMigration) {
      const dsInfo = resolveDsInfo(d);
      const laEtag = laEtagMap.get(d);
      revisions[d] = {
        ds: dsInfo?.updatedAt,
        la: d >= LA_START_DATE ? laEtag : undefined,
      };
      continue;
    }

    const saved = savedRevisions[d];
    if (!saved) {
      invalidatedDates.push(d);
      continue;
    }

    const dsInfo = resolveDsInfo(d);
    if (dsInfo && saved.ds !== dsInfo.updatedAt) {
      invalidatedDates.push(d);
      continue;
    }

    const laEtag = laEtagMap.get(d);
    if (d >= LA_START_DATE && laEtag && saved.la !== laEtag) {
      invalidatedDates.push(d);
      continue;
    }
  }

  const missingDates = [...genuinelyMissingDates, ...invalidatedDates].sort();

  if (invalidatedDates.length > 0) {
    logger.info(`Detected ${invalidatedDates.length} frontline dates with changed upstream revisions (DS updatedAt or LA ETag).`);
  }
  if (genuinelyMissingDates.length > 0 && !forceUpdate) {
    logger.info(`Detected ${genuinelyMissingDates.length} new or incomplete frontline dates.`);
  }

  if (missingDates.length === 0 && existing && existing.summary && existing.layers) {
    logger.debug(`Frontline daily history is complete and up to date (${allDates.length} days cached, 0 invalidated).`);
    const enrichedTimeline = enrichTimelineWithDeltas(Object.values(existingTimeline));
    const prevTimeline = existing.timeline;
    const hasDeltaMismatch = enrichedTimeline.some((pt, idx) => pt.deltaKm2 !== prevTimeline[idx]?.deltaKm2);
    const hasMetaUpdate = isInitialMetaMigration || !existing.meta?.revisions;
    if (wasRepaired || hasDeltaMismatch || hasMetaUpdate) {
      const normalizedDays = normalizeDaysWithYearRefs(existingDays);
      const latestPt = enrichedTimeline[enrichedTimeline.length - 1];
      const latestDateKey = latestPt?.date || existing.summary.latestDate;
      let latestLayers = existing.layers;
      const latestEntry = normalizedDays[latestDateKey];
      if (latestEntry) {
        let resolved: DayFrontlineEntry | undefined = latestEntry;
        let depth = 0;
        while (resolved && 'ref' in resolved && depth < 50) {
          resolved = normalizedDays[resolved.ref];
          depth++;
        }
        if (resolved && 'c' in resolved) {
          latestLayers = {
            consensusRf: decodeMultiPolygon(resolved.c),
            disputed: decodeMultiPolygon(resolved.d),
            deepstate: decodeMultiPolygon(resolved.ds),
            lostarmour: decodeMultiPolygon(resolved.la),
          };
        }
      }
      existing = {
        summary: {
          ...existing.summary,
          latestDate: latestDateKey,
          consensusRfKm2: latestPt?.consensusRfKm2 ?? existing.summary.consensusRfKm2,
          consensusUaKm2: latestPt?.consensusUaKm2 ?? existing.summary.consensusUaKm2,
          disputedKm2: latestPt?.disputedKm2 ?? existing.summary.disputedKm2,
          dsOccupiedKm2: latestPt?.dsOccupiedKm2 ?? existing.summary.dsOccupiedKm2,
          dsGreyKm2: latestPt?.dsGreyKm2 ?? existing.summary.dsGreyKm2,
          laClaimedKm2: latestPt?.laClaimedKm2 ?? existing.summary.laClaimedKm2,
        },
        timeline: enrichedTimeline,
        layers: latestLayers,
        days: normalizedDays,
        meta: {
          revisions,
        },
      };
      await writeJsonAsyncToR2(DATA_FRONTLINE_PATH, existing);
    }
    await exportFrontlineHistory(existing.days || {});
    return existing;
  }

  if (forceUpdate) {
    logger.info(`Force update (-u) active: re-processing all ${missingDates.length} daily frontline entries from ${BASELINE_DATE}...`);
  } else {
    logger.info(`Processing ${missingDates.length} missing/updated daily frontline entries (${allDates.length} total from ${BASELINE_DATE})...`);
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const dsGeoCache = new Map<number, { features?: GeoJsonFeature[] }>();

  /** Helper to process a single date */
  const processDate = async (date: string) => {
    try {
      const hasLa = date >= LA_START_DATE;
      const isBaseline = date === BASELINE_DATE;

      // 1. Fetch LA KML only if date is within LostArmour coverage period
      let laKml = '';
      if (hasLa) {
        const laRes = await fetchWithRetry(`https://lostarmour.info/mapinfo/kml/${date}.kml`, {
          headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://lostarmour.info/map' },
          retries: 2,
          timeoutMs: 15000,
        });
        if (!laRes.ok) return null;
        laKml = await laRes.text();
      }

      // 2. Resolve DS revision via LOCF (or earliest revision for baseline)
      const dsInfo = resolveDsInfo(date);
      const revId = dsInfo?.id;
      if (!revId) return null;

      let dsGeo = dsGeoCache.get(revId);
      if (!dsGeo) {
        const dsRes = await fetchWithRetry(`https://deepstatemap.live/api/history/${revId}/geojson`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          retries: 2,
          timeoutMs: 15000,
        });
        if (!dsRes.ok) return null;
        dsGeo = (await dsRes.json()) as { features?: GeoJsonFeature[] };
        dsGeoCache.set(revId, dsGeo);
      }

      // 3. Parse DS polygons
      const features = dsGeo.features || [];
      const dsOccupiedPolys: MultiPolygon = [];
      const dsGreyPolys: MultiPolygon = [];
      const dsCrimeaPolys: MultiPolygon = [];

      for (const f of features) {
        if (isBaseline) {
          if (isPre2022BaselineFeature(f)) {
            dsOccupiedPolys.push(...featureToPolygons(f));
          }
          continue;
        }

        const name = f.properties?.name;
        const fill = f.properties?.fill;
        if (isCrimeaTerritoryFeature(f)) {
          dsCrimeaPolys.push(...featureToPolygons(f));
        }
        if (isOccupiedFeature(name, fill)) {
          dsOccupiedPolys.push(...featureToPolygons(f));
        } else if (isGreyFeature(name, fill)) {
          dsGreyPolys.push(...featureToPolygons(f));
        }
      }

      const dsOccupiedUnion = polygonClipping.union(dsOccupiedPolys as polygonClipping.Geom) as MultiPolygon;
      const dsGreyUnion = dsGreyPolys.length > 0 ? (polygonClipping.union(dsGreyPolys as polygonClipping.Geom) as MultiPolygon) : [];
      const dsCrimeaUnion = dsCrimeaPolys.length > 0 ? (polygonClipping.union(dsCrimeaPolys as polygonClipping.Geom) as MultiPolygon) : [];

      let cleanC: MultiPolygon;
      let cleanD: MultiPolygon;
      let cleanDS: MultiPolygon;
      let cleanLA: MultiPolygon = [];

      if (!hasLa) {
        // DeepState-only / Baseline period (prior to 2023-01-28)
        cleanC = simplifyMultiPolygon(dsOccupiedUnion, RDP_EPSILON, 0.05);
        cleanD = isBaseline ? [] : simplifyMultiPolygon(dsGreyUnion, RDP_EPSILON, 0.3).filter((poly) => !isCrimeaPolygon(poly));
        let dsFrontline: MultiPolygon;
        try {
          dsFrontline = dsGreyUnion.length > 0 ? (polygonClipping.union([...dsOccupiedUnion, ...dsGreyUnion] as polygonClipping.Geom) as MultiPolygon) : dsOccupiedUnion;
        } catch {
          dsFrontline = [...dsOccupiedUnion, ...dsGreyUnion];
        }
        cleanDS = simplifyMultiPolygon(dsFrontline, RDP_EPSILON, 0.05);
      } else {
        // Dual consensus period (from 2023-01-28 onwards)
        const laDoc = parser.parse(laKml);
        const rawPlacemarks = laDoc?.kml?.Document?.Folder?.Placemark || [];
        const laPlacemarks: KmlPlacemark[] = Array.isArray(rawPlacemarks) ? rawPlacemarks : [rawPlacemarks];
        const laPolys = laPlacemarks.filter((p) => p.Polygon && (p.Polygon?.outerBoundaryIs?.LinearRing?.coordinates || '').trim().length > 100 && !isLaCrimeaPlacemark(p));

        const laMultiPoly: MultiPolygon = [];
        for (const p of laPolys) {
          const rawCoords = (p.Polygon?.outerBoundaryIs?.LinearRing?.coordinates || '').trim().split(/\s+/);
          const ring: Pair[] = rawCoords
            .map((pair: string) => {
              const [lon, lat] = pair.split(',').map(Number);
              return [lon, lat] as Pair;
            })
            .filter((pt) => !Number.isNaN(pt[0]) && !Number.isNaN(pt[1]));
          const cleaned = cleanRing(ring);
          if (cleaned.length >= 4 && isRingInTheaterBounds(cleaned)) laMultiPoly.push([cleaned]);
        }

        if (dsCrimeaPolys.length > 0) {
          laMultiPoly.push(...dsCrimeaPolys);
        }

        const laUnion = polygonClipping.union(laMultiPoly as polygonClipping.Geom) as MultiPolygon;

        let consensusRf = polygonClipping.intersection(laUnion as polygonClipping.Geom, dsOccupiedUnion as polygonClipping.Geom) as MultiPolygon;
        if (dsCrimeaUnion.length > 0) {
          try {
            consensusRf = polygonClipping.union([...consensusRf, ...dsCrimeaUnion] as polygonClipping.Geom) as MultiPolygon;
          } catch {
            consensusRf = [...consensusRf, ...dsCrimeaUnion];
          }
        }

        const xorDisputed = polygonClipping.xor(laUnion as polygonClipping.Geom, dsOccupiedUnion as polygonClipping.Geom) as MultiPolygon;
        let disputed: MultiPolygon;
        try {
          disputed = polygonClipping.union([...xorDisputed, ...dsGreyUnion] as polygonClipping.Geom) as MultiPolygon;
        } catch {
          disputed = [...xorDisputed, ...dsGreyUnion];
        }

        let dsFrontline: MultiPolygon;
        try {
          dsFrontline = polygonClipping.union([...dsOccupiedUnion, ...dsGreyUnion] as polygonClipping.Geom) as MultiPolygon;
        } catch {
          dsFrontline = [...dsOccupiedUnion, ...dsGreyUnion];
        }

        cleanC = simplifyMultiPolygon(consensusRf, RDP_EPSILON, 0.05);
        cleanD = simplifyMultiPolygon(disputed, RDP_EPSILON, 0.3).filter((poly) => !isCrimeaPolygon(poly));
        cleanDS = simplifyMultiPolygon(dsFrontline, RDP_EPSILON, 0.05);
        cleanLA = simplifyMultiPolygon(laUnion, RDP_EPSILON, 0.05);
      }

      const consensusRfKm2 = round(getMultiPolyAreaKm2(cleanC), 1);
      const disputedKm2 = round(getMultiPolyAreaKm2(cleanD), 1);
      const laClaimedKm2 = hasLa ? round(getMultiPolyAreaKm2(cleanLA), 1) : 0;
      const dsOccupiedKm2 = round(getMultiPolyAreaKm2(dsOccupiedUnion), 1);
      const dsGreyKm2 = round(getMultiPolyAreaKm2(dsGreyUnion), 1);
      const consensusUaKm2 = round(Math.max(0, UKRAINE_TOTAL_KM2 - consensusRfKm2 - disputedKm2), 1);

      const point: FrontlineTimelinePoint = {
        date,
        consensusRfKm2,
        consensusUaKm2,
        disputedKm2,
        laClaimedKm2,
        dsOccupiedKm2,
        dsGreyKm2,
        deltaKm2: 0,
      };

      const encLayers: EncodedFrontlineLayers = {
        c: encodeMultiPolygon(cleanC),
        d: encodeMultiPolygon(cleanD),
        ds: encodeMultiPolygon(cleanDS),
        la: encodeMultiPolygon(cleanLA),
      };

      return {
        date,
        point,
        rawLayers: {
          consensusRf: cleanC as FrontlineMultiPolygonCoords,
          disputed: cleanD as FrontlineMultiPolygonCoords,
          deepstate: cleanDS as FrontlineMultiPolygonCoords,
          lostarmour: cleanLA as FrontlineMultiPolygonCoords,
        },
        encLayers,
      };
    } catch (err: unknown) {
      logger.warn(`Failed to process frontline for date ${date}:`, err instanceof Error ? err.message : String(err));
      return null;
    }
  };

  // Process missing dates in chunks of 24
  const CHUNK_SIZE = 24;
  let processedCount = 0;
  let lastRawLayers: FrontlineMapLayers | null = null;
  let lastProcessedDate = '';
  let prevSerialized = '';
  let prevDate = '';

  for (let i = 0; i < missingDates.length; i += CHUNK_SIZE) {
    const chunk = missingDates.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map(processDate));

    for (const res of chunkResults) {
      if (!res) continue;
      const { date, point, rawLayers, encLayers } = res;
      lastRawLayers = rawLayers;
      lastProcessedDate = date;
      existingTimeline[date] = point;

      const serialized = JSON.stringify(encLayers);
      if (serialized === prevSerialized && prevDate && date.slice(0, 4) === prevDate.slice(0, 4)) {
        existingDays[date] = { ref: prevDate };
      } else {
        existingDays[date] = encLayers;
        prevSerialized = serialized;
        prevDate = date;
      }

      // Record fresh metadata fingerprint for processed date
      const dsInfo = resolveDsInfo(date);
      const laEtag = laEtagMap.get(date);
      revisions[date] = {
        ds: dsInfo?.updatedAt,
        la: date >= LA_START_DATE ? laEtag : undefined,
      };
    }

    processedCount += chunk.length;
    if (processedCount % 60 === 0 || processedCount === missingDates.length) {
      logger.info(`Frontline history progress: ${processedCount}/${missingDates.length} days processed...`);
      // Periodic checkpoint
      const intermediateTimeline = enrichTimelineWithDeltas(Object.values(existingTimeline));
      const latestPoint = intermediateTimeline[intermediateTimeline.length - 1];
      if (latestPoint && (existing?.layers || lastRawLayers)) {
        await writeJsonAsyncToR2(DATA_FRONTLINE_PATH, {
          summary: {
            latestDate: latestPoint.date,
            totalUkraineKm2: UKRAINE_TOTAL_KM2,
            consensusRfKm2: latestPoint.consensusRfKm2,
            consensusUaKm2: latestPoint.consensusUaKm2,
            disputedKm2: latestPoint.disputedKm2,
            dsOccupiedKm2: latestPoint.dsOccupiedKm2,
            dsGreyKm2: latestPoint.dsGreyKm2,
            dsLiberatedKm2: 0,
            laClaimedKm2: latestPoint.laClaimedKm2,
            discrepancies: {
              laClaimsLiberatedKm2: 0,
              laClaimsGreyKm2: 0,
              laClaimsUaKm2: 0,
              dsClaimsOccupiedKm2: 0,
              neutralGreyKm2: 0,
            },
          },
          timeline: intermediateTimeline,
          layers: existing?.layers || lastRawLayers!,
          days: existingDays,
          meta: {
            revisions,
          },
        });
      }
    }
  }

  // 3. Assemble complete final timeline
  const finalTimeline = enrichTimelineWithDeltas(Object.values(existingTimeline));
  const finalLatestDate = finalTimeline.length > 0 ? finalTimeline[finalTimeline.length - 1].date : latestDate;
  const latestPoint = finalTimeline[finalTimeline.length - 1];

  // Sort and normalize daily layer entries chronologically with year-scoped refs
  const sortedDays = normalizeDaysWithYearRefs(existingDays);

  // Decode latest raw layers from normalized sortedDays (or use lastRawLayers if just processed)
  let finalLayers = lastProcessedDate === finalLatestDate ? lastRawLayers : null;

  if (!finalLayers && sortedDays[finalLatestDate]) {
    let entry: DayFrontlineEntry = sortedDays[finalLatestDate];
    let depth = 0;
    while (entry && 'ref' in entry && depth < 50) {
      entry = sortedDays[entry.ref];
      depth++;
    }
    if (entry) {
      if ('consensusRf' in entry) {
        finalLayers = entry;
      } else if ('c' in entry) {
        finalLayers = {
          consensusRf: decodeMultiPolygon(entry.c),
          disputed: decodeMultiPolygon(entry.d),
          deepstate: decodeMultiPolygon(entry.ds),
          lostarmour: decodeMultiPolygon(entry.la),
        };
      }
    }
  }

  if (!finalLayers) {
    finalLayers = existing?.layers || lastRawLayers!;
  }

  const summary: FrontlineSummary = {
    latestDate: finalLatestDate,
    totalUkraineKm2: UKRAINE_TOTAL_KM2,
    consensusRfKm2: latestPoint?.consensusRfKm2 || 0,
    consensusUaKm2: latestPoint?.consensusUaKm2 || 0,
    disputedKm2: latestPoint?.disputedKm2 || 0,
    dsOccupiedKm2: latestPoint?.dsOccupiedKm2 || 0,
    dsGreyKm2: latestPoint?.dsGreyKm2 || 0,
    dsLiberatedKm2: 0,
    laClaimedKm2: latestPoint?.laClaimedKm2 || 0,
    discrepancies: existing?.summary?.discrepancies || {
      laClaimsLiberatedKm2: 0,
      laClaimsGreyKm2: 0,
      laClaimsUaKm2: 0,
      dsClaimsOccupiedKm2: 0,
      neutralGreyKm2: 0,
    },
  };

  const finalDataset: WarFrontlineDataset = {
    summary,
    timeline: finalTimeline,
    layers: finalLayers,
    days: sortedDays,
    meta: {
      revisions,
    },
  };

  logger.info(`Saving complete daily frontline dataset (${finalTimeline.length} days, latest: ${finalLatestDate})...`);
  await writeJsonAsyncToR2(DATA_FRONTLINE_PATH, finalDataset);

  logger.info('Exporting yearly frontline history bundles to site/public/data/war-rf-ua/frontline-history-*.json...');
  await exportFrontlineHistory(sortedDays);

  return finalDataset;
}

/** Exports daily frontline layers partitioned by year directly to site/public/data/war-rf-ua/frontline-history-*.json. */
async function exportFrontlineHistory(days: Record<string, DayFrontlineEntry>): Promise<void> {
  const normalizedDays = normalizeDaysWithYearRefs(days);
  const byYear: Record<string, Record<string, DayFrontlineEntry>> = {};
  for (const [date, entry] of Object.entries(normalizedDays)) {
    const year = date.slice(0, 4);
    if (!byYear[year]) byYear[year] = {};
    byYear[year][date] = entry;
  }

  for (const [year, yearDays] of Object.entries(byYear)) {
    await writeJsonAsyncToSite(`war-rf-ua/frontline-history-${year}.json`, yearDays);
  }
}

if (import.meta.main) {
  runWithLogger('war-rf-ua', () => parseFrontline(isUpdate()), isVerbose()).catch((err) => {
    getLogger('war-rf-ua').error('Fatal error in parse-frontline:', err);
    process.exit(1);
  });
}
