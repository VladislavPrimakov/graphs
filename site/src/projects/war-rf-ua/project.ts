import { WAR_LOSS_CATEGORIES } from '@graphs/types/war-rf-ua/losses';
import type { WarRfUaToolbarMeta } from '@graphs/types/war-rf-ua/toolbar-meta';
import { createElement } from 'react';
import { type ControlSearchItem, defineProject, loadDataset, type ProjectSection } from '@/utils/project';
import { CategoryIcon } from './components/CategoryIcon';
import type { dict } from './locales/dict-en';
import { meta } from './meta';

/** Resolves bounding period indices from reactive timeline scrubber filter state. */
function getPeriodIndices(periods: string[], periodState?: unknown): [number, number] {
  if (!Array.isArray(periodState) || periodState.length < 2) {
    return [0, periods.length - 1];
  }
  const fromStr = String(periodState[0]);
  const toStr = String(periodState[1]);
  const sampleLen = periods[0]?.length;
  const targetFrom = sampleLen && fromStr.length > sampleLen ? fromStr.slice(0, sampleLen) : fromStr;
  const targetTo = sampleLen && toStr.length > sampleLen ? toStr.slice(0, sampleLen) : toStr;

  let startIdx = periods.indexOf(targetFrom);
  if (startIdx === -1) {
    startIdx = periods.findIndex((p) => p >= targetFrom);
    if (startIdx === -1) startIdx = 0;
  }

  let endIdx = periods.indexOf(targetTo);
  if (endIdx === -1) {
    endIdx = periods.findLastIndex((p) => p <= targetTo || p.startsWith(targetTo));
    if (endIdx === -1) endIdx = periods.length - 1;
  }

  if (startIdx > endIdx) {
    startIdx = 0;
    endIdx = periods.length - 1;
  }

  return [Math.max(0, startIdx), Math.min(periods.length - 1, endIdx)];
}

const data = {
  toolbarMeta: () => loadDataset<WarRfUaToolbarMeta>('war-rf-ua', 'toolbar-meta.json'),
};

export type Section = ProjectSection<typeof data, typeof dict>;

