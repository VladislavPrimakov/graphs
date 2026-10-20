import type { FrontlineMapSectionData } from '@graphs/types/war-rf-ua/frontline';
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
    frontline: () => loadDataset<FrontlineMapSectionData>('war-rf-ua', 'frontline-map.json'),
  },
  buildView: ({ frontline: data }, { frontline }) => ({
    content: createElement(FrontlineMap, {
      data,
      targetDate: frontline?.period?.[1],
      t: t.proj,
    }),
  }),
}));
