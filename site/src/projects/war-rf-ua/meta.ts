import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for War RF-UA dashboard. */
export const meta = {
  id: 'war-rf-ua',
  tags: ['war', 'frontline', 'losses', 'equipment', 'missiles', 'uav', 'air-defense', 'rf', 'ua'],
  sections: ['frontline-map', 'frontline-dynamics', 'losses-map', 'losses-timeline', 'category-losses', 'equipment-breakdown', 'uav-strikes', 'missile-strikes'],
} as const satisfies StaticProjectMeta<'war-rf-ua'>;
