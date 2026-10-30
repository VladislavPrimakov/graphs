import type { DayFrontlineEntry, FrontlineMapSectionData } from '@graphs/shared/types/war-rf-ua/frontline';
import type { WarRfUaToolbarMeta } from '@graphs/shared/types/war-rf-ua/toolbar-meta';
import { createElement, lazy } from 'react';
import { defineSection, loadDataset, type ProjectContext } from '@/utils/project';
import type { dict } from '../locales/dict-en';

const FrontlineMap = lazy(() => import('../components/FrontlineMap').then((m) => ({ default: m.FrontlineMap })));

const START_YEAR = 2022;

let frontlineHistoryPromise: Promise<Record<string, DayFrontlineEntry>> | null = null;

/** Loads and merges partitioned yearly frontline history datasets with singleton promise caching. */
function loadFrontlineHistory(): Promise<Record<string, DayFrontlineEntry>> {
  if (!frontlineHistoryPromise) {
    frontlineHistoryPromise = loadDataset<WarRfUaToolbarMeta>('war-rf-ua', 'toolbar-meta.json').then(async (toolbarMeta) => {
      const endYear = Number(toolbarMeta.frontline.maxDate.slice(0, 4)) || START_YEAR;
      const frontlineYears = Array.from({ length: Math.max(1, endYear - START_YEAR + 1) }, (_, i) => String(START_YEAR + i));
      const datasets = await Promise.all(frontlineYears.map((year) => loadDataset<Record<string, DayFrontlineEntry>>('war-rf-ua', `frontline-history-${year}.json`)));
      const merged: Record<string, DayFrontlineEntry> = {};
      for (const dataset of datasets) {
        Object.assign(merged, dataset);
      }
      return merged;
    });
  }
  return frontlineHistoryPromise;
}

/** Section builder for Territorial Control & Frontline Discrepancy Map. */
export const frontlineMapSection = defineSection(({ t }: ProjectContext<typeof dict>) => ({
  id: 'frontline-map',
  title: t.proj.frontline.sectionTitle,
  sources: [
    { name: 'DeepStateMAP', url: 'https://deepstatemap.live' },
    { name: 'LostArmour', url: 'https://lostarmour.info/map' },
  ],
  data: {
    frontlineData: () => loadDataset<FrontlineMapSectionData>('war-rf-ua', 'frontline-map.json'),
    frontlineHistory: loadFrontlineHistory,
  },
  buildView: ({ frontlineData, frontlineHistory }, { frontlineStore }) => ({
    content: createElement(FrontlineMap, {
      data: frontlineData,
      history: frontlineHistory,
      targetDate: frontlineStore.period[1],
      t: t.proj,
    }),
  }),
}));
