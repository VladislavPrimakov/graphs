import type { AttacksSummary, AttackTimelineSeries } from './attacks';

/** Section dataset for missile-strikes. */
export interface MissileStrikesSectionData {
  rfAttacks: { summary: AttacksSummary };
  uaAttacks: { summary: AttacksSummary };
  unifiedTimeline: {
    monthly: AttackTimelineSeries;
    daily: AttackTimelineSeries;
  };
}
