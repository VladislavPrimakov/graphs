import type { LocaleProjectMeta } from '@/types';

export const meta = {
  title: 'Space Launches',
  description:
    'Historical analysis of orbital spaceflight across seven decades: annual payload mass delivered to orbit by nation, launch economics ($/kg to LEO/SSO), average payload per launch, and launch reliability trends.',
  sections: {
    'payload-capacity': 'Payload Capacity',
    'launch-costs': 'Cost per Kg',
    'avg-payload': 'Avg Payload Mass',
    'failure-rates': 'Failure Rates',
  },
} satisfies LocaleProjectMeta;
