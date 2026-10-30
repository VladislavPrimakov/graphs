import { type GeoJSONSource, Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import type React from 'react';
import { useEffect, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DayFrontlineEntry, FrontlineMapLayers, FrontlineMapSectionData, FrontlineTimelinePoint } from '@graphs/shared/types/war-rf-ua/frontline';
import { useSectionResize } from '@/components/sections/Section';
import { createFillLayer, createLineLayer, decodeMultiPolygon, getMapTileStyle, multiPolygonToGeoJson, registerFallbackDot, UKRAINE_MAP_PRESETS } from '@/utils/map-builder';
import { useFormat, useTheme } from '@/utils/provider';
import type { dict as enDict } from '../locales/dict-en';
import { frontlineColors } from '../tokens';

interface FrontlineMapProps {
  data: FrontlineMapSectionData;
  history: Record<string, DayFrontlineEntry>;
  targetDate?: string;
  t: typeof enDict;
}

const EMPTY_LAYERS: FrontlineMapLayers = {
  consensusRf: [],
  disputed: [],
  deepstate: [],
  lostarmour: [],
};

/** Resolves and decodes layers for a target date from history bundle, traversing reference chains. */
function resolveHistoryDayLayers(days: Record<string, DayFrontlineEntry>, targetDate: string): FrontlineMapLayers {
  let entry = days[targetDate];
  let depth = 0;
  while (entry && 'ref' in entry && depth < 20) {
    entry = days[entry.ref];
    depth++;
  }
  if (!entry || 'ref' in entry) return EMPTY_LAYERS;
  if ('consensusRf' in entry) return entry;
  return {
    consensusRf: decodeMultiPolygon(entry.c),
    disputed: decodeMultiPolygon(entry.d),
    deepstate: decodeMultiPolygon(entry.ds),
    lostarmour: decodeMultiPolygon(entry.la),
  };
}

/** Updates MapLibre vector GeoJSON sources with the decoded frontline layers. */
function applyFrontlineLayers(map: MapLibreMap | null, layers: FrontlineMapLayers): void {
  if (!map?.getSource('consensus-rf')) return;

  const consensusSource = map.getSource('consensus-rf') as GeoJSONSource | undefined;
  if (consensusSource) {
    consensusSource.setData(multiPolygonToGeoJson(layers.consensusRf));
  }
  const disputedSource = map.getSource('disputed') as GeoJSONSource | undefined;
  if (disputedSource) {
    disputedSource.setData(multiPolygonToGeoJson(layers.disputed));
  }
  const dsSource = map.getSource('deepstate') as GeoJSONSource | undefined;
  if (dsSource) {
    dsSource.setData(multiPolygonToGeoJson(layers.deepstate ?? []));
  }
  const laSource = map.getSource('lostarmour') as GeoJSONSource | undefined;
  if (laSource) {
    laSource.setData(multiPolygonToGeoJson(layers.lostarmour ?? []));
  }
}

const decodedCache = new Map<string, FrontlineMapLayers>();

/** Resolves and memoizes decoded map layers for a date across scrubbing interactions. */
function getDecodedLayers(history: Record<string, DayFrontlineEntry>, date: string): FrontlineMapLayers {
  const cached = decodedCache.get(date);
  if (cached) return cached;
  const resolved = resolveHistoryDayLayers(history, date);
  if (resolved !== EMPTY_LAYERS) {
    decodedCache.set(date, resolved);
  }
  return resolved;
}

const timelineDatesCache = new WeakMap<FrontlineTimelinePoint[], string[]>();

/** Caches immutable timeline dates per dataset to avoid GC allocations during scrubbing. */
function getTimelineDates(data: FrontlineMapSectionData): string[] {
  if (!data.timeline || data.timeline.length === 0) {
    return [data.summary.latestDate];
  }
  let cached = timelineDatesCache.get(data.timeline);
  if (!cached) {
    cached = data.timeline.map((p) => p.date);
    timelineDatesCache.set(data.timeline, cached);
  }
  return cached;
}

export const FrontlineMap: React.FC<FrontlineMapProps> = ({ data, history, targetDate: rawTargetDate, t }) => {
  const { resolvedTheme, tokens } = useTheme();
  const fmt = useFormat();

  const dates = getTimelineDates(data);
  const selectedDate = rawTargetDate ? (rawTargetDate.length === 7 ? (dates.findLast((d) => d.startsWith(rawTargetDate)) ?? rawTargetDate) : rawTargetDate) : data.summary.latestDate;

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const activeDateRef = useRef<string>(selectedDate);
  activeDateRef.current = selectedDate;
  const historyRef = useRef<Record<string, DayFrontlineEntry>>(history);
  historyRef.current = history;

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: getMapTileStyle(resolvedTheme),
      center: UKRAINE_MAP_PRESETS.center,
      zoom: UKRAINE_MAP_PRESETS.zoom,
      minZoom: UKRAINE_MAP_PRESETS.minZoom,
      maxZoom: UKRAINE_MAP_PRESETS.maxZoom,
    });

    registerFallbackDot(map, tokens.text.dim);
    map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

    map.on('load', () => {
      const activeLayers = getDecodedLayers(historyRef.current, activeDateRef.current);

      // 1. Consensus Russian control multi-polygons (Red Fill)
      map.addSource('consensus-rf', {
        type: 'geojson',
        data: multiPolygonToGeoJson(activeLayers.consensusRf),
      });
      map.addLayer(createFillLayer('consensus-rf-fill', 'consensus-rf', frontlineColors.consensusRf, 0.3));

      // 2. Disputed & Grey zone multi-polygons (Grey / Contested Fill)
      map.addSource('disputed', {
        type: 'geojson',
        data: multiPolygonToGeoJson(activeLayers.disputed),
      });
      map.addLayer(createFillLayer('disputed-fill', 'disputed', frontlineColors.disputed, 0.4));
      map.addLayer(createLineLayer('disputed-line', 'disputed', frontlineColors.disputedStroke, 1, 0.7));

      // 3. DeepState Frontline Line (Cyan / Sky)
      map.addSource('deepstate', {
        type: 'geojson',
        data: multiPolygonToGeoJson(activeLayers.deepstate ?? []),
      });
      map.addLayer(createLineLayer('deepstate-line', 'deepstate', frontlineColors.deepstateLine, 2, 0.95));

      // 4. LostArmour Frontline Line (Rose / Red Solid)
      map.addSource('lostarmour', {
        type: 'geojson',
        data: multiPolygonToGeoJson(activeLayers.lostarmour ?? []),
      });
      map.addLayer(createLineLayer('lostarmour-line', 'lostarmour', frontlineColors.lostarmourLine, 2, 0.95));
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [resolvedTheme, tokens.text.dim]);

  useSectionResize(() => {
    mapRef.current?.resize();
  });

  // Reactive layer updates when selectedDate changes (synchronous 0.8ms resolution from memory)
  useEffect(() => {
    const layers = getDecodedLayers(history, selectedDate);
    applyFrontlineLayers(mapRef.current, layers);
  }, [selectedDate, history]);

  const activePoint = data.timeline?.find((p) => p.date === selectedDate);
  const summary = activePoint
    ? {
        ...data.summary,
        consensusRfKm2: activePoint.consensusRfKm2,
        consensusUaKm2: activePoint.consensusUaKm2,
        disputedKm2: activePoint.disputedKm2,
        dsOccupiedKm2: activePoint.dsOccupiedKm2,
        dsGreyKm2: activePoint.dsGreyKm2,
        laClaimedKm2: activePoint.laClaimedKm2,
      }
    : data.summary;

  const rfPct = summary.totalUkraineKm2 > 0 ? fmt.percent((summary.consensusRfKm2 / summary.totalUkraineKm2) * 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const dispPct = summary.totalUkraineKm2 > 0 ? fmt.percent((summary.disputedKm2 / summary.totalUkraineKm2) * 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const uaPct = summary.totalUkraineKm2 > 0 ? fmt.percent((summary.consensusUaKm2 / summary.totalUkraineKm2) * 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const dsTotalKm2 = summary.dsOccupiedKm2 + summary.dsGreyKm2;
  const dsPct = summary.totalUkraineKm2 > 0 ? fmt.percent((dsTotalKm2 / summary.totalUkraineKm2) * 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  const laPct = summary.totalUkraineKm2 > 0 ? fmt.percent((summary.laClaimedKm2 / summary.totalUkraineKm2) * 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative w-full h-145 rounded-xl overflow-hidden border border-border-subtle bg-surface-base/90 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Floating Dark Glassmorphic Map Legend */}
        <div className="absolute bottom-4 left-4 z-10 glass-overlay p-3.5 text-xs max-w-90 shadow-lg flex flex-col gap-2.5 pointer-events-auto">
          <div className="font-semibold text-content-primary text-2xs uppercase tracking-wider text-accent-primary">
            {t.frontline.legendTitle} ({fmt.date(selectedDate)})
          </div>

          {/* Territorial Zones */}
          <div className="flex flex-col gap-1.5 text-2xs">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="inline-block w-3 h-3 rounded-xs shrink-0 opacity-80 border" style={{ backgroundColor: frontlineColors.consensusRf, borderColor: frontlineColors.consensusRf }} />
                <span className="truncate text-content-secondary">{t.frontline.consensusRf}</span>
              </span>
              <span className="font-medium text-content-primary shrink-0 tabular-nums">
                {fmt.number(summary.consensusRfKm2)} km² <span className="text-content-muted font-normal">({rfPct})</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="inline-block w-3 h-3 rounded-xs shrink-0 opacity-80 border" style={{ backgroundColor: frontlineColors.disputed, borderColor: frontlineColors.disputedStroke }} />
                <span className="truncate text-content-secondary">{t.frontline.disputed}</span>
              </span>
              <span className="font-medium text-content-primary shrink-0 tabular-nums">
                {fmt.number(summary.disputedKm2)} km² <span className="text-content-muted font-normal">({dispPct})</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="inline-block w-3 h-3 rounded-xs shrink-0 bg-accent-glow border" style={{ borderColor: frontlineColors.consensusUa }} />
                <span className="truncate text-content-secondary">{t.frontline.consensusUa}</span>
              </span>
              <span className="font-medium text-content-primary shrink-0 tabular-nums">
                {fmt.number(summary.consensusUaKm2)} km² <span className="text-content-muted font-normal">({uaPct})</span>
              </span>
            </div>
          </div>

          {/* Frontline Lines Section */}
          <div className="pt-2 border-t border-border-subtle/60 flex flex-col gap-1.5 text-2xs">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-4 h-0.5 shrink-0 rounded-full" style={{ backgroundColor: frontlineColors.deepstateLine }} />
                <span className="truncate text-content-secondary">{t.frontline.deepstateLine}</span>
              </span>
              <span className="font-medium text-content-primary shrink-0 tabular-nums">
                {fmt.number(dsTotalKm2)} km² <span className="text-content-muted font-normal">({dsPct})</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-4 h-0.5 shrink-0 rounded-full" style={{ backgroundColor: frontlineColors.lostarmourLine }} />
                <span className="truncate text-content-secondary">{t.frontline.lostarmourLine}</span>
              </span>
              <span className="font-medium text-content-primary shrink-0 tabular-nums">
                {fmt.number(summary.laClaimedKm2)} km² <span className="text-content-muted font-normal">({laPct})</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
