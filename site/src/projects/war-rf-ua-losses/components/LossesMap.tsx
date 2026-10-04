import type { FeatureCollection, Point as GeoJsonPoint } from 'geojson';
import { type GeoJSONSource, type LayerSpecification, type MapLayerMouseEvent, Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import { FilterPills } from '@/components/ui/FilterPills';
import { SearchSelect, type SearchSelectItem } from '@/components/ui/SearchSelect';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup';
import { lossSideColors, themeColors } from '@/styles/tokens';
import type { LossMapPoint, WarLossCategory, WarLossMapDataset } from '@/types';
import { useFormat, useLanguage, useTranslation } from '@/utils/locales';
import type { dict as enDict } from '../locales/dict-en';
import { CategoryIcon } from './CategoryIcon';
import { registerCategoryMarkers } from './category-markers';

// Configure bundled MapLibre Web Worker for Vite
setWorkerUrl(workerUrl);

interface PopupRow {
  label: string;
  value: string;
  color?: string;
  dotColor?: string;
}

/** Renders standard glassmorphic key-value table matching chart-builder tooltip specs. */
function renderPopupTable({ title, rows, footer }: { title?: string; rows: PopupRow[]; footer?: string }): string {
  const headerHtml = title ? `<div class="font-bold text-accent-primary text-xs pb-1 mb-2 border-b border-border-subtle/80">${title}</div>` : '';
  const rowsHtml = rows
    .map((r, i) => {
      const border = i === rows.length - 1 ? '' : 'border-b border-border-subtle/40';
      const dot = r.dotColor ? `<span class="inline-block w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" style="background-color:${r.dotColor};box-shadow:0 0 6px ${r.dotColor}80"></span>` : '';
      const style = r.color ? ` style="color:${r.color}"` : '';
      return `<tr class="${border}">
        <td class="py-1 text-content-muted font-normal whitespace-nowrap pr-3 align-top flex items-center">${dot}${r.label}:</td>
        <td class="py-1 text-content-primary font-medium text-right wrap-break-word leading-snug"${style}>${r.value}</td>
      </tr>`;
    })
    .join('');

  return `<div class="text-xs min-w-50 max-w-85">
    ${headerHtml}
    <table class="w-full border-collapse text-[11px] mb-1">
      <tbody>${rowsHtml}</tbody>
    </table>
    ${footer ?? ''}
  </div>`;
}

/** Parses post IDs or external URLs defensively from GeoJSON properties. */
function parseList<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

/** Renders external proof links with platform labels. */
function renderSourceButtons(posts: unknown, sources: unknown, lang: string): string {
  const postUrls = parseList<number>(posts).map((id) => `https://t.me/lost_warinua/${id}`);
  const extUrls = parseList<string>(sources).filter((u) => !u.includes('google.com') && !u.includes('usercontent'));
  const allUrls = [...postUrls, ...extUrls];
  if (!allUrls.length) return '';

  const baseLabel = lang === 'ru' ? 'Источник' : 'Source';
  const photoLabel = lang === 'ru' ? 'фото' : 'photo';
  const getPlat = (u: string) => {
    if (u.includes('t.me/') || u.includes('telegram.me/')) return 'telegram';
    if (u.includes('warspotting.net')) return 'warspotting';
    if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('facebook.com')) return 'facebook';
    if (u.includes('postimg.cc') || u.includes('postlmg.cc')) return photoLabel;
    return '';
  };

  const counts = new Map<string, number>();
  const items = allUrls.map((url) => {
    const plat = getPlat(url);
    const count = (counts.get(plat) || 0) + 1;
    counts.set(plat, count);
    return { url, plat, idx: count };
  });

  const buttons = items.map(({ url, plat, idx }) => {
    const total = counts.get(plat) || 1;
    const label = !plat ? (total > 1 ? `${baseLabel} #${idx}` : baseLabel) : total > 1 ? `${baseLabel} (${plat} #${idx})` : `${baseLabel} (${plat})`;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="btn-accent w-full text-[11px] justify-center py-1 truncate text-center">${label}</a>`;
  });

  return `<div class="flex flex-col gap-1.5 mt-2.5">${buttons.join('')}</div>`;
}

/** Static MapLibre layer specifications for clusters and unclustered category markers. */
const MAP_LAYERS: LayerSpecification[] = [
  {
    id: 'clusters',
    type: 'circle',
    source: 'losses',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'case',
        ['==', ['get', 'rf_count'], ['get', 'point_count']],
        themeColors.losses.rf,
        ['==', ['get', 'ua_count'], ['get', 'point_count']],
        themeColors.losses.ua,
        themeColors.losses.unk,
      ],
      'circle-radius': ['step', ['get', 'point_count'], 18, 20, 22, 100, 28, 500, 34],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.85,
    },
  },
  {
    id: 'cluster-count',
    type: 'symbol',
    source: 'losses',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['Noto Sans Bold'],
      'text-size': ['step', ['get', 'point_count'], 12, 100, 13, 500, 14],
    },
    paint: { 'text-color': '#ffffff' },
  },
  {
    id: 'unclustered-point',
    type: 'symbol',
    source: 'losses',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['concat', 'marker-', ['to-string', ['get', 'cat']], '-', ['to-string', ['case', ['==', ['get', 'side'], 0], 0, ['==', ['get', 'side'], 1], 1, 2]]],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.75, 7, 0.88, 10, 1.0, 13, 1.2, 16, 1.35],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  },
];

/** Registers procedural canvas dot fallback for missing OpenFreeMap town icons. */
function registerFallbackDot(map: MapLibreMap) {
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
      ctx.fillStyle = themeColors.text.dim;
      ctx.fill();
      const imgData = ctx.getImageData(0, 0, size, size);
      if (!map.hasImage(id)) map.addImage(id, imgData);
    }
  };

  map.setMissingStyleImageResolver(addDot);
  map.on('styleimagemissing', (e) => addDot(e.id));
  map.on('style.load', () => addDot('circle-11'));
}

/** Converts filtered compact data points into a lean GeoJSON feature collection. */
function pointsToGeoJson(points: LossMapPoint[]): FeatureCollection<GeoJsonPoint> {
  return {
    type: 'FeatureCollection',
    features: points.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p[0], p[1]] },
      properties: {
        side: p[2],
        cat: p[3],
        model: p[4],
        date: p[5],
        posts: p[6],
        sources: p[7] ?? [],
      },
    })),
  };
}

interface LossesMapProps {
  data: WarLossMapDataset;
  t: typeof enDict;
}

export const LossesMap: React.FC<LossesMapProps> = ({ data, t }) => {
  const { lang } = useLanguage();
  const {
    t: { common: tCommon },
  } = useTranslation();
  const fmt = useFormat();
  const rfName = fmt.region('RU');
  const uaName = fmt.region('UA');
  const unkName = t.timeline.unrecognized.charAt(0).toUpperCase() + t.timeline.unrecognized.slice(1);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapSourceLoadedRef = useRef(false);
  const activePopupRef = useRef<Popup | null>(null);

  const dateFromInputId = useId();
  const dateToInputId = useId();
  const dateFromInputRef = useRef<HTMLInputElement>(null);
  const dateToInputRef = useRef<HTMLInputElement>(null);

  // Filters state
  const [selectedSide, setSelectedSide] = useState<'all' | 'rf' | 'ua' | 'unk'>('all');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedModels, setSelectedModels] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Primary side and date scoping
  const hasSide = selectedSide !== 'all';
  const sideIdx = selectedSide === 'rf' ? 0 : selectedSide === 'ua' ? 1 : selectedSide === 'unk' ? 2 : -1;

  const scopedPoints = data.points.filter((p) => {
    if (hasSide && p[2] !== sideIdx) return false;
    if (dateFrom || dateTo) {
      if (!p[5]) return false;
      const pointDateFrom = p[5].length === 7 ? `${p[5]}-31` : p[5];
      const pointDateTo = p[5].length === 7 ? `${p[5]}-01` : p[5];
      if (dateFrom && pointDateFrom < dateFrom) return false;
      if (dateTo && pointDateTo > dateTo) return false;
    }
    return true;
  });

  // Single-pass category & model count accumulation
  const categoryCounts = new Map<number, number>();
  const modelCounts = new Map<number, number>();
  for (const p of scopedPoints) {
    categoryCounts.set(p[3], (categoryCounts.get(p[3]) || 0) + 1);
    modelCounts.set(p[4], (modelCounts.get(p[4]) || 0) + 1);
  }

  const availableModels: SearchSelectItem[] = data.models.map((name, idx) => ({
    value: idx,
    label: name,
    count: modelCounts.get(idx) || 0,
  }));

  const addModel = (idx: number) => {
    setSelectedModels((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
  };

  const removeModel = (idx: number) => {
    setSelectedModels((prev) => prev.filter((i) => i !== idx));
  };

  const clearAllModels = () => {
    setSelectedModels([]);
  };

  // Additive category & specific model filtering
  const hasCategoryFilter = selectedCategories.length > 0;
  const hasModelFilter = selectedModels.length > 0;

  const filteredPoints = scopedPoints.filter((p) => {
    if (hasCategoryFilter && !selectedCategories.includes(p[3])) return false;
    if (hasModelFilter && !selectedModels.includes(p[4])) return false;
    return true;
  });

  const geojson = pointsToGeoJson(filteredPoints);
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  // Unified context reference for map event callbacks
  const ctxRef = useRef({ lang, t, tCommon, fmt, rfName, uaName, unkName, models: data.models, categories: data.categories });
  ctxRef.current = { lang, t, tCommon, fmt, rfName, uaName, unkName, models: data.models, categories: data.categories };

  // Initialize MapLibre GL map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [36.8, 48.2],
      zoom: 6,
      maxZoom: 18,
      minZoom: 3,
    });

    registerFallbackDot(map);
    map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

    map.on('load', () => {
      registerCategoryMarkers(map, data.categories as readonly WarLossCategory[]);

      map.addSource('losses', {
        type: 'geojson',
        data: geojsonRef.current,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 25,
        clusterProperties: {
          rf_count: ['+', ['case', ['==', ['get', 'side'], 0], 1, 0]],
          ua_count: ['+', ['case', ['==', ['get', 'side'], 1], 1, 0]],
          unk_count: ['+', ['case', ['==', ['get', 'side'], 2], 1, 0]],
        },
      });

      for (const layer of MAP_LAYERS) {
        map.addLayer(layer);
      }

      mapSourceLoadedRef.current = true;

      // Click on cluster to zoom in or show breakdown if max zoom reached
      map.on('click', 'clusters', async (e: MapLayerMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
        const cluster = features[0];
        const clusterId = cluster?.properties?.cluster_id;
        if (clusterId == null) return;

        const source = map.getSource('losses') as GeoJSONSource;
        try {
          const zoom = await source.getClusterExpansionZoom(clusterId);
          const coords = (cluster.geometry as GeoJsonPoint).coordinates;
          map.easeTo({ center: [coords[0], coords[1]], zoom: zoom + 0.5 });
        } catch {
          const coords = (cluster.geometry as GeoJsonPoint).coordinates as [number, number];
          const count = cluster.properties?.point_count || 0;
          const rf = cluster.properties?.rf_count || 0;
          const ua = cluster.properties?.ua_count || 0;
          const unk = cluster.properties?.unk_count || 0;
          const { t: curT, fmt: curFmt, rfName: curRf, uaName: curUa, unkName: curUnk } = ctxRef.current;

          const rows: PopupRow[] = [];
          if (rf > 0) rows.push({ label: curRf, value: curFmt.number(rf), color: themeColors.losses.rf, dotColor: themeColors.losses.rf });
          if (ua > 0) rows.push({ label: curUa, value: curFmt.number(ua), color: themeColors.losses.ua, dotColor: themeColors.losses.ua });
          if (unk > 0) rows.push({ label: curUnk, value: curFmt.number(unk), color: themeColors.losses.unk, dotColor: themeColors.losses.unk });

          activePopupRef.current?.remove();
          const popup = new Popup({ offset: 16, closeButton: false, maxWidth: '320px' })
            .setLngLat(coords)
            .setHTML(renderPopupTable({ title: `${curFmt.number(count)} ${curT.map.losses}`, rows }))
            .addTo(map);
          activePopupRef.current = popup;
        }
      });

      // Click on unclustered point to show popup table
      map.on('click', 'unclustered-point', (e: MapLayerMouseEvent) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] });
        const feature = features[0];
        if (feature?.geometry.type !== 'Point') return;

        const { t: curT, tCommon: curCommon, lang: curLang, rfName: curRf, uaName: curUa, unkName: curUnk, models, categories } = ctxRef.current;
        const coords = feature.geometry.coordinates.slice() as [number, number];
        const props = feature.properties;
        const modelName = models[props.model] || curT.timeline.unrecognized;
        const catKey = categories[props.cat] as WarLossCategory;
        const catName = curT.categories.items[catKey] || catKey;
        const sideName = props.side === 0 ? curRf : props.side === 1 ? curUa : curUnk;
        const sideColor = lossSideColors[props.side] || themeColors.losses.unk;
        const dateStr = props.date || curT.timeline.unrecognized;
        const coordStr = `${coords[1].toFixed(4)}° N, ${coords[0].toFixed(4)}° E`;

        const proofHtml = renderSourceButtons(props.posts, props.sources, curLang);
        const popupHtml = renderPopupTable({
          rows: [
            { label: curT.map.model, value: modelName },
            { label: curCommon.category, value: catName },
            { label: curT.map.side, value: sideName, color: sideColor },
            { label: curCommon.date, value: dateStr },
            { label: curT.map.coordinates, value: coordStr },
          ],
          footer: proofHtml,
        });

        activePopupRef.current?.remove();
        const popup = new Popup({ offset: 14, closeButton: false, maxWidth: '380px' }).setLngLat(coords).setHTML(popupHtml).addTo(map);
        activePopupRef.current = popup;
      });

      // Pointer cursor on hoverable entities
      map.on('mouseenter', 'clusters', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'clusters', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', 'unclustered-point', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'unclustered-point', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    mapRef.current = map;

    // Responsive resize observer
    const container = mapContainerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      activePopupRef.current?.remove();
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      mapSourceLoadedRef.current = false;
    };
  }, [data]);

  // Update GeoJSON source when filters change (preserves camera position and zoom)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapSourceLoadedRef.current) return;

    activePopupRef.current?.remove();
    activePopupRef.current = null;

    const source = map.getSource('losses') as GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }
  }, [geojson]);

  const resetAllFilters = () => {
    setSelectedSide('all');
    setSelectedCategories([]);
    setSelectedModels([]);
    setDateFrom('');
    setDateTo('');
    if (dateFromInputRef.current) dateFromInputRef.current.value = '';
    if (dateToInputRef.current) dateToInputRef.current.value = '';
  };

  const hasActiveFilters = selectedSide !== 'all' || selectedCategories.length > 0 || selectedModels.length > 0 || Boolean(dateFrom) || Boolean(dateTo);

  return (
    <div className="flex flex-col gap-4">
      {/* Header & Filter Controls Bar */}
      <div className="flex flex-col gap-3">
        <div className="relative flex flex-col sm:flex-row items-center justify-center min-h-8 gap-2 px-2 sm:px-8 lg:px-24">
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            <h3 className="text-base sm:text-lg font-bold text-content-primary tracking-tight">{t.map.title}</h3>
            <span className="tag-pill bg-accent-glow text-accent-primary border-accent-primary/30">
              {fmt.number(filteredPoints.length)} {t.map.losses}
            </span>
          </div>

          {/* Reset Filters Action */}
          {hasActiveFilters && (
            <div className="sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2">
              <button type="button" onClick={resetAllFilters} className="text-xs text-content-muted hover:text-accent-primary transition-colors underline cursor-pointer">
                {tCommon.reset}
              </button>
            </div>
          )}
        </div>

        {/* Primary Controls Row: Side Toggle, Date Range & Model Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-center">
          {/* Faction / Side Toggle */}
          <ToggleGroup
            type="single"
            value={selectedSide}
            onValueChange={(val) => {
              if (val) setSelectedSide(val as 'all' | 'rf' | 'ua' | 'unk');
            }}
            className="w-full flex items-center h-9 p-1"
          >
            <ToggleGroupItem value="all" className="flex-1 h-full py-0 px-2 flex items-center justify-center text-center">
              {t.map.allSides}
            </ToggleGroupItem>
            <ToggleGroupItem value="rf" className="flex-1 h-full py-0 px-2 flex items-center justify-center text-center">
              RF
            </ToggleGroupItem>
            <ToggleGroupItem value="ua" className="flex-1 h-full py-0 px-2 flex items-center justify-center text-center">
              UA
            </ToggleGroupItem>
            <ToggleGroupItem value="unk" title={unkName} className="flex-1 h-full py-0 px-2 flex items-center justify-center text-center">
              ?
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Date From */}
          <div className="control-panel flex items-center gap-2 px-3 h-9 text-xs">
            <label htmlFor={dateFromInputId} className="text-content-muted font-medium shrink-0 cursor-pointer">
              {tCommon.from}:
            </label>
            <input
              ref={dateFromInputRef}
              id={dateFromInputId}
              type="date"
              value={dateFrom}
              min="2022-02-01"
              max="2026-12-31"
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent text-content-primary text-xs w-full focus:outline-hidden p-0 m-0"
            />
          </div>

          {/* Date To */}
          <div className="control-panel flex items-center gap-2 px-3 h-9 text-xs">
            <label htmlFor={dateToInputId} className="text-content-muted font-medium shrink-0 cursor-pointer">
              {tCommon.to}:
            </label>
            <input
              ref={dateToInputRef}
              id={dateToInputId}
              type="date"
              value={dateTo}
              min="2022-02-01"
              max="2026-12-31"
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent text-content-primary text-xs w-full focus:outline-hidden p-0 m-0"
            />
          </div>

          {/* Search Model by Name via SearchSelect */}
          <SearchSelect
            items={availableModels}
            selectedValues={selectedModels}
            onSelect={(item) => addModel(Number(item.value))}
            placeholder={t.map.searchPlaceholder}
            emptyLabel={t.map.noModelsFound}
          />
        </div>

        {/* Category Pills Strip */}
        <div className="pt-1">
          <FilterPills
            items={data.categories.map((catKey, idx) => ({
              id: idx,
              label: t.categories.items[catKey] || catKey,
              icon: <CategoryIcon category={catKey} className="h-3 w-auto shrink-0" />,
              count: categoryCounts.get(idx) || 0,
            }))}
            selected={selectedCategories}
            onChange={setSelectedCategories}
            allLabel={t.map.allCategories}
            allCount={scopedPoints.length}
          />
        </div>

        {/* Selected Model Badges Strip (matching category pill styling) */}
        {selectedModels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-bold text-content-muted mr-1">{t.map.selectedModels}:</span>
            {selectedModels.map((mIdx) => {
              const name = data.models[mIdx] || t.timeline.unrecognized;
              const count = modelCounts.get(mIdx) || 0;
              return (
                <button
                  key={mIdx}
                  type="button"
                  onClick={() => removeModel(mIdx)}
                  className="tag-pill transition-all cursor-pointer inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-accent-glow text-accent-primary border-accent-primary/40 font-bold shadow-xs hover:border-danger/50 hover:text-danger hover:bg-danger/10 select-none"
                  title={name}
                >
                  <span className="leading-none">{name}</span>
                  <span className="tabular-nums text-[10px] leading-none opacity-75">({fmt.number(count)})</span>
                </button>
              );
            })}
            <button type="button" onClick={clearAllModels} className="text-[11px] text-content-muted hover:text-accent-primary transition-colors underline cursor-pointer ml-1">
              {tCommon.clear}
            </button>
          </div>
        )}
      </div>

      {/* Map Container */}
      <div className="relative w-full h-135 sm:h-155 rounded-xl overflow-hidden border border-border-subtle bg-surface-base/90 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Map Legend Floating Overlay */}
        <div className="absolute bottom-3 left-3 z-10 glass-overlay px-3 py-1.5 flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-losses-rf shadow-[0_0_8px_var(--color-losses-rf)]" />
            <span className="text-content-secondary">{rfName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-losses-ua shadow-[0_0_8px_var(--color-losses-ua)]" />
            <span className="text-content-secondary">{uaName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-losses-unk shadow-[0_0_8px_var(--color-losses-unk)]" />
            <span className="text-content-secondary">{unkName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
