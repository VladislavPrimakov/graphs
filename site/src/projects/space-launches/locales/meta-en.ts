import type { ProjectLocaleMeta } from '@/utils/project';

export const meta = {
  title: 'Space Launches',
  description: 'Seven decades of orbital spaceflight: payload mass delivered to orbit by nation, launch economics ($/kg), and reliability trends.',
  sections: {
    'payload-capacity': 'Payload Capacity',
    'avg-payload': 'Avg Payload Mass',
    'launch-costs': 'Cost per Kg',
    'failure-rates': 'Failure Rates',
  },
} satisfies ProjectLocaleMeta;
