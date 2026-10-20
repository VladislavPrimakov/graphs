import type { ProjectManifest } from '@/utils/project';

/** Static metadata descriptor for Space Launches dashboard. */
export const meta = {
  id: 'space-launches',
  tags: ['global', 'space', 'launches'],
  sections: ['payload-capacity', 'avg-payload', 'launch-costs', 'failure-rates'],
} as const satisfies ProjectManifest;
