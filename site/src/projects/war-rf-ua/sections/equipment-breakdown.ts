import type { WarLossCategory } from '@graphs/types/war-rf-ua/categories';
import type { EquipmentBreakdownSectionData } from '@graphs/types/war-rf-ua/equipment-breakdown';
import type { LossMapPoint } from '@graphs/types/war-rf-ua/losses-map';
import { createElement } from 'react';
import { type BreakdownCategory, type BreakdownList, breakdownGridSection, type SectionBuilder } from '@/types';
import type { LocalizedFormatters } from '@/utils/format';
import { CategoryIcon } from '../components/CategoryIcon';
import type { LossesFilterState } from '../losses-filter-store';
import { lossColors } from '../tokens';
import type { WarLossesDict } from '../types';

function buildStaticCategories(data: EquipmentBreakdownSectionData, tProj: WarLossesDict, fmt: LocalizedFormatters): BreakdownCategory[] {
  return data.summary.categories.map((cat) => {
    const catData = data.byCategory[cat.id];
    const allRf = catData?.models?.rf || [];
    const allUa = catData?.models?.ua || [];
    const catTitle = tProj.categories?.items?.[cat.id] || cat.id;
    return {
      id: cat.id,
      title: catTitle,
      icon: createElement(CategoryIcon, { category: cat.id, className: 'h-4 w-auto shrink-0' }),
      badge: cat.ratio ? fmt.ratio(cat.ratio) : undefined,
      lists: [
        {
          label: 'RF',
          total: cat.rf,
          color: lossColors.rf,
          items: allRf.map((m) => ({ name: m.name, value: m.count })),
        },
        {
          label: 'UA',
          total: cat.ua,
          color: lossColors.ua,
          items: allUa.map((m) => ({ name: m.name, value: m.count })),
        },
      ],
    };
  });
}

function buildDynamicCategories(
  points: LossMapPoint[],
  categories: WarLossCategory[],
  models: string[],
  filters: LossesFilterState,
  tProj: WarLossesDict,
  fmt: LocalizedFormatters,
): BreakdownCategory[] {
  const { selectedSide, selectedCategories, selectedModels, dateFrom, dateTo } = filters;
  const sideIdx = selectedSide === 'rf' ? 0 : selectedSide === 'ua' ? 1 : selectedSide === 'unk' ? 2 : -1;
  const stats = new Map<number, { rf: number; ua: number; unk: number; rfModels: Map<number, number>; uaModels: Map<number, number>; unkModels: Map<number, number> }>();

  for (const p of points) {
    if (dateFrom || dateTo) {
      if (!p[5]) continue;
      const dFrom = p[5].length === 7 ? `${p[5]}-31` : p[5];
      const dTo = p[5].length === 7 ? `${p[5]}-01` : p[5];
      if (dateFrom && dFrom < dateFrom) continue;
      if (dateTo && dTo > dateTo) continue;
    }
    if (selectedCategories.length > 0 && !selectedCategories.includes(p[3])) continue;
    if (selectedModels.length > 0 && !selectedModels.includes(p[4])) continue;
    if (selectedSide !== 'all' && p[2] !== sideIdx) continue;

    let s = stats.get(p[3]);
    if (!s) {
      s = { rf: 0, ua: 0, unk: 0, rfModels: new Map(), uaModels: new Map(), unkModels: new Map() };
      stats.set(p[3], s);
    }
    if (p[2] === 0) {
      s.rf++;
      s.rfModels.set(p[4], (s.rfModels.get(p[4]) || 0) + 1);
    } else if (p[2] === 1) {
      s.ua++;
      s.uaModels.set(p[4], (s.uaModels.get(p[4]) || 0) + 1);
    } else if (p[2] === 2) {
      s.unk++;
      s.unkModels.set(p[4], (s.unkModels.get(p[4]) || 0) + 1);
    }
  }

  const toItems = (m: Map<number, number>) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([idx, count]) => ({ name: models[idx] || '', value: count }));

  return Array.from(stats.entries())
    .sort((a, b) => b[1].rf + b[1].ua + b[1].unk - (a[1].rf + a[1].ua + a[1].unk))
    .map(([cIdx, s]) => {
      const catKey = categories[cIdx];
      const lists: BreakdownList[] = [];
      if (selectedSide === 'all' || selectedSide === 'rf') {
        lists.push({ label: 'RF', total: s.rf, color: lossColors.rf, items: toItems(s.rfModels) });
      }
      if (selectedSide === 'all' || selectedSide === 'ua') {
        lists.push({ label: 'UA', total: s.ua, color: lossColors.ua, items: toItems(s.uaModels) });
      }
      if (selectedSide === 'unk' || (selectedSide === 'all' && s.unk > 0)) {
        lists.push({ label: '?', total: s.unk, color: lossColors.unk, items: toItems(s.unkModels) });
      }

      return {
        id: catKey,
        title: tProj.categories?.items?.[catKey] || catKey,
        icon: createElement(CategoryIcon, { category: catKey, className: 'h-4 w-auto shrink-0' }),
        badge: selectedSide === 'all' && s.rf > 0 && s.ua > 0 ? fmt.ratio(s.rf, s.ua, 2) : undefined,
        lists,
      };
    });
}

/** Section builder for Equipment Losses Detailed Breakdown Grid. */
export const equipmentBreakdownSection: SectionBuilder<EquipmentBreakdownSectionData, WarLossesDict> = ({ t, fmt }) =>
  breakdownGridSection({
    id: 'equipment-breakdown',
    title: t.proj.categories.breakdownTitle,
    sources: [{ name: 'LostArmour / WarInUA (@lost_warinua)', url: 'https://t.me/lost_warinua' }],
    previewLimit: 5,
    categories: (data) => buildStaticCategories(data, t.proj, fmt),
    dynamicCategories: (_data, filters: LossesFilterState) =>
      filters.mapData ? buildDynamicCategories(filters.mapData.points, filters.mapData.categories, filters.mapData.models, filters, t.proj, fmt) : [],
  });
