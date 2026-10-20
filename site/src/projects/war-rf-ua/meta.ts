import type { ProjectManifest } from '@/utils/project';

/** Static metadata descriptor for War RF-UA dashboard. */
export const meta = {
  id: 'war-rf-ua',
  tags: ['war', 'frontline', 'losses', 'equipment', 'missiles', 'uav', 'air-defense', 'rf', 'ua'],
  sections: ['frontline-map', 'frontline-dynamics', 'losses-map', 'losses-timeline', 'losses-breakdown', 'strikes-uav', 'strikes-missile'],
} as const satisfies ProjectManifest;
