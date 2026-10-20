import type { LossesMapSectionData } from '@graphs/types/war-rf-ua/losses';
import { createElement, lazy } from 'react';
import { defineSection, loadDataset, type ProjectContext } from '@/utils/project';
import type { dict } from '../locales/dict-en';

const LossesMap = lazy(() => import('../components/LossesMap').then((m) => ({ default: m.LossesMap })));

/** Section builder for Equipment Losses Interactive Map. */
export const lossesMapSection = defineSection(({ t }: ProjectContext<typeof dict>) => ({
  id: 'losses-map',
  title: t.proj.map.title,
  sources: [{ name: 'LostArmour / WarInUA (@lost_warinua)', url: 'https://t.me/lost_warinua' }],
  data: {
    losses: () => loadDataset<LossesMapSectionData>('war-rf-ua', 'losses-map.json'),
  },
  buildView: ({ losses: data }, { losses }) => ({
    content: createElement(LossesMap, { data, t: t.proj, filters: losses }),
  }),
}));
