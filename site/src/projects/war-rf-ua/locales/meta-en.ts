import type { LocaleProjectMeta } from '@/types';

export const meta = {
  title: 'War RF-UA',
  description:
    'Comprehensive database of Russian and Ukrainian military equipment losses (19,000+ photo- and video-verified geo-tagged records across 14 categories) alongside daily and monthly air attacks and air defense interceptions.',
  sections: {
    'frontline-map': 'Territory Map',
    'frontline-dynamics': 'Frontline Dynamics',
    'losses-map': 'Losses Map',
    'losses-timeline': 'Loss Dynamics',
    'category-losses': 'Category Losses',
    'equipment-breakdown': 'Model Breakdown',
    'uav-strikes': 'UAV Attacks',
    'missile-strikes': 'Missile Strikes',
  },
} satisfies LocaleProjectMeta;
