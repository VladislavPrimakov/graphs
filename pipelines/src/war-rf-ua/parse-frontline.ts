import { dirname, join } from 'node:path';
import type {
  DayFrontlineEntry,
  EncodedFrontlineLayers,
  FrontlineMapLayers,
  FrontlineMultiPolygonCoords,
  FrontlineSummary,
  FrontlineTimelinePoint,
  WarFrontlineDataset,
} from '@graphs/types/war-rf-ua/frontline-map';
import { XMLParser } from 'fast-xml-parser';
import polygonClipping from 'polygon-clipping';
import { ensureDir, fileExists, readJson, writeJson } from '@/utils/fs';
import { getLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { round } from '@/utils/math';
import { getSiteSectionDataPath, PIPELINES_SRC_DIR } from '@/utils/paths';

const DATA_FRONTLINE_PATH = join(PIPELINES_SRC_DIR, 'war-rf-ua', 'data-frontline.json');
const FRONTLINE_HISTORY_PATH = getSiteSectionDataPath('war-rf-ua', 'frontline-map', 'frontline-history.json');
const UKRAINE_TOTAL_KM2 = 603628;
const START_DATE = '2023-01-28';
const RDP_EPSILON = 0.0015;

type Pair = [number, number];
type Ring = Pair[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

/** Computes geodesic area of a polygon ring on the WGS-84 sphere in km². */
function ringAreaKm2(ring: Pair[]): number {
  const R = 6378.137;
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
  if (ring.length < 4) return ring;
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
  return simplified.map((p) => [Math.round(p[0] * factor) / factor, Math.round(p[1] * factor) / factor]);
};

/** Simplifies MultiPolygon rings and filters out sub-pixel slivers. */
const simplifyMultiPolygon = (mp: MultiPolygon, epsilon = RDP_EPSILON, minAreaKm2 = 0.05, precision = 4): MultiPolygon => {
  return mp
    .filter((poly) => poly && poly.length > 0 && ringAreaKm2(poly[0]) >= minAreaKm2)
    .map((poly) => poly.map((ring) => simplifyRing(ring, epsilon, precision)).filter((ring) => ring.length >= 4))
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

interface GeoJsonFeature {
  type?: string;
  properties?: { name?: string; description?: string };
  geometry?: {
    type?: string;
    coordinates?: Pair[][] | Pair[][][];
  };
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
function isOccupiedFeature(name?: string): boolean {
  if (!name) return false;
  if (name.includes('geoJSON.status.occupied') || name.includes('geoJSON.territories.crimea') || name.includes('geoJSON.territories.ordlo')) {
    return true;
  }
  if (name.includes('Окуповано') || name.includes('Occupied Crimea') || name.includes('ОРДЛО')) {
    if (
      name.includes('Салла') ||
      name.includes('Естонії') ||
      name.includes('Латвії') ||
      name.includes('Курильські') ||
      name.includes('Цхінвальський') ||
      name.includes('Абхазія') ||
      name.includes('Пруссія') ||
      name.includes('Карелії') ||
      name.includes('Ічкерія') ||
      name.includes('Тузла')
    ) {
      return false;
    }
    return true;
  }
  return false;
}

/** Identifies if a DeepState feature represents Crimea territory. */
function isCrimeaTerritoryFeature(f: GeoJsonFeature): boolean {
  if (!f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) return false;
  const name = f.properties?.name || '';
  if (name.includes('Кримськ') || name.includes('міст') || name.includes('Bridge') || name.includes('airfield')) {
    return false;
  }
  return name.includes('geoJSON.territories.crimea') || name.includes('Окупований Крим') || name.includes('Occupied Crimea') || name === 'Крим';
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
function isGreyFeature(name?: string): boolean {
  if (!name) return false;
  return name.includes('geoJSON.status.unknown') || name.includes('Unknown status') || name.includes('Статус невідомий');
}

/** Converts GeoJSON Feature geometry into standard MultiPolygon rings. */
function featureToPolygons(f: GeoJsonFeature): MultiPolygon {
  const g = f.geometry;
  if (!g?.coordinates) return [];
  if (g.type === 'Polygon') {
    const rings = (g.coordinates as Pair[][]).map(cleanRing).filter((r) => r.length >= 4);
    return rings.length > 0 ? [rings] : [];
  }
  if (g.type === 'MultiPolygon') {
    const polys: Polygon[] = [];
    for (const p of g.coordinates as Pair[][][]) {
      const rings = p.map(cleanRing).filter((r) => r.length >= 4);
      if (rings.length > 0) polys.push(rings);
    }
    return polys;
  }
  return [];
}

/** Generates sequence of YYYY-MM-DD date strings between start and end inclusive. */
function generateDateRange(startStr: string, endStr: string): string[] {
  const dates: string[] = [];
  const curr = new Date(startStr);
  const end = new Date(endStr);
  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

/** Enriches timeline points with day-over-day consensus territorial change, filtering out upstream glitch artifacts. */
function enrichTimelineWithDeltas(timeline: FrontlineTimelinePoint[]): FrontlineTimelinePoint[] {
  const sorted = [...timeline].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((point, i, arr) => {
    if (i === 0) return { ...point, deltaKm2: 0 };
    const prev = arr[i - 1];
    const rawDelta = round(point.consensusRfKm2 - prev.consensusRfKm2, 1);
    const deltaKm2 = Math.abs(rawDelta) > 1000 ? 0 : rawDelta;
    return { ...point, deltaKm2 };
  });
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

  // Fast-path: Return cached dataset immediately on standard builds if snapshot is valid
  if (!forceUpdate && existing && existing.summary && existing.layers && existing.timeline && existing.timeline.length > 0 && existing.days) {
    logger.debug(`Frontline daily history is complete and up to date (${existing.timeline.length} days cached).`);
    const needsDeltaEnrichment = existing.timeline.length > 1 && typeof existing.timeline[1].deltaKm2 !== 'number';
    if (needsDeltaEnrichment) {
      existing.timeline = enrichTimelineWithDeltas(existing.timeline);
      await writeJson(DATA_FRONTLINE_PATH, existing, 0);
    }
    if (!(await fileExists(FRONTLINE_HISTORY_PATH))) {
      logger.debug('Public frontline history bundle missing, exporting to site/public/data/war-rf-ua/frontline-map/frontline-history.json...');
      await exportFrontlineHistory(existing.days);
    }
    return existing;
  }

  // 1. Fetch LostArmour metadata for latest available date
  logger.debug('Fetching latest LostArmour frontline metadata...');
  let latestDate = new Date().toISOString().slice(0, 10);
  try {
    const laMetaRes = await fetch('https://lostarmour.info/panel/next/api/public/map/kml-meta', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Referer: 'https://lostarmour.info/map',
      },
    });
    if (laMetaRes.ok) {
      const meta = (await laMetaRes.json()) as { date?: string };
      if (meta?.date) latestDate = meta.date;
    }
  } catch (err) {
    logger.warn('Failed to fetch LostArmour metadata, defaulting to current date:', err);
  }

  // 2. Fetch DeepState public history revisions
  logger.debug('Fetching DeepState public revision history...');
  const dsHistRes = await fetch('https://deepstatemap.live/api/history/public', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!dsHistRes.ok) throw new Error(`Failed to fetch DeepState revisions: HTTP ${dsHistRes.status}`);
  const dsRevisions = (await dsHistRes.json()) as { id: number; createdAt: string }[];

  const revByDate = new Map<string, number>();
  for (const r of dsRevisions) {
    const dateStr = r.createdAt.slice(0, 10);
    revByDate.set(dateStr, r.id);
  }

  const allDates = generateDateRange(START_DATE, latestDate);
  const existingDays: Record<string, DayFrontlineEntry> = forceUpdate ? {} : existing?.days || {};
  const existingTimeline: Record<string, FrontlineTimelinePoint> = {};
  if (!forceUpdate && existing?.timeline) {
    for (const p of existing.timeline) {
      existingTimeline[p.date] = p;
    }
  }

  // Determine missing dates (all dates when forceUpdate is active, otherwise only genuinely missing dates)
  const missingDates = forceUpdate ? allDates : allDates.filter((d) => !existingDays[d] || !existingTimeline[d] || (existingTimeline[d]?.laClaimedKm2 ?? 0) < 100000);

  if (missingDates.length === 0 && existing && existing.summary && existing.layers) {
    logger.debug(`Frontline daily history is complete and up to date (${allDates.length} days cached).`);
    const needsDeltaEnrichment = existing.timeline.length > 1 && typeof existing.timeline[1].deltaKm2 !== 'number';
    if (needsDeltaEnrichment) {
      existing.timeline = enrichTimelineWithDeltas(existing.timeline);
      await writeJson(DATA_FRONTLINE_PATH, existing, 0);
    }
    if (!(await fileExists(FRONTLINE_HISTORY_PATH))) {
      logger.debug('Public frontline history bundle missing, exporting to site/public/data/war-rf-ua/frontline-map/frontline-history.json...');
      await exportFrontlineHistory(existingDays);
    }
    return existing;
  }

  if (forceUpdate) {
    logger.info(`Force update (-u) active: re-processing all ${missingDates.length} daily frontline entries from ${START_DATE}...`);
  } else {
    logger.info(`Processing ${missingDates.length} missing daily frontline entries (${allDates.length} total from ${START_DATE})...`);
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const dsGeoCache = new Map<number, { features?: GeoJsonFeature[] }>();

  /** Helper to process a single date */
  const processDate = async (date: string) => {
    try {
      // Fetch LA KML
      const laRes = await fetch(`https://lostarmour.info/mapinfo/kml/${date}.kml`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://lostarmour.info/map' },
      });
      if (!laRes.ok) return null;
      const laKml = await laRes.text();

      // Resolve DS revision via LOCF
      let revId = revByDate.get(date);
      if (!revId) {
        const pDates = Array.from(revByDate.keys())
          .filter((x) => x <= date)
          .sort();
        revId = revByDate.get(pDates[pDates.length - 1]);
      }
      if (!revId) return null;

      let dsGeo = dsGeoCache.get(revId);
      if (!dsGeo) {
        const dsRes = await fetch(`https://deepstatemap.live/api/history/${revId}/geojson`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (!dsRes.ok) return null;
        dsGeo = (await dsRes.json()) as { features?: GeoJsonFeature[] };
        dsGeoCache.set(revId, dsGeo);
      }

      // Parse LA placemarks, filtering out duplicate Crimea placemarks to use DeepState canonical Crimea
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
        if (cleaned.length >= 4) laMultiPoly.push([cleaned]);
      }

      // Parse DS polygons
      const features = dsGeo.features || [];
      const dsOccupiedPolys: MultiPolygon = [];
      const dsGreyPolys: MultiPolygon = [];
      const dsCrimeaPolys: MultiPolygon = [];
      for (const f of features) {
        const name = f.properties?.name || '';
        if (isCrimeaTerritoryFeature(f)) {
          dsCrimeaPolys.push(...featureToPolygons(f));
        }
        if (isOccupiedFeature(name)) {
          dsOccupiedPolys.push(...featureToPolygons(f));
        } else if (isGreyFeature(name)) {
          dsGreyPolys.push(...featureToPolygons(f));
        }
      }

      // Canonical DeepState Crimea is included in both sources
      if (dsCrimeaPolys.length > 0) {
        laMultiPoly.push(...dsCrimeaPolys);
      }

      const laUnion = polygonClipping.union(laMultiPoly as polygonClipping.Geom) as MultiPolygon;
      const dsOccupiedUnion = polygonClipping.union(dsOccupiedPolys as polygonClipping.Geom) as MultiPolygon;
      const dsGreyUnion = polygonClipping.union(dsGreyPolys as polygonClipping.Geom) as MultiPolygon;
      const dsCrimeaUnion = dsCrimeaPolys.length > 0 ? (polygonClipping.union(dsCrimeaPolys as polygonClipping.Geom) as MultiPolygon) : [];

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

      const cleanC = simplifyMultiPolygon(consensusRf, RDP_EPSILON, 0.05);
      const cleanD = simplifyMultiPolygon(disputed, RDP_EPSILON, 0.3).filter((poly) => !isCrimeaPolygon(poly));
      const cleanDS = simplifyMultiPolygon(dsFrontline, RDP_EPSILON, 0.05);
      const cleanLA = simplifyMultiPolygon(laUnion, RDP_EPSILON, 0.05);

      const consensusRfKm2 = round(getMultiPolyAreaKm2(cleanC), 1);
      const disputedKm2 = round(getMultiPolyAreaKm2(cleanD), 1);
      const laClaimedKm2 = round(getMultiPolyAreaKm2(cleanLA), 1);
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
  let prevSerialized = '';
  let prevDate = '';

  for (let i = 0; i < missingDates.length; i += CHUNK_SIZE) {
    const chunk = missingDates.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(chunk.map(processDate));

    for (const res of chunkResults) {
      if (!res) continue;
      const { date, point, rawLayers, encLayers } = res;
      lastRawLayers = rawLayers;
      existingTimeline[date] = point;

      const serialized = JSON.stringify(encLayers);
      if (serialized === prevSerialized && prevDate) {
        existingDays[date] = { ref: prevDate };
      } else {
        existingDays[date] = encLayers;
        prevSerialized = serialized;
        prevDate = date;
      }
    }

    processedCount += chunk.length;
    if (processedCount % 60 === 0 || processedCount === missingDates.length) {
      logger.info(`Frontline history progress: ${processedCount}/${missingDates.length} days processed...`);
      // Periodic checkpoint
      const intermediateTimeline = enrichTimelineWithDeltas(Object.values(existingTimeline));
      const latestPoint = intermediateTimeline[intermediateTimeline.length - 1];
      if (latestPoint && lastRawLayers) {
        await writeJson(
          DATA_FRONTLINE_PATH,
          {
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
            layers: lastRawLayers,
            days: existingDays,
          },
          0,
        );
      }
    }
  }

  // 3. Assemble complete final timeline
  const finalTimeline = enrichTimelineWithDeltas(Object.values(existingTimeline));
  const finalLatestDate = finalTimeline.length > 0 ? finalTimeline[finalTimeline.length - 1].date : latestDate;
  const latestPoint = finalTimeline[finalTimeline.length - 1];

  // If latest raw layers are not in memory, use existing or decode
  let finalLayers = lastRawLayers || existing?.layers;
  if (!finalLayers && existingDays[finalLatestDate] && !('ref' in existingDays[finalLatestDate])) {
    const enc = existingDays[finalLatestDate] as EncodedFrontlineLayers;
    finalLayers = {
      consensusRf: decodeMultiPolygon(enc.c),
      disputed: decodeMultiPolygon(enc.d),
      deepstate: decodeMultiPolygon(enc.ds),
      lostarmour: decodeMultiPolygon(enc.la),
    };
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
    layers: finalLayers!,
    days: existingDays,
  };

  logger.info(`Saving complete daily frontline dataset (${finalTimeline.length} days, latest: ${finalLatestDate})...`);
  await writeJson(DATA_FRONTLINE_PATH, finalDataset, 0);

  logger.info('Exporting frontline history bundle to site/public/data/war-rf-ua/frontline-map/frontline-history.json...');
  await exportFrontlineHistory(existingDays);

  return finalDataset;
}

/** Exports all daily frontline layers as a single compact JSON bundle to site/public/data/war-rf-ua/frontline-map/frontline-history.json */
async function exportFrontlineHistory(days: Record<string, DayFrontlineEntry>): Promise<void> {
  await ensureDir(dirname(FRONTLINE_HISTORY_PATH));
  await writeJson(FRONTLINE_HISTORY_PATH, days, 0);
}

if (import.meta.main) {
  runWithLogger('war-rf-ua', () => parseFrontline(isUpdate()), isVerbose()).catch((err) => {
    getLogger('war-rf-ua').error('Fatal error in parse-frontline:', err);
    process.exit(1);
  });
}
