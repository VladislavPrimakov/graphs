import type { FrontlineMapSectionData } from '@graphs/shared/types/war-rf-ua/frontline';
import { createElement, lazy } from 'react';
import { defineSection, loadDataset, type ProjectContext } from '@/utils/project';
import type { dict } from '../locales/dict-en';

const FrontlineMap = lazy(() => import('../components/FrontlineMap').then((m) => ({ default: m.FrontlineMap })));

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
