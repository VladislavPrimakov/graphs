import type { LossesMapSectionData } from '@graphs/types/war-rf-ua/losses-map';
import { createElement, lazy } from 'react';
import { customSection, type SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';

const LossesMap = lazy(() => import('../components/LossesMap').then((m) => ({ default: m.LossesMap })));

/** Section builder for Equipment Losses Interactive Map. */
export const lossesMapSection: SectionBuilder<LossesMapSectionData, typeof dict> = ({ t }) =>
  customSection({
    id: 'losses-map',
    title: t.proj.map.title,
    sources: [{ name: 'LostArmour / WarInUA (@lost_warinua)', url: 'https://t.me/lost_warinua' }],
    render: (data) => createElement(LossesMap, { data, t: t.proj }),
  });
