import type { StaticProjectMeta } from '@/types';

/** Static metadata descriptor for War RF-UA Losses dashboard. */
export const meta: StaticProjectMeta<'war-rf-ua-losses'> = {
  id: 'war-rf-ua-losses',
  tags: ['rf', 'ua', 'war', 'losses', 'equipment'],
  sources: [{ name: 'LostArmour / WarInUA (@lost_warinua)', url: 'https://t.me/lost_warinua' }],
};
