import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for Space Launches dashboard. */
export const meta = {
  id: 'space-launches',
  tags: ['global', 'space', 'launches'],
  sources: [{ name: 'The Space Devs (Launch Library 2 API)', url: 'https://ll.thespacedevs.com/2.3.0/launches/' }],
  sections: ['payload-capacity', 'launch-costs', 'avg-payload', 'failure-rates'],
} as const satisfies StaticProjectMeta<'space-launches'>;
