import { describe, expect, it } from 'bun:test';
import { getRawDataPath, readJson } from '@/utils/fs';
import type { SpaceLaunchesPipelineCache } from './index';

describe('space-launches data validation', async () => {
  const dataPath = getRawDataPath('space-launches');
  const data = await readJson<SpaceLaunchesPipelineCache>(dataPath);
  const launches = data?.launches ?? [];

  it('contains historical orbital launches', () => {
    expect(launches.length).toBeGreaterThan(0);
  });

  it('ensures payload mass (leo_kg) is defined and positive for every launch', () => {
    const missingPayload = launches.filter((l) => typeof l.leo_kg !== 'number' || l.leo_kg <= 0);
    if (missingPayload.length > 0) {
      const sample = missingPayload.slice(0, 10).map((l) => ({
        id: l.id,
        year: l.year,
        net: l.net,
        region: l.region,
        status: l.status,
        leo_kg: l.leo_kg,
      }));
      console.warn(`[WARN] Launches missing payload mass (leo_kg): ${missingPayload.length}/${launches.length}`);
      console.warn('Sample:', sample);
    }
    expect(missingPayload.length).toBe(0);
  });

  it('ensures high launch cost coverage across historical launches', () => {
    const missingCost = launches.filter((l) => typeof l.cost !== 'number' || l.cost <= 0);
    if (missingCost.length > 0) {
      const sample = missingCost.slice(0, 10).map((l) => ({
        id: l.id,
        year: l.year,
        net: l.net,
        region: l.region,
        status: l.status,
        cost: l.cost,
      }));
      console.warn(`[WARN] Launches missing launch cost: ${missingCost.length}/${launches.length}`);
      console.warn('Sample:', sample);
    }
    // Launch cost coverage is expected to exceed 94% (curated costs for operational orbital launchers)
    expect(missingCost.length).toBeLessThan(500);
  });
});
