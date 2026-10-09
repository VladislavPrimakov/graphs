import type { FrontlineMapSectionData } from '@graphs/types/war-rf-ua/frontline-map';
import { createElement, lazy } from 'react';
import { customSection, type SectionBuilder } from '@/types';
import type { dict } from '../locales/dict-en';

const FrontlineMap = lazy(() => import('../components/FrontlineMap').then((m) => ({ default: m.FrontlineMap })));

/** Section builder for Territorial Control & Frontline Discrepancy Map. */
export const frontlineMapSection: SectionBuilder<FrontlineMapSectionData, typeof dict> = ({ t }) =>
  customSection({
    id: 'frontline-map',
    title: t.proj.frontline.sectionTitle,
    sources: [
      { name: 'DeepStateMAP', url: 'https://deepstatemap.live' },
      { name: 'LostArmour', url: 'https://lostarmour.info/map' },
    ],
    render: (data) => createElement(FrontlineMap, { data, t: t.proj }),
  });
