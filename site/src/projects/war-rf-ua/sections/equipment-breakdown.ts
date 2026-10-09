import type { EquipmentBreakdownSectionData } from '@graphs/types/war-rf-ua/equipment-breakdown';
import { createElement } from 'react';
import { breakdownGridSection, type SectionBuilder } from '@/types';
import { CategoryIcon } from '../components/CategoryIcon';
import type { dict } from '../locales/dict-en';
import { lossColors } from '../tokens';

/** Section builder for Equipment Losses Detailed Breakdown Grid. */
export const equipmentBreakdownSection: SectionBuilder<EquipmentBreakdownSectionData, typeof dict> = ({ t, fmt }) =>
  breakdownGridSection({
    id: 'equipment-breakdown',
    title: t.proj.categories.breakdownTitle,
    sources: [{ name: 'LostArmour / WarInUA (@lost_warinua)', url: 'https://t.me/lost_warinua' }],
    previewLimit: 5,
    categories: (data) =>
      data.summary.categories.map((cat) => {
        const catData = data.byCategory[cat.id];
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
              color: lossColors.rf,
              items: allRf.map((m) => ({ name: m.name, value: m.count })),
            },
            {
              label: 'UA',
              total: cat.ua,
              color: lossColors.ua,
              items: allUa.map((m) => ({ name: m.name, value: m.count })),
            },
          ],
        };
      }),
  });
