import type { FrontlineMultiPolygonCoords } from '@graphs/types/war-rf-ua/frontline-map';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { type FillLayerSpecification, type LineLayerSpecification, type Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// Configure bundled MapLibre Web Worker for Vite
setWorkerUrl(workerUrl);

/** Standard tile styles provided by OpenFreeMap. */
const MAP_TILE_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  light: 'https://tiles.openfreemap.org/styles/positron',
} as const;

/** Resolves MapLibre style URI based on active theme. */
export function getMapTileStyle(theme: 'dark' | 'light'): string {
  return theme === 'dark' ? MAP_TILE_STYLES.dark : MAP_TILE_STYLES.light;
}

/** Standard Ukraine theater coordinate bounding box and center presets. */
export const UKRAINE_MAP_PRESETS = {
  center: [36.5, 48.3] as [number, number],
  zoom: 6,
  minZoom: 3,
  maxZoom: 18,
  bounds: [
    [22.0, 44.2],
    [40.3, 52.4],
  ] as [[number, number], [number, number]],
} as const;

/** Registers procedural canvas dot fallback for missing OpenFreeMap town icons. */
export function registerFallbackDot(map: MapLibreMap, dotColor: string): void {
  const addDot = (id: string) => {
    if (map.hasImage(id)) return;
    const size = 12;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
      ctx.fillStyle = dotColor;
      ctx.fill();
      const imgData = ctx.getImageData(0, 0, size, size);
      if (!map.hasImage(id)) map.addImage(id, imgData);
    }
  };

  map.setMissingStyleImageResolver(addDot);
  map.on('styleimagemissing', (e) => addDot(e.id));
  map.on('style.load', () => addDot('circle-11'));
}

/** Converts raw MultiPolygon coordinates into standard GeoJSON FeatureCollection. */
export function multiPolygonToGeoJson(coords: FrontlineMultiPolygonCoords, properties: Record<string, unknown> = {}): FeatureCollection<Polygon | MultiPolygon> {
  if (!coords || coords.length === 0) {
    return { type: 'FeatureCollection', features: [] };
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'MultiPolygon',
          coordinates: coords,
        },
        properties,
      },
    ],
  };
}

/** Creates a declarative MapLibre fill layer specification. */
export function createFillLayer(id: string, source: string, color: string, opacity = 0.4): FillLayerSpecification {
  return {
    id,
    type: 'fill',
    source,
    paint: {
      'fill-color': color,
      'fill-opacity': opacity,
    },
  };
}

/** Creates a declarative MapLibre line stroke layer specification. */
export function createLineLayer(id: string, source: string, color: string, width = 2, opacity = 0.9, dasharray?: number[]): LineLayerSpecification {
  return {
    id,
    type: 'line',
    source,
    paint: {
      'line-color': color,
      'line-width': width,
      'line-opacity': opacity,
      ...(dasharray ? { 'line-dasharray': dasharray } : {}),
    },
  };
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
export function decodePolylineRing(str: string, factor = 1e4): [number, number][] {
  const points: [number, number][] = [];
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
export function decodeMultiPolygon(encoded: string[][], factor = 1e4): FrontlineMultiPolygonCoords {
  return encoded.map((poly) => poly.map((ring) => decodePolylineRing(ring, factor)));
}
