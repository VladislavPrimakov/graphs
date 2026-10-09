import type { AttacksSummary, AttackTimelineSeries } from './attacks';

/** Section dataset for uav-strikes. */
export interface UavStrikesSectionData {
  rfAttacks: { summary: AttacksSummary };
  uaAttacks: { summary: AttacksSummary };
  unifiedTimeline: {
    monthly: AttackTimelineSeries;
    daily: AttackTimelineSeries;
  };
}
