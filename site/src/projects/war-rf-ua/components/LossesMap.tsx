import type { FeatureCollection, Point as GeoJsonPoint } from 'geojson';
import { type GeoJSONSource, type LayerSpecification, type MapLayerMouseEvent, Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl';
import type React from 'react';
import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { WarLossCategory } from '@graphs/types/war-rf-ua/categories';
import type { LossesMapSectionData, LossMapPoint } from '@graphs/types/war-rf-ua/losses-map';
import { FilterPills } from '@/components/ui/FilterPills';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SearchSelect, type SearchSelectItem } from '@/components/ui/SearchSelect';
import { TimelineScrubber } from '@/components/ui/TimelineScrubber';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup';
import { getMapTileStyle, registerFallbackDot } from '@/utils/map-builder';
import { useFormat, useTheme, useTranslation } from '@/utils/provider';
import { renderTooltipTablePopup } from '@/utils/tooltip-builder';
import { useInView } from '@/utils/useInView';
import type { dict as enDict } from '../locales/dict-en';
import { lossColors } from '../tokens';
import { CategoryIcon } from './CategoryIcon';
import { registerCategoryMarkers } from './category-markers';

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
function renderSourceButtons(posts: unknown, sources: unknown, sourceLabel: string): string {
  const postUrls = parseList<number>(posts).map((id) => `https://t.me/lost_warinua/${id}`);
  const extUrls = parseList<string>(sources).filter((u) => !u.includes('google.com') && !u.includes('usercontent'));
  const allUrls = [...postUrls, ...extUrls];
  if (!allUrls.length) return '';

  const getPlat = (u: string) => {
    if (u.includes('t.me/') || u.includes('telegram.me/')) return 'telegram';
    if (u.includes('warspotting.net')) return 'warspotting';
    if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('facebook.com')) return 'facebook';
    if (u.includes('postimg.cc') || u.includes('postlmg.cc')) return 'photo';
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
    const label = !plat ? (total > 1 ? `${sourceLabel} #${idx}` : sourceLabel) : total > 1 ? `${sourceLabel} (${plat} #${idx})` : `${sourceLabel} (${plat})`;
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
      'circle-color': ['case', ['==', ['get', 'rf_count'], ['get', 'point_count']], lossColors.rf, ['==', ['get', 'ua_count'], ['get', 'point_count']], lossColors.ua, lossColors.unk],
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

/** Resolves continuous sequential month list covering the entire dataset span dynamically from points. */
function getMapTimelinePeriods(points: LossMapPoint[]): string[] {
  let minMonth = '';
  let maxMonth = '';
  for (const p of points) {
    const d = p[5];
    if (d && d.length >= 7) {
      const m = d.slice(0, 7);
      if (!minMonth || m < minMonth) minMonth = m;
      if (!maxMonth || m > maxMonth) maxMonth = m;
    }
  }
  if (!minMonth || !maxMonth) return [];

  const [startYear, startM] = minMonth.split('-').map(Number);
  const [endYear, endM] = maxMonth.split('-').map(Number);
  const list: string[] = [];
  let y = startYear;
  let m = startM;
  while (y < endYear || (y === endYear && m <= endM)) {
    list.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return list;
}

interface LossesMapProps {
  data: LossesMapSectionData;
  t: typeof enDict;
  initialInView?: boolean;
}

export const LossesMap: React.FC<LossesMapProps> = ({ data, t, initialInView }) => {
  const { resolvedTheme, tokens } = useTheme();
  const {
    t: { common: tCommon },
  } = useTranslation();
  const fmt = useFormat();
  const rfName = fmt.region('RU');
  const uaName = fmt.region('UA');
  const unkName = t.timeline.unrecognized.charAt(0).toUpperCase() + t.timeline.unrecognized.slice(1);

  const { ref: containerRef, hasEnteredView } = useInView<HTMLDivElement>({
    rootMargin: '400px 0px',
    initialInView,
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapSourceLoadedRef = useRef(false);
  const activePopupRef = useRef<Popup | null>(null);

  // Filters state
  const [selectedSide, setSelectedSide] = useState<'all' | 'rf' | 'ua' | 'unk'>('all');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedModels, setSelectedModels] = useState<number[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Primary filter criteria
  const hasSide = selectedSide !== 'all';
  const sideIdx = selectedSide === 'rf' ? 0 : selectedSide === 'ua' ? 1 : selectedSide === 'unk' ? 2 : -1;
  const hasCategoryFilter = selectedCategories.length > 0;
  const hasModelFilter = selectedModels.length > 0;

  // Base date scoping
  const dateFilteredPoints = data.points.filter((p) => {
    if (dateFrom || dateTo) {
      if (!p[5]) return false;
      const pointDateFrom = p[5].length === 7 ? `${p[5]}-31` : p[5];
      const pointDateTo = p[5].length === 7 ? `${p[5]}-01` : p[5];
      if (dateFrom && pointDateFrom < dateFrom) return false;
      if (dateTo && pointDateTo > dateTo) return false;
    }
    return true;
  });

  // Single-pass coordinated facet counts accumulation
  const sideCounts = { all: 0, rf: 0, ua: 0, unk: 0 };
  const categoryCounts = new Map<number, number>();
  const modelCounts = new Map<number, number>();
  const filteredPoints: LossMapPoint[] = [];

  for (const p of dateFilteredPoints) {
    const pSide = p[2];
    const pCat = p[3];
    const pModel = p[4];

    const matchSide = !hasSide || pSide === sideIdx;
    const matchCat = !hasCategoryFilter || selectedCategories.includes(pCat);
    const matchModel = !hasModelFilter || selectedModels.includes(pModel);

    // 1. Side counts (respects active date, category, and model filters)
    if (matchCat && matchModel) {
      sideCounts.all++;
      if (pSide === 0) sideCounts.rf++;
      else if (pSide === 1) sideCounts.ua++;
      else if (pSide === 2) sideCounts.unk++;
    }

    // 2. Category counts (respects active date, side, and model filters)
    if (matchSide && matchModel) {
      categoryCounts.set(pCat, (categoryCounts.get(pCat) || 0) + 1);
    }

    // 3. Model counts (respects active date and side - searches across all models)
    if (matchSide) {
      modelCounts.set(pModel, (modelCounts.get(pModel) || 0) + 1);
    }

    // 4. Final filtered points (all active filters matched)
    if (matchSide && matchCat && matchModel) {
      filteredPoints.push(p);
    }
  }

  // Map each model index to its primary category identifier
  const modelCategoryMap = new Map<number, WarLossCategory>();
  for (const p of data.points) {
    if (!modelCategoryMap.has(p[4])) {
      modelCategoryMap.set(p[4], data.categories[p[3]]);
    }
  }

  const availableModels: SearchSelectItem[] = data.models.map((name, idx) => {
    const cat = modelCategoryMap.get(idx);
    return {
      value: idx,
      label: name,
      count: modelCounts.get(idx) || 0,
      icon: cat ? <CategoryIcon category={cat} className="h-3 w-auto shrink-0" /> : undefined,
    };
  });

  const addModel = (idx: number) => {
    startTransition(() => {
      setSelectedModels((prev) => (prev.includes(idx) ? prev : [...prev, idx]));
    });
  };

  const removeModel = (idx: number) => {
    startTransition(() => {
      setSelectedModels((prev) => prev.filter((i) => i !== idx));
    });
  };

  const clearAllModels = () => {
    startTransition(() => {
      setSelectedModels([]);
    });
  };

  // Derive continuous timeline month sequence and background data density
  const timelinePeriods = getMapTimelinePeriods(data.points);
  const periodIndexMap = new Map<string, number>(timelinePeriods.map((p, i) => [p, i]));

  const timelineDensity = new Array(timelinePeriods.length).fill(0);
  for (const p of data.points) {
    if (hasSide && p[2] !== sideIdx) continue;
    if (hasCategoryFilter && !selectedCategories.includes(p[3])) continue;
    if (hasModelFilter && !selectedModels.includes(p[4])) continue;
    if (!p[5] || p[5].length < 7) continue;
    const m = p[5].slice(0, 7);
    const idx = periodIndexMap.get(m);
    if (idx !== undefined) {
      timelineDensity[idx]++;
    }
  }

  const geojson = pointsToGeoJson(filteredPoints);

  // Map click interaction handlers via React 19 useEffectEvent
  const handleClusterClick = useEffectEvent(async (e: MapLayerMouseEvent, map: MapLibreMap) => {
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

      const rows = [];
      if (rf > 0) rows.push({ label: rfName, value: fmt.number(rf), color: lossColors[0], dotColor: lossColors[0] });
      if (ua > 0) rows.push({ label: uaName, value: fmt.number(ua), color: lossColors[1], dotColor: lossColors[1] });
      if (unk > 0) rows.push({ label: unkName, value: fmt.number(unk), color: lossColors[2], dotColor: lossColors[2] });

      activePopupRef.current?.remove();
      const popup = new Popup({ offset: 16, closeButton: false, maxWidth: '320px' })
        .setLngLat(coords)
        .setHTML(renderTooltipTablePopup({ title: `${fmt.number(count)} ${t.map.losses}`, rows }))
        .addTo(map);
      activePopupRef.current = popup;
    }
  });

  const handlePointClick = useEffectEvent((e: MapLayerMouseEvent, map: MapLibreMap) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['unclustered-point'] });
    const feature = features[0];
    if (feature?.geometry.type !== 'Point') return;

    const coords = feature.geometry.coordinates.slice() as [number, number];
    const props = feature.properties;
    const modelName = data.models[props.model] || t.timeline.unrecognized;
    const catKey = data.categories[props.cat] as WarLossCategory;
    const catName = t.categories.items[catKey] || catKey;
    const sideName = props.side === 0 ? rfName : props.side === 1 ? uaName : unkName;
    const sideColor = lossColors[props.side as 0 | 1 | 2] || lossColors[2];
    const dateStr = props.date || t.timeline.unrecognized;
    const coordStr = `${coords[1].toFixed(4)}° N, ${coords[0].toFixed(4)}° E`;

    const proofHtml = renderSourceButtons(props.posts, props.sources, tCommon.source);
    const popupHtml = renderTooltipTablePopup({
      rows: [
        { label: t.map.model, value: modelName },
        { label: tCommon.category, value: catName },
        { label: t.map.side, value: sideName, color: sideColor },
        { label: tCommon.date, value: dateStr },
        { label: t.map.coordinates, value: coordStr },
      ],
      footer: proofHtml,
    });

    activePopupRef.current?.remove();
    const popup = new Popup({ offset: 14, closeButton: false, maxWidth: '380px' }).setLngLat(coords).setHTML(popupHtml).addTo(map);
    activePopupRef.current = popup;
  });

  // Initialize MapLibre GL map
  // biome-ignore lint/correctness/useExhaustiveDependencies: geojson is only used to seed initial source; filter updates are applied via setData() in dedicated effect
  useEffect(() => {
    if (!hasEnteredView || !mapContainerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: getMapTileStyle(resolvedTheme),
      center: [36.8, 48.2],
      zoom: 6,
      maxZoom: 18,
      minZoom: 3,
    });

    registerFallbackDot(map, tokens.text.dim);
    map.addControl(new NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

    map.on('load', () => {
      registerCategoryMarkers(map, data.categories as readonly WarLossCategory[]);

      map.addSource('losses', {
        type: 'geojson',
        data: geojson,
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
      map.on('click', 'clusters', (e) => handleClusterClick(e, map));

      // Click on unclustered point to show popup table
      map.on('click', 'unclustered-point', (e) => handlePointClick(e, map));

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
      activePopupRef.current?.remove();
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      mapSourceLoadedRef.current = false;
    };
  }, [hasEnteredView, data, resolvedTheme, tokens.text.dim]);

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
    startTransition(() => {
      setSelectedSide('all');
      setSelectedCategories([]);
      setSelectedModels([]);
      setDateFrom('');
      setDateTo('');
    });
  };

  const hasActiveFilters = selectedSide !== 'all' || selectedCategories.length > 0 || selectedModels.length > 0 || Boolean(dateFrom) || Boolean(dateTo);

  return (
    <div ref={containerRef} className="flex flex-col gap-2 min-h-145">
      {!hasEnteredView ? (
        <div className="relative w-full h-145 card flex items-center justify-center">
          <LoadingSpinner isVisible={true} fullscreen={false} size="md" />
        </div>
      ) : (
        <>
          {/* Header & Filter Controls Bar */}
          <div className="flex flex-col gap-1.5">
            {/* Primary Controls Row: Side Toggle & Model Search */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 items-center">
              {/* Faction / Side Toggle */}
              <ToggleGroup
                type="single"
                value={selectedSide}
                onValueChange={(val) => {
                  if (val) {
                    startTransition(() => {
                      setSelectedSide(val as 'all' | 'rf' | 'ua' | 'unk');
                    });
                  }
                }}
                className="w-full flex items-center h-7.5 p-0.5"
              >
                <ToggleGroupItem value="all" className="flex-1 h-full py-0 px-2 flex items-center justify-center text-center gap-1 text-[11px]">
                  <span>{t.map.allSides}</span>
                  <span className="tabular-nums text-[10px] opacity-75">({fmt.number(sideCounts.all)})</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="rf" className="flex-1 h-full py-0 px-2 flex items-center justify-center text-center gap-1 text-[11px]">
                  <span>RF</span>
                  <span className="tabular-nums text-[10px] opacity-75">({fmt.number(sideCounts.rf)})</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="ua" className="flex-1 h-full py-0 px-2 flex items-center justify-center text-center gap-1 text-[11px]">
                  <span>UA</span>
                  <span className="tabular-nums text-[10px] opacity-75">({fmt.number(sideCounts.ua)})</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="unk" title={unkName} className="flex-1 h-full py-0 px-2 flex items-center justify-center text-center gap-1 text-[11px]">
                  <span>?</span>
                  <span className="tabular-nums text-[10px] opacity-75">({fmt.number(sideCounts.unk)})</span>
                </ToggleGroupItem>
              </ToggleGroup>

              {/* Search Model by Name via SearchSelect */}
              <SearchSelect
                items={availableModels}
                selectedValues={selectedModels}
                onSelect={(item) => addModel(Number(item.value))}
                placeholder={t.map.searchPlaceholder}
                emptyLabel={t.map.noModelsFound}
              />
            </div>

            {/* Category Pills Strip & Reset Action */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <FilterPills
                  items={data.categories.map((catKey, idx) => ({
                    id: idx,
                    label: t.categories.items[catKey] || catKey,
                    icon: <CategoryIcon category={catKey} className="h-3 w-auto shrink-0" />,
                    count: categoryCounts.get(idx) || 0,
                  }))}
                  selected={selectedCategories}
                  onChange={(cats) => {
                    startTransition(() => {
                      setSelectedCategories(cats);
                    });
                  }}
                  allLabel={t.map.allCategories}
                  allCount={hasSide ? (selectedSide === 'rf' ? sideCounts.rf : selectedSide === 'ua' ? sideCounts.ua : sideCounts.unk) : sideCounts.all}
                />
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={resetAllFilters} className="text-xs text-content-muted hover:text-accent-primary transition-colors underline cursor-pointer shrink-0">
                  {tCommon.reset}
                </button>
              )}
            </div>

            {/* Selected Model Badges Strip (matching category pill styling) */}
            {selectedModels.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
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
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lossColors.rf, boxShadow: `0 0 8px ${lossColors.rf}80` }} />
                <span className="text-content-secondary">{rfName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lossColors.ua, boxShadow: `0 0 8px ${lossColors.ua}80` }} />
                <span className="text-content-secondary">{uaName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lossColors.unk, boxShadow: `0 0 8px ${lossColors.unk}80` }} />
                <span className="text-content-secondary">{unkName}</span>
              </div>
            </div>
          </div>

          {/* Timeline Scrubber (Bottom Time Controls Bar) */}
          <div className="control-panel p-2 sm:px-2.5 sm:py-1.5">
            <TimelineScrubber
              periods={timelinePeriods}
              density={timelineDensity}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={({ dateFrom: nextFrom, dateTo: nextTo }) => {
                startTransition(() => {
                  setDateFrom(nextFrom);
                  setDateTo(nextTo);
                });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
};
