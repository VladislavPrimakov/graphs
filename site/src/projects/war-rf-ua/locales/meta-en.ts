import type { ProjectLocaleMeta } from '@/utils/project';

export const meta = {
  title: 'War RF-UA',
  description: 'Verified database of Russian & Ukrainian military equipment losses (19k+ records), frontline dynamics, and air defense interceptions.',
  sections: {
    'frontline-map': 'Territory Map',
    'frontline-dynamics': 'Frontline Dynamics',
    'losses-map': 'Losses Map',
    'losses-timeline': 'Loss Dynamics',
    'losses-breakdown': 'Model Breakdown',
    'strikes-uav': 'UAV Attacks',
    'strikes-missile': 'Missile Strikes',
  },
} satisfies ProjectLocaleMeta;
