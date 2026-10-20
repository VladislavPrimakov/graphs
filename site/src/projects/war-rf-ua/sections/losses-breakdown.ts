import type { LossEquipmentModel, LossesDataset } from '@graphs/types/war-rf-ua/losses';
import type { WarLossesFilterState } from '@graphs/types/war-rf-ua/toolbar-meta';
import { createElement } from 'react';
import { type BreakdownCategory, type BreakdownList, SectionBreakdown } from '@/components/sections/SectionBreakdown';
import type { LocalizedFormatters } from '@/utils/format';
import { defineSection, loadDataset, type ProjectContext } from '@/utils/project';
import { CategoryIcon } from '../components/CategoryIcon';
import { lossColors } from '../tokens';
import type { WarLossesDict } from '../types';

function buildCategories(data: LossesDataset, tProj: WarLossesDict, fmt: LocalizedFormatters, filters?: WarLossesFilterState): BreakdownCategory[] {
  const selectedSide = filters?.side ?? 'all';
  const selectedCategories = filters?.categories ?? [];
  const selectedModels = filters?.models ?? [];
  const [pFrom, pTo] = filters?.period ?? [];

  const periods = data.periods;
  const normFrom = pFrom ? (pFrom.length > 7 ? pFrom.slice(0, 7) : pFrom) : undefined;
  const normTo = pTo ? (pTo.length > 7 ? pTo.slice(0, 7) : pTo) : undefined;
  const isDateFiltered = Boolean(normFrom && normTo && periods.length > 0 && (normFrom !== periods[0] || normTo !== periods[periods.length - 1]));

  const fromIdx = normFrom ? periods.indexOf(normFrom) : 0;
  const toIdx = normTo ? periods.indexOf(normTo) : periods.length - 1;
  const startI = fromIdx === -1 ? 0 : fromIdx;
  const endI = toIdx === -1 ? periods.length - 1 : toIdx;

  const getModelCount = (m: LossEquipmentModel): number => {
    if (!isDateFiltered || !m.periods) return m.count;
    let sum = 0;
    for (let i = startI; i <= endI; i++) {
      sum += m.periods[i] || 0;
    }
    return sum;
  };

  let categories = data.summary.categories;
  if (selectedCategories.length > 0) {
    categories = categories.filter((c) => selectedCategories.includes(c.id));
  }

  const selectedModelSet = selectedModels.length > 0 ? new Set(selectedModels) : null;
  const needRf = selectedSide === 'all' || selectedSide === 'rf';
  const needUa = selectedSide === 'all' || selectedSide === 'ua';

  const categoryCards: (BreakdownCategory & { totalCount: number })[] = [];

  for (const cat of categories) {
    const catDetail = data.byCategory[cat.id];
    const catTitle = tProj.categories.items[cat.id] || cat.id;

    const rfModels = catDetail?.models?.rf || [];
    const uaModels = catDetail?.models?.ua || [];

    const rfFiltered = rfModels
      .filter((m) => !selectedModelSet || selectedModelSet.has(m.name))
      .map((m) => ({ name: m.name, value: getModelCount(m) }))
      .filter((m) => m.value > 0);

    const uaFiltered = uaModels
      .filter((m) => !selectedModelSet || selectedModelSet.has(m.name))
      .map((m) => ({ name: m.name, value: getModelCount(m) }))
      .filter((m) => m.value > 0);

    if (isDateFiltered) {
      rfFiltered.sort((a, b) => b.value - a.value);
      uaFiltered.sort((a, b) => b.value - a.value);
    }

    const catRfTotal = rfFiltered.reduce((sum, m) => sum + m.value, 0);
    const catUaTotal = uaFiltered.reduce((sum, m) => sum + m.value, 0);

    if (catRfTotal === 0 && catUaTotal === 0) {
      continue;
    }

    const lists: BreakdownList[] = [];
    if (needRf) {
      lists.push({
        label: fmt.region('RU'),
        total: catRfTotal,
        color: lossColors.rf,
        items: rfFiltered,
      });
    }

    if (needUa) {
      lists.push({
        label: fmt.region('UA'),
        total: catUaTotal,
        color: lossColors.ua,
        items: uaFiltered,
      });
    }

    const ratio = fmt.ratio(catRfTotal, catUaTotal);

    categoryCards.push({
      id: cat.id,
      title: catTitle,
      icon: createElement(CategoryIcon, { category: cat.id, className: 'h-4 w-auto shrink-0' }),
      badge: selectedSide === 'all' ? ratio : undefined,
      totalCount: catRfTotal + catUaTotal,
      lists,
    });
  }

  if (isDateFiltered) {
    categoryCards.sort((a, b) => b.totalCount - a.totalCount);
  }

  return categoryCards;
}

/** Section builder for Equipment Losses Detailed Breakdown Grid. */
export const lossesBreakdownSection = defineSection(({ t, fmt }: ProjectContext<WarLossesDict>) => ({
  id: 'losses-breakdown',
  title: t.proj.categories.breakdownTitle,
  sources: [{ name: 'LostArmour / WarInUA (@lost_warinua)', url: 'https://t.me/lost_warinua' }],
  data: {
    losses: () => loadDataset<LossesDataset>('war-rf-ua', 'losses.json'),
  },
  buildView: ({ losses: data }, { losses }) => {
    const categories = buildCategories(data, t.proj, fmt, losses);

    return {
      content: createElement(SectionBreakdown, { categories, previewLimit: 5 }),
    };
  },
}));
