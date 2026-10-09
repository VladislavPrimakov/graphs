import type { LocaleProjectMeta } from '@/types';

export const meta = {
  title: 'Space Launches',
  description: 'Seven decades of orbital spaceflight: payload mass delivered to orbit by nation, launch economics ($/kg), and reliability trends.',
  sections: {
    'payload-capacity': 'Payload Capacity',
    'launch-costs': 'Cost per Kg',
    'avg-payload': 'Avg Payload Mass',
    'failure-rates': 'Failure Rates',
  },
} satisfies LocaleProjectMeta;