/** Universal project definition for War RF-UA dashboard. */
export const project = defineProject<typeof dict, typeof data>({
  meta,
  data,
  sections: import.meta.glob('./sections/*.ts', { eager: true }),
  toolbars: ({ toolbarMeta }, { t, fmt }) => {
    return [
      {
        id: 'frontline',
        scope: ['frontline-map', 'frontline-dynamics'],
        controls: [
          {
            id: 'period',
            type: 'timeline-scrubber',
            granularity: 'daily',
            periods: toolbarMeta.frontline.periods,
            density: toolbarMeta.frontline.density,
            defaultValue: [toolbarMeta.frontline.periods[0], toolbarMeta.frontline.periods[toolbarMeta.frontline.periods.length - 1]],
          },
        ],
      },
      {
        id: 'losses',
        scope: ['losses-map', 'losses-timeline', 'losses-breakdown'],
        controls: [
          {
            id: 'side',
            type: 'toggle',
            options: (state) => {
              const [startIdx, endIdx] = getPeriodIndices(toolbarMeta.losses.periods, state.period);
              const selectedCats =
                Array.isArray(state.categories) && state.categories.length > 0 ? new Set(state.categories.map((c) => WAR_LOSS_CATEGORIES.indexOf(c as (typeof WAR_LOSS_CATEGORIES)[number]))) : null;
              const selectedModels = Array.isArray(state.models) && state.models.length > 0 ? new Set(state.models as string[]) : null;

              let rfCount = 0;
              let uaCount = 0;
              let unkCount = 0;

              if (selectedModels) {
                const isAllPeriods = startIdx === 0 && endIdx === toolbarMeta.losses.periods.length - 1;
                for (const m of toolbarMeta.losses.models) {
                  if (!selectedModels.has(m.name)) continue;
                  if (selectedCats && !selectedCats.has(m.cat)) continue;

                  if (isAllPeriods) {
                    rfCount += m.rf;
                    uaCount += m.ua;
                    unkCount += m.unk ?? 0;
                  } else if (m.timeline) {
                    const tl = m.timeline;
                    for (let i = 0; i < tl.length; i += 4) {
                      const p = tl[i];
                      if (p >= startIdx && p <= endIdx) {
                        rfCount += tl[i + 1];
                        uaCount += tl[i + 2];
                        unkCount += tl[i + 3];
                      }
                    }
                  }
                }
              } else {
                const matrix = toolbarMeta.losses.matrix;
                for (let p = startIdx; p <= endIdx; p++) {
                  const pMatrix = matrix[p];
                  if (!pMatrix) continue;
                  if (selectedCats) {
                    for (const c of selectedCats) {
                      rfCount += pMatrix[0][c] || 0;
                      uaCount += pMatrix[1][c] || 0;
                      unkCount += pMatrix[2][c] || 0;
                    }
                  } else {
                    for (let c = 0; c < WAR_LOSS_CATEGORIES.length; c++) {
                      rfCount += pMatrix[0][c] || 0;
                      uaCount += pMatrix[1][c] || 0;
                      unkCount += pMatrix[2][c] || 0;
                    }
                  }
                }
              }

              const allCount = rfCount + uaCount + unkCount;

              return [
                { value: 'all', label: `${t.proj.map.allSides} (${fmt.number(allCount)})` },
                { value: 'rf', label: `RF (${fmt.number(rfCount)})` },
                { value: 'ua', label: `UA (${fmt.number(uaCount)})` },
                { value: 'unk', label: `? (${fmt.number(unkCount)})` },
              ];
            },
            defaultValue: 'all',
          },
          {
            id: 'categories',
            type: 'multi-search-select',
            placeholder: t.proj.map.categories,
            emptyLabel: t.proj.map.noCategoriesFound,
            allLabel: t.proj.map.allCategories,
            items: (state) => {
              const [startIdx, endIdx] = getPeriodIndices(toolbarMeta.losses.periods, state.period);
              const side = (state.side as string) ?? 'all';
              const matrix = toolbarMeta.losses.matrix;
              const catCounts = new Int32Array(WAR_LOSS_CATEGORIES.length);

              for (let p = startIdx; p <= endIdx; p++) {
                const pMatrix = matrix[p];
                if (!pMatrix) continue;
                for (let c = 0; c < WAR_LOSS_CATEGORIES.length; c++) {
                  if (side === 'rf') catCounts[c] += pMatrix[0][c] || 0;
                  else if (side === 'ua') catCounts[c] += pMatrix[1][c] || 0;
                  else if (side === 'unk') catCounts[c] += pMatrix[2][c] || 0;
                  else catCounts[c] += (pMatrix[0][c] || 0) + (pMatrix[1][c] || 0) + (pMatrix[2][c] || 0);
                }
              }

              return WAR_LOSS_CATEGORIES.map((catKey, c) => ({
                value: catKey,
                label: t.proj.categories.items[catKey] || catKey,
                count: catCounts[c],
                icon: createElement(CategoryIcon, { category: catKey, className: 'h-3 w-auto shrink-0' }),
              }));
            },
          },
          {
            id: 'models',
            type: 'multi-search-select',
            placeholder: t.proj.map.models,
            emptyLabel: t.proj.map.noModelsFound,
            allLabel: t.proj.map.allModels,
            items: (state) => {
              const [startIdx, endIdx] = getPeriodIndices(toolbarMeta.losses.periods, state.period);
              const side = (state.side as string) ?? 'all';
              const selectedCats =
                Array.isArray(state.categories) && state.categories.length > 0 ? new Set(state.categories.map((c) => WAR_LOSS_CATEGORIES.indexOf(c as (typeof WAR_LOSS_CATEGORIES)[number]))) : null;
              const selectedModels = Array.isArray(state.models) ? (state.models as string[]) : [];
              const selectedModelSet = new Set(selectedModels);
              const isAllPeriods = startIdx === 0 && endIdx === toolbarMeta.losses.periods.length - 1;

              const result: ControlSearchItem[] = [];

              for (const m of toolbarMeta.losses.models) {
                const isSelected = selectedModelSet.has(m.name);
                if (selectedCats && !selectedCats.has(m.cat) && !isSelected) {
                  continue;
                }

                let mCount = 0;
                if (isAllPeriods) {
                  if (side === 'rf') mCount = m.rf;
                  else if (side === 'ua') mCount = m.ua;
                  else if (side === 'unk') mCount = m.unk ?? 0;
                  else mCount = m.count;
                } else if (m.timeline) {
                  const tl = m.timeline;
                  for (let i = 0; i < tl.length; i += 4) {
                    const p = tl[i];
                    if (p >= startIdx && p <= endIdx) {
                      if (side === 'rf') mCount += tl[i + 1];
                      else if (side === 'ua') mCount += tl[i + 2];
                      else if (side === 'unk') mCount += tl[i + 3];
                      else mCount += tl[i + 1] + tl[i + 2] + tl[i + 3];
                    }
                  }
                }

                if (mCount === 0 && !isSelected) {
                  continue;
                }

                const catId = WAR_LOSS_CATEGORIES[m.cat];
                result.push({
                  value: m.name,
                  label: m.name,
                  count: mCount,
                  icon: catId ? createElement(CategoryIcon, { category: catId, className: 'h-3 w-auto shrink-0' }) : undefined,
                });
              }

              return result;
            },
          },
          {
            id: 'period',
            type: 'timeline-scrubber',
            granularity: 'monthly',
            periods: toolbarMeta.losses.periods,
            density: toolbarMeta.losses.density,
            defaultValue: [toolbarMeta.losses.periods[0], toolbarMeta.losses.periods[toolbarMeta.losses.periods.length - 1]],
          },
        ],
      },
      {
        id: 'strikes',
        scope: ['strikes-uav', 'strikes-missile'],
        controls: [
          {
            id: 'period',
            type: 'toggle',
            defaultValue: 'monthly',
            label: t.common.period,
            options: [
              { value: 'monthly', label: t.common.monthly },
              { value: 'daily', label: t.common.daily },
            ],
          },
        ] as const,
      },
    ];
  },
});
