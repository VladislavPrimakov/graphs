import { type GeoJSONSource, Map as MapLibreMap, NavigationControl } from 'maplibre-gl';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { DayFrontlineEntry, FrontlineMapLayers, FrontlineMapSectionData } from '@graphs/types/war-rf-ua/frontline-map';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { TimelineScrubber } from '@/components/ui/TimelineScrubber';
import { createFillLayer, createLineLayer, decodeMultiPolygon, getMapTileStyle, multiPolygonToGeoJson, registerFallbackDot, UKRAINE_MAP_PRESETS } from '@/utils/map-builder';
import { useFormat, useTheme } from '@/utils/provider';
import type { dict as enDict } from '../locales/dict-en';
import { frontlineColors } from '../tokens';

interface FrontlineMapProps {
  data: FrontlineMapSectionData;
  t: typeof enDict;
}

/** Resolves and decodes layers for a target date from history bundle, traversing reference chains. */
function resolveHistoryDayLayers(days: Record<string, DayFrontlineEntry>, targetDate: string, fallbackLayers: FrontlineMapLayers): FrontlineMapLayers {
  let entry = days[targetDate];
  let depth = 0;
  while (entry && 'ref' in entry && depth < 20) {
    entry = days[entry.ref];
    depth++;
  }
  if (!entry || 'ref' in entry) return fallbackLayers;
  if ('consensusRf' in entry) return entry;
  return {
    consensusRf: decodeMultiPolygon(entry.c),
    disputed: decodeMultiPolygon(entry.d),
    deepstate: decodeMultiPolygon(entry.ds),
    lostarmour: decodeMultiPolygon(entry.la),
  };
}

let cachedHistoryDays: Record<string, DayFrontlineEntry> | null = null;
let cachedHistoryPromise: Promise<Record<string, DayFrontlineEntry>> | null = null;

/** Lazily loads the single compressed frontline history bundle containing all historical dates. */
function loadFrontlineHistory(): Promise<Record<string, DayFrontlineEntry>> {
  if (cachedHistoryDays) return Promise.resolve(cachedHistoryDays);
  if (cachedHistoryPromise) return cachedHistoryPromise;

  const url = `${import.meta.env.BASE_URL}data/war-rf-ua/frontline-map/frontline-history.json`;
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
      return res.json() as Promise<Record<string, DayFrontlineEntry>>;
    })
    .then((days) => {
      cachedHistoryDays = days;
      return days;
    })
    .catch((err) => {
      cachedHistoryPromise = null;
      throw err;
    });

  cachedHistoryPromise = promise;
  return promise;
}

const timelineCache = new WeakMap<FrontlineMapSectionData, { dates: string[]; density: number[] }>();

/** Caches immutable timeline dates and density arrays per dataset to avoid GC allocations during scrubbing. */
function getTimelineData(data: FrontlineMapSectionData): { dates: string[]; density: number[] } {
  let cached = timelineCache.get(data);
  if (!cached) {
    const dates = data.timeline && data.timeline.length > 0 ? data.timeline.map((p) => p.date) : [data.summary.latestDate];
    const density = data.timeline && data.timeline.length > 0 ? data.timeline.map((p) => Math.max(0, p.deltaKm2 ?? 0)) : [];
    cached = { dates, density };
    timelineCache.set(data, cached);
  }
  return cached;
}

