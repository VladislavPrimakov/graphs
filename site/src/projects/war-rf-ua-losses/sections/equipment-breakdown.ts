import { createElement } from 'react';
import { themeColors } from '@/styles/tokens';
import type { BreakdownGridSpec, SectionBuilder } from '@/types';
import { CategoryIcon } from '../components/CategoryIcon';
import type { dict } from '../locales/dict-en';

/** Section builder for Equipment Losses Detailed Breakdown Grid. */
export const equipmentBreakdownSection: SectionBuilder<'war-rf-ua-losses', typeof dict> = ({ data, t, fmt }): BreakdownGridSpec => {
  const { summary, byCategory } = data;

  return {
    type: 'breakdown-grid',
    id: 'equipment-breakdown',
    previewLimit: 5,
    categories: summary.categories.map((cat) => {
      const catData = byCategory[cat.id];
      const allRf = catData?.models?.rf || [];
      const allUa = catData?.models?.ua || [];
      const catTitle = t.proj.categories.items[cat.id];
      return {
        id: cat.id,
        title: catTitle,
        icon: createElement(CategoryIcon, { category: cat.id, className: 'h-4 w-auto shrink-0' }),
        badge: cat.ratio ? fmt.ratio(cat.ratio) : undefined,
        lists: [
          {
            label: 'RF',
            total: cat.rf,
            color: themeColors.losses.rf,
            items: allRf.map((m) => ({ name: m.name, value: m.count })),
          },
          {
            label: 'UA',
            total: cat.ua,
            color: themeColors.losses.ua,
            items: allUa.map((m) => ({ name: m.name, value: m.count })),
          },
        ],
      };
    }),
  };
};
