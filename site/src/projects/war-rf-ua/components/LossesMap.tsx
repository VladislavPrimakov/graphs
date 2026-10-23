import type { FeatureCollection, Point as GeoJsonPoint } from 'geojson';
import { type GeoJSONSource, type LayerSpecification, type MapLayerMouseEvent, Map as MapLibreMap, NavigationControl, Popup } from 'maplibre-gl';
import type React from 'react';
import { useEffect, useEffectEvent, useRef } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { LossesMapSectionData, LossMapPoint, WarLossCategory, WarLossesFilterState } from '@graphs/shared/types/war-rf-ua/losses';
import { useSectionResize } from '@/components/sections/Section';
import { getMapTileStyle, registerFallbackDot } from '@/utils/map-builder';
import { useFormat, useTheme, useTranslation } from '@/utils/provider';
import { renderTooltipTablePopup } from '@/utils/tooltip-builder';
import { lossColors } from '../tokens';
import type { WarLossesDict } from '../types';
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
  const extUrls = parseList<string>(sources);
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
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="btn-accent w-full text-2xs justify-center py-1 truncate text-center">${label}</a>`;
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

export interface LossesMapProps {
  data: LossesMapSectionData;
  t: WarLossesDict;
  filters?: WarLossesFilterState;
}

export const LossesMap: React.FC<LossesMapProps> = ({ data, t, filters }) => {
  const { resolvedTheme } = useTheme();
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

  // Extract filter dimensions directly from coordinated toolbar store
  const selectedSide = filters?.side ?? 'all';
  const selectedCategories = filters?.categories ?? [];
  const selectedModels = filters?.models ?? [];
  const [dateFrom, dateTo] = filters?.period ?? [];

  const hasSide = selectedSide !== 'all';
  const sideIdx = selectedSide === 'rf' ? 0 : selectedSide === 'ua' ? 1 : selectedSide === 'unk' ? 2 : -1;
  const hasCategoryFilter = selectedCategories.length > 0;
  const hasModelFilter = selectedModels.length > 0;

  const allowedCatIndices = hasCategoryFilter ? new Set(selectedCategories.map((c) => data.categories.indexOf(c as WarLossCategory)).filter((i) => i !== -1)) : null;
  const allowedModelIndices = hasModelFilter ? new Set(selectedModels.map((m) => data.models.indexOf(m)).filter((i) => i !== -1)) : null;

  const filteredPoints = data.points.filter((p) => {
    if (hasSide && p[2] !== sideIdx) return false;
    if (allowedCatIndices && !allowedCatIndices.has(p[3])) return false;
    if (allowedModelIndices && !allowedModelIndices.has(p[4])) return false;

    if (dateFrom || dateTo) {
      if (!p[5]) return false;
      const pointDate = p[5];
      if (dateFrom) {
        const fromKey = dateFrom.length === 7 ? dateFrom : dateFrom.slice(0, 7);
        if (pointDate.slice(0, 7) < fromKey) return false;
        if (dateFrom.length > 7 && pointDate.length > 7 && pointDate < dateFrom) return false;
      }
      if (dateTo) {
        const toKey = dateTo.length === 7 ? dateTo : dateTo.slice(0, 7);
        if (pointDate.slice(0, 7) > toKey) return false;
        if (dateTo.length > 7 && pointDate.length > 7 && pointDate > dateTo) return false;
      }
    }

    return true;
  });

  const geojson = pointsToGeoJson(filteredPoints);
  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

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

  // Primary map instance lifecycle effect
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: getMapTileStyle(resolvedTheme),
      center: [36.5, 48.0],
      zoom: 6,
      minZoom: 4,
      maxZoom: 18,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', async () => {
      await registerCategoryMarkers(map, data.categories);
      registerFallbackDot(map, 'marker-dot');

      map.addSource('losses', {
        type: 'geojson',
        data: geojsonRef.current,
        cluster: true,
        clusterMaxZoom: 13,
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

    return () => {
      activePopupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      mapSourceLoadedRef.current = false;
    };
  }, [data, resolvedTheme]);

  useSectionResize(() => {
    mapRef.current?.resize();
  });

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

  return (
    <div className="flex flex-col gap-2 min-h-145">
      {/* Map Container */}
      <div className="relative w-full h-145 rounded-xl overflow-hidden border border-border-subtle bg-surface-base/90 shadow-inner">
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
    </div>
  );
};