export const FrontlineMap: React.FC<FrontlineMapProps> = ({ data, t }) => {
  const { resolvedTheme, tokens } = useTheme();
  const fmt = useFormat();

  const { dates, density: timelineDensity } = getTimelineData(data);
  const [selectedDate, setSelectedDate] = useState<string>(data.summary.latestDate);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const decodedCacheRef = useRef<Map<string, FrontlineMapLayers>>(new Map(data.layers && data.summary.latestDate ? [[data.summary.latestDate, data.layers]] : []));
  const activeDateRef = useRef<string>(selectedDate);
  activeDateRef.current = selectedDate;

  // Keep cache synchronized if dataset changes
  useEffect(() => {
    if (data.layers && data.summary.latestDate) {
      decodedCacheRef.current.set(data.summary.latestDate, data.layers);
    }
  }, [data]);

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialLayers = data.layers;

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
      // 1. Consensus Russian control multi-polygons (Red Fill)
      map.addSource('consensus-rf', {
        type: 'geojson',
        data: multiPolygonToGeoJson(initialLayers.consensusRf),
      });
      map.addLayer(createFillLayer('consensus-rf-fill', 'consensus-rf', frontlineColors.consensusRf, 0.3));

      // 2. Disputed & Grey zone multi-polygons (Grey / Contested Fill)
      map.addSource('disputed', {
        type: 'geojson',
        data: multiPolygonToGeoJson(initialLayers.disputed),
      });
      map.addLayer(createFillLayer('disputed-fill', 'disputed', frontlineColors.disputed, 0.4));
      map.addLayer(createLineLayer('disputed-line', 'disputed', frontlineColors.disputedStroke, 1, 0.7));

      // 3. DeepState Frontline Line (Cyan / Sky)
      if (initialLayers.deepstate) {
        map.addSource('deepstate', {
          type: 'geojson',
          data: multiPolygonToGeoJson(initialLayers.deepstate),
        });
        map.addLayer(createLineLayer('deepstate-line', 'deepstate', frontlineColors.deepstateLine, 2, 0.95));
      }

      // 4. LostArmour Frontline Line (Rose / Red Solid)
      if (initialLayers.lostarmour) {
        map.addSource('lostarmour', {
          type: 'geojson',
          data: multiPolygonToGeoJson(initialLayers.lostarmour),
        });
        map.addLayer(createLineLayer('lostarmour-line', 'lostarmour', frontlineColors.lostarmourLine, 2, 0.95));
      }
    });

    mapRef.current = map;

    const container = mapContainerRef.current;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        map.resize();
      }, 50);
    });
    if (container) resizeObserver.observe(container);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [resolvedTheme, tokens.text.dim, data]);

  // Reactive layer updates when selectedDate changes (cached or on-demand fetch)
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;

    const applyLayers = (layers: FrontlineMapLayers) => {
      const consensusSource = map.getSource('consensus-rf') as GeoJSONSource | undefined;
      if (consensusSource) {
        consensusSource.setData(multiPolygonToGeoJson(layers.consensusRf));
      }
      const disputedSource = map.getSource('disputed') as GeoJSONSource | undefined;
      if (disputedSource) {
        disputedSource.setData(multiPolygonToGeoJson(layers.disputed));
      }
      const dsSource = map.getSource('deepstate') as GeoJSONSource | undefined;
      if (dsSource && layers.deepstate) {
        dsSource.setData(multiPolygonToGeoJson(layers.deepstate));
      }
      const laSource = map.getSource('lostarmour') as GeoJSONSource | undefined;
      if (laSource && layers.lostarmour) {
        laSource.setData(multiPolygonToGeoJson(layers.lostarmour));
      }
    };

    const targetDate = selectedDate;

    // 1. If latest day, apply instantly
    if (targetDate === data.summary.latestDate && data.layers) {
      applyLayers(data.layers);
      return;
    }

    // 2. If already decoded in memory, apply instantly (0ms)
    const cached = decodedCacheRef.current.get(targetDate);
    if (cached) {
      applyLayers(cached);
      return;
    }

    // 3. If history bundle is already loaded, decode in ~0.8ms and apply instantly
    if (cachedHistoryDays) {
      const decoded = resolveHistoryDayLayers(cachedHistoryDays, targetDate, data.layers);
      decodedCacheRef.current.set(targetDate, decoded);
      applyLayers(decoded);
      return;
    }

    // 4. Download history bundle on first scrub to historical date
    let cancelled = false;
    setIsLoadingHistory(true);
    loadFrontlineHistory()
      .then((days) => {
        if (cancelled) return;
        setIsLoadingHistory(false);
        const decoded = resolveHistoryDayLayers(days, targetDate, data.layers);
        decodedCacheRef.current.set(targetDate, decoded);
        if (activeDateRef.current === targetDate) {
          applyLayers(decoded);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIsLoadingHistory(false);
          console.warn(`Failed to load frontline history for ${targetDate}:`, err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, data]);

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

        {/* Centered Loading Overlay while downloading history bundle */}
        {isLoadingHistory && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-surface-base transition-opacity">
            <LoadingSpinner isVisible={true} fullscreen={false} size="md" />
          </div>
        )}

        {/* Floating Dark Glassmorphic Map Legend */}
        <div className="absolute bottom-4 left-4 z-10 glass-bar rounded-xl p-3.5 text-xs max-w-90 shadow-lg border border-border-subtle/80 flex flex-col gap-2.5 pointer-events-auto">
          <div className="font-semibold text-content-primary text-[11px] uppercase tracking-wider text-accent-primary">{t.frontline.legendTitle}</div>

          {/* Territorial Zones */}
          <div className="flex flex-col gap-1.5 text-[11px]">
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
                <span className="inline-block w-3 h-3 rounded-xs shrink-0 bg-blue-500/20 border" style={{ borderColor: frontlineColors.consensusUa }} />
                <span className="truncate text-content-secondary">{t.frontline.consensusUa}</span>
              </span>
              <span className="font-medium text-content-primary shrink-0 tabular-nums">
                {fmt.number(summary.consensusUaKm2)} km² <span className="text-content-muted font-normal">({uaPct})</span>
              </span>
            </div>
          </div>

          {/* Frontline Lines Section */}
          <div className="pt-2 border-t border-border-subtle/60 flex flex-col gap-1.5 text-[11px]">
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

      {/* Single-Date Timeline Scrubber Bar */}
      {dates.length > 1 && (
        <div className="control-panel p-2">
          <TimelineScrubber mode="single" periods={dates} density={timelineDensity} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
        </div>
      )}
    </div>
  );
};
