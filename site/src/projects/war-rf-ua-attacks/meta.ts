import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for War RF-UA Attacks dashboard. */
export const meta = {
  id: 'war-rf-ua-attacks',
  tags: ['war', 'uav', 'missiles', 'air-defense', 'ua', 'rf'],
  sources: [
    { name: 'Air Force of the Armed Forces of Ukraine', url: 'https://t.me/kpszsu' },
    { name: 'Ministry of Defence of the Russian Federation', url: 'https://t.me/mod_russia' },
  ],
  sections: ['uav-dynamics', 'missile-strikes'],
} as const satisfies StaticProjectMeta<'war-rf-ua-attacks'>;
