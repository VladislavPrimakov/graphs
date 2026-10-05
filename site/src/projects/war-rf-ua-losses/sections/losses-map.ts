import { createElement } from 'react';
import { customSection, type SectionBuilder } from '@/types';
import { LazyLossesMap } from '../components/LazyLossesMap';
import type { dict } from '../locales/dict-en';

/** Section builder for Equipment Losses Interactive Map. */
export const lossesMapSection: SectionBuilder<'war-rf-ua-losses', typeof dict> = ({ data, t }) =>
  customSection({
    id: 'losses-map',
    title: t.proj.map.title,
    render: () => createElement(LazyLossesMap, { data: data.map, t: t.proj }),
  });
