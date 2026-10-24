import type { FrontlineDynamicsMonthly, FrontlineDynamicsSectionData, FrontlineTimelinePoint, WarFrontlineDataset } from '@graphs/shared/types/war-rf-ua/frontline';
import type { WarFrontlineToolbarMeta, WarLossModelMeta, WarRfUaToolbarMeta } from '@graphs/shared/types/war-rf-ua/toolbar-meta';
import { exportDataset } from '@/utils/dataset';
import { getPipelineLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
import { round } from '@/utils/math';
import { parseRfAttacks } from './parse-attacks-rf';
import { parseUaAttacks } from './parse-attacks-ua';
import { parseFrontline } from './parse-frontline';
import { parseLosses } from './parse-losses';

interface AttackDataSubRecord {
  uavs: number;
  ballistic: number;
  cruise: number;
  missiles: number;
}

/** Builds unified monthly time series aligning RF and UA data points. */
function buildUnifiedMonthly(
  rfMonthly: { periods: string[]; uavs: number[]; ballistic: number[]; cruise: number[]; totalMissiles: number[] },
  uaMonthly: { periods: string[]; uavs: number[]; ballistic: number[]; cruise: number[]; totalMissiles: number[] },
) {
  const rfDict: Record<string, AttackDataSubRecord> = {};
  rfMonthly.periods.forEach((p, idx) => {
    rfDict[p] = {
      uavs: rfMonthly.uavs[idx] || 0,
      ballistic: rfMonthly.ballistic[idx] || 0,
      cruise: rfMonthly.cruise[idx] || 0,
      missiles: rfMonthly.totalMissiles[idx] || 0,
    };
  });

  const uaDict: Record<string, AttackDataSubRecord> = {};
  uaMonthly.periods.forEach((p, idx) => {
    uaDict[p] = {
      uavs: uaMonthly.uavs[idx] || 0,
      ballistic: uaMonthly.ballistic[idx] || 0,
      cruise: uaMonthly.cruise[idx] || 0,
      missiles: uaMonthly.totalMissiles[idx] || 0,
    };
  });

  const allPeriods = Array.from(new Set([...Object.keys(rfDict), ...Object.keys(uaDict)])).sort();
  const labels = allPeriods.map((p) => `${p.split('-')[1]}.${p.split('-')[0].slice(-2)}`);

  return {
    periods: allPeriods,
    labels,
    rfUavs: allPeriods.map((p) => rfDict[p]?.uavs || 0),
    rfBallistic: allPeriods.map((p) => rfDict[p]?.ballistic || 0),
    rfCruise: allPeriods.map((p) => rfDict[p]?.cruise || 0),
    uaUavs: allPeriods.map((p) => uaDict[p]?.uavs || 0),
    uaBallistic: allPeriods.map((p) => uaDict[p]?.ballistic || 0),
    uaCruise: allPeriods.map((p) => uaDict[p]?.cruise || 0),
  };
}

/** Builds unified daily time series aligning RF and UA data points. */
function buildUnifiedDaily(
  rfDaily: { dates: string[]; uavs: number[]; ballistic: number[]; cruise: number[]; totalMissiles: number[] },
  uaDaily: { dates: string[]; uavs: number[]; ballistic: number[]; cruise: number[]; totalMissiles: number[] },
) {
  const rfDict: Record<string, AttackDataSubRecord> = {};
  rfDaily.dates.forEach((d, idx) => {
    rfDict[d] = {
      uavs: rfDaily.uavs[idx] || 0,
      ballistic: rfDaily.ballistic[idx] || 0,
      cruise: rfDaily.cruise[idx] || 0,
      missiles: rfDaily.totalMissiles[idx] || 0,
    };
  });

  const uaDict: Record<string, AttackDataSubRecord> = {};
  uaDaily.dates.forEach((d, idx) => {
    uaDict[d] = {
      uavs: uaDaily.uavs[idx] || 0,
      ballistic: uaDaily.ballistic[idx] || 0,
      cruise: uaDaily.cruise[idx] || 0,
      missiles: uaDaily.totalMissiles[idx] || 0,
    };
  });

  const allDates = Array.from(new Set([...Object.keys(rfDict), ...Object.keys(uaDict)])).sort();
  const labels = allDates.map((d) => `${d.split('-')[2]}.${d.split('-')[1]}.${d.split('-')[0].slice(-2)}`);

  return {
    dates: allDates,
    labels,
    rfUavs: allDates.map((d) => rfDict[d]?.uavs || 0),
    rfBallistic: allDates.map((d) => rfDict[d]?.ballistic || 0),
    rfCruise: allDates.map((d) => rfDict[d]?.cruise || 0),
    uaUavs: allDates.map((d) => uaDict[d]?.uavs || 0),
    uaBallistic: allDates.map((d) => uaDict[d]?.ballistic || 0),
    uaCruise: allDates.map((d) => uaDict[d]?.cruise || 0),
  };
}

/** Builds precomputed monthly and daily territorial control dynamics for the frontline-dynamics chart section. */
function buildFrontlineDynamics(frontline: WarFrontlineDataset): FrontlineDynamicsSectionData {
  const totalUkraineKm2 = frontline.summary.totalUkraineKm2 || 603628;
  const timeline = frontline.timeline.map((pt) => ({ ...pt }));

  // 1-day upstream anomaly smoothing (e.g. single-day corrupt/partial KML polygon download)
  for (let i = 1; i < timeline.length - 1; i++) {
    const prev = timeline[i - 1];
    const cur = timeline[i];
    const next = timeline[i + 1];
    if (Math.abs(cur.consensusRfKm2 - prev.consensusRfKm2) > 5000 && Math.abs(cur.consensusRfKm2 - next.consensusRfKm2) > 5000 && Math.abs(prev.consensusRfKm2 - next.consensusRfKm2) < 1000) {
      cur.consensusRfKm2 = round((prev.consensusRfKm2 + next.consensusRfKm2) / 2, 1);
      cur.disputedKm2 = round((prev.disputedKm2 + next.disputedKm2) / 2, 1);
      cur.consensusUaKm2 = round(totalUkraineKm2 - cur.consensusRfKm2 - cur.disputedKm2, 1);
    }
  }

  const monthMap = new Map<string, FrontlineTimelinePoint[]>();
  for (const pt of timeline) {
    const m = pt.date.slice(0, 7);
    const list = monthMap.get(m) || [];
    list.push(pt);
    monthMap.set(m, list);
  }

  const months = Array.from(monthMap.keys()).sort();
  const labels = months.map((m) => `${m.split('-')[1]}.${m.split('-')[0].slice(-2)}`);
  const years = Array.from(new Set(months.map((m) => Number(m.slice(0, 4))))).sort();

  const monthlyConsensusRf: number[] = [];
  const monthlyConsensusUa: number[] = [];
  const monthlyDisputed: number[] = [];
  const monthlyDsOccupied: number[] = [];
  const monthlyLaClaimed: number[] = [];
  const monthlyNetChange: number[] = [];
  const monthlyRfAdvance: number[] = [];
  const monthlyUaLiberated: number[] = [];

  for (const m of months) {
    const pts = monthMap.get(m) || [];
    const endPt = pts[pts.length - 1];

    const rfEnd = endPt.consensusRfKm2;
    const uaEnd = endPt.consensusUaKm2;
    const dispEnd = endPt.disputedKm2;
    const dsEnd = endPt.dsOccupiedKm2;
    const laEnd = endPt.laClaimedKm2;

    monthlyConsensusRf.push(rfEnd);
    monthlyConsensusUa.push(uaEnd);
    monthlyDisputed.push(dispEnd);
    monthlyDsOccupied.push(dsEnd);
    monthlyLaClaimed.push(laEnd);

    let rfAdv = 0;
    let uaLib = 0;
    for (const pt of pts) {
      if (pt.deltaKm2 > 0) rfAdv += pt.deltaKm2;
      else if (pt.deltaKm2 < 0) uaLib += Math.abs(pt.deltaKm2);
    }
    // Include initial invasion territorial capture for 2022-04 (from 2022-02-23 pre-war baseline)
    if (m === '2022-04' && timeline[0]) {
      const invasionCapture = Math.max(0, rfEnd - timeline[0].consensusRfKm2);
      rfAdv = round(invasionCapture + uaLib, 1);
    }
    const netDelta = round(rfAdv - uaLib, 1);
    monthlyNetChange.push(netDelta);
    monthlyRfAdvance.push(round(rfAdv, 1));
    monthlyUaLiberated.push(round(uaLib, 1));
  }

  const monthly: FrontlineDynamicsMonthly = {
    months,
    labels,
    years,
    consensusRfKm2: monthlyConsensusRf,
    consensusUaKm2: monthlyConsensusUa,
    disputedKm2: monthlyDisputed,
    dsOccupiedKm2: monthlyDsOccupied,
    laClaimedKm2: monthlyLaClaimed,
    consensusRfPct: monthlyConsensusRf.map((v) => round((v / totalUkraineKm2) * 100, 2)),
    consensusUaPct: monthlyConsensusUa.map((v) => round((v / totalUkraineKm2) * 100, 2)),
    disputedPct: monthlyDisputed.map((v) => round((v / totalUkraineKm2) * 100, 2)),
    netChangeKm2: monthlyNetChange,
    rfAdvanceKm2: monthlyRfAdvance,
    uaLiberatedKm2: monthlyUaLiberated,
  };

  return { monthly };
}

/** Runs the unified War RF-UA ETL Pipeline (losses, air strikes, frontline). */
export async function runWarRfUaPipeline(forceUpdate = false, verbose?: boolean): Promise<void> {
  return runWithLogger(
    'war-rf-ua',
    async () => {
      const logger = getPipelineLogger('war-rf-ua');
      logger.start('War RF-UA');

      logger.debug('Processing military equipment losses...');
      const losses = await parseLosses(forceUpdate);

      logger.debug('Processing RF air attacks on Ukraine (Kaggle)...');
      const rfData = await parseRfAttacks(forceUpdate);

      logger.debug('Processing UA air attacks on Russia (Telegram MoD)...');
      const uaData = await parseUaAttacks(undefined, forceUpdate);

      const unifiedMonthly = buildUnifiedMonthly(rfData.monthly!, uaData.monthly!);
      const unifiedDaily = buildUnifiedDaily(rfData.daily!, uaData.daily!);

      const attacks = {
        rfAttacks: { summary: rfData.summary },
        uaAttacks: { summary: uaData.summary },
        unifiedTimeline: {
          monthly: unifiedMonthly,
          daily: unifiedDaily,
        },
      };

      logger.debug('Processing territorial frontline comparison (DeepState vs LostArmour)...');
      const frontline = await parseFrontline(forceUpdate);
      const frontlineDynamics = buildFrontlineDynamics(frontline);

      const frontlinePeriods = frontline.timeline.map((p) => p.date);
      const frontlineDensity = frontline.timeline.map((p) => (p.deltaKm2 != null ? round(Math.abs(p.deltaKm2), 1) : 0));
      const frontlineMeta: WarFrontlineToolbarMeta = {
        minDate: frontlinePeriods[0] || '2023-01-28',
        maxDate: frontlinePeriods[frontlinePeriods.length - 1] || '2023-01-28',
        periods: frontlinePeriods,
        density: frontlineDensity,
      };

      const lossesDensity = losses.periods.map((_, i) => (losses.overallTimeline.rf[i] || 0) + (losses.overallTimeline.ua[i] || 0));

      const periodIndexMap = new Map(losses.periods.map((p, i) => [p, i]));
      const matrix: number[][][] = Array.from({ length: losses.periods.length }, () => [new Array(15).fill(0), new Array(15).fill(0), new Array(15).fill(0)]);

      interface ModelAccumulator {
        id: number;
        name: string;
        cat: number;
        count: number;
        rf: number;
        ua: number;
        unk: number;
        timelineMap: Map<number, [number, number, number]>;
      }

      const modelStats = new Map<number, ModelAccumulator>();
      for (let i = 0; i < losses.map.models.length; i++) {
        modelStats.set(i, {
          id: i,
          name: losses.map.models[i],
          cat: 0,
          count: 0,
          rf: 0,
          ua: 0,
          unk: 0,
          timelineMap: new Map(),
        });
      }

      for (const p of losses.map.points) {
        const sideIdx = p[2];
        const catIdx = p[3];
        const modelIdx = p[4];
        const dateStr = p[5];
        const pKey = dateStr ? dateStr.slice(0, 7) : '';
        const pIdx = periodIndexMap.get(pKey);
        if (pIdx !== undefined && sideIdx >= 0 && sideIdx <= 2 && catIdx >= 0 && catIdx < 15) {
          matrix[pIdx][sideIdx][catIdx]++;
        }

        const m = modelStats.get(modelIdx);
        if (m) {
          m.cat = catIdx;
          m.count++;
          if (sideIdx === 0) m.rf++;
          else if (sideIdx === 1) m.ua++;
          else m.unk++;

          if (pIdx !== undefined) {
            let t = m.timelineMap.get(pIdx);
            if (!t) {
              t = [0, 0, 0];
              m.timelineMap.set(pIdx, t);
            }
            if (sideIdx >= 0 && sideIdx <= 2) {
              t[sideIdx]++;
            }
          }
        }
      }

      const toolbarModels: WarLossModelMeta[] = Array.from(modelStats.values())
        .map((m) => {
          const timeline: number[] = [];
          for (const [pIdx, [rf, ua, unk]] of m.timelineMap.entries()) {
            timeline.push(pIdx, rf, ua, unk);
          }
          return {
            id: m.id,
            name: m.name,
            cat: m.cat,
            count: m.count,
            rf: m.rf,
            ua: m.ua,
            unk: m.unk,
            timeline,
          };
        })
        .sort((a, b) => b.count - a.count);

      const toolbarMeta: WarRfUaToolbarMeta = {
        frontline: frontlineMeta,
        losses: {
          periods: losses.periods,
          density: lossesDensity,
          models: toolbarModels,
          matrix,
        },
      };

      await exportDataset('war-rf-ua', toolbarMeta, 'toolbar-meta.json');

      const totalStrikes =
        rfData.summary.uavs.total + rfData.summary.ballistic.total + rfData.summary.cruise.total + uaData.summary.uavs.total + uaData.summary.ballistic.total + uaData.summary.cruise.total;

      if (!forceUpdate) {
        logger.unchanged(`${losses.summary.totalRecords.toLocaleString()} losses, ${totalStrikes.toLocaleString()} strikes, ${frontline.timeline.length.toLocaleString()} days cached`);
      }

      await exportDataset(
        'war-rf-ua',
        {
          summary: frontline.summary,
          timeline: frontline.timeline,
        },
        'frontline-map.json',
      );
      await exportDataset('war-rf-ua', frontlineDynamics, 'frontline-dynamics.json');
      await exportDataset('war-rf-ua', losses.map, 'losses-map.json');
      await exportDataset(
        'war-rf-ua',
        {
          periods: losses.periods,
          summary: losses.summary,
          overallTimeline: losses.overallTimeline,
          byCategory: losses.byCategory,
        },
        'losses.json',
      );
      await exportDataset(
        'war-rf-ua',
        {
          rfAttacks: attacks.rfAttacks,
          uaAttacks: attacks.uaAttacks,
          unifiedTimeline: attacks.unifiedTimeline,
        },
        'strikes.json',
      );

      if (forceUpdate) {
        logger.complete(`${losses.summary.totalRecords.toLocaleString()} losses, ${totalStrikes.toLocaleString()} strikes, ${frontline.timeline.length.toLocaleString()} frontline days`);
      }
    },
    verbose,
  );
}

if (import.meta.main) {
  runWarRfUaPipeline(isUpdate(), isVerbose()).catch((err) => {
    getPipelineLogger('war-rf-ua').error('Fatal error running war-rf-ua pipeline:', err);
    process.exit(1);
  });
}
