import type { FrontlineDynamicsDaily, FrontlineDynamicsMonthly, FrontlineDynamicsSectionData, FrontlineDynamicsSummary } from '@graphs/types/war-rf-ua/frontline-dynamics';
import type { FrontlineTimelinePoint, WarFrontlineDataset } from '@graphs/types/war-rf-ua/frontline-map';
import { exportProjectSections } from '@/utils/dataset';
import { getLogger, isUpdate, isVerbose, runWithLogger } from '@/utils/logger';
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
  const labels = allDates.map((d) => `${d.split('-')[2]}.${d.split('-')[1]}`);

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

  let prevRf = timeline[0]?.consensusRfKm2 ?? 0;
  for (let i = 0; i < timeline.length; i++) {
    const curRf = timeline[i].consensusRfKm2;
    timeline[i].deltaKm2 = i === 0 ? 0 : round(curRf - prevRf, 1);
    prevRf = curRf;
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

  let prevMonthEndRf = months.length > 0 ? (monthMap.get(months[0])?.[0]?.consensusRfKm2 ?? 0) : 0;

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

    const netDelta = round(rfEnd - prevMonthEndRf, 1);
    monthlyNetChange.push(netDelta);

    let rfAdv = 0;
    let uaLib = 0;
    for (const pt of pts) {
      if (pt.deltaKm2 > 0) rfAdv += pt.deltaKm2;
      else if (pt.deltaKm2 < 0) uaLib += Math.abs(pt.deltaKm2);
    }
    monthlyRfAdvance.push(round(rfAdv, 1));
    monthlyUaLiberated.push(round(uaLib, 1));

    prevMonthEndRf = rfEnd;
  }

  let peakRfKm2 = 0;
  let peakRfDate = '';
  for (const pt of timeline) {
    if (pt.consensusRfKm2 > peakRfKm2) {
      peakRfKm2 = pt.consensusRfKm2;
      peakRfDate = pt.date;
    }
  }

  const latestPt = timeline[timeline.length - 1] || {
    date: frontline.summary.latestDate,
    consensusRfKm2: frontline.summary.consensusRfKm2,
    consensusUaKm2: frontline.summary.consensusUaKm2,
    disputedKm2: frontline.summary.disputedKm2,
  };

  const currentRfKm2 = latestPt.consensusRfKm2;
  const currentUaKm2 = latestPt.consensusUaKm2;
  const currentDisputedKm2 = latestPt.disputedKm2;

  const idx30d = Math.max(0, timeline.length - 31);
  const pt30d = timeline[idx30d];
  const netChange30dKm2 = pt30d ? round(currentRfKm2 - pt30d.consensusRfKm2, 1) : 0;

  const summary: FrontlineDynamicsSummary = {
    latestDate: latestPt.date,
    totalUkraineKm2,
    currentRfKm2,
    currentRfPct: round((currentRfKm2 / totalUkraineKm2) * 100, 2),
    currentUaKm2,
    currentUaPct: round((currentUaKm2 / totalUkraineKm2) * 100, 2),
    currentDisputedKm2,
    currentDisputedPct: round((currentDisputedKm2 / totalUkraineKm2) * 100, 2),
    peakRfKm2,
    peakRfDate,
    peakRfPct: round((peakRfKm2 / totalUkraineKm2) * 100, 2),
    liberatedFromPeakKm2: round(Math.max(0, peakRfKm2 - currentRfKm2), 1),
    netChange30dKm2,
  };

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

  const daily: FrontlineDynamicsDaily = {
    dates: timeline.map((p) => p.date),
    labels: timeline.map((p) => `${p.date.split('-')[2]}.${p.date.split('-')[1]}`),
    consensusRfKm2: timeline.map((p) => p.consensusRfKm2),
    consensusUaKm2: timeline.map((p) => p.consensusUaKm2),
    disputedKm2: timeline.map((p) => p.disputedKm2),
    dsOccupiedKm2: timeline.map((p) => p.dsOccupiedKm2),
    laClaimedKm2: timeline.map((p) => p.laClaimedKm2),
    deltaKm2: timeline.map((p) => p.deltaKm2),
  };

  return { summary, monthly, daily };
}

/** Runs the unified War RF-UA ETL Pipeline (losses, air strikes, frontline). */
export async function runWarRfUaPipeline(forceUpdate = false, verbose?: boolean): Promise<void> {
  return runWithLogger(
    'war-rf-ua',
    async () => {
      const logger = getLogger();
      logger.start('Starting War RF-UA ETL pipeline');

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

      const totalStrikes =
        rfData.summary.uavs.total + rfData.summary.ballistic.total + rfData.summary.cruise.total + uaData.summary.uavs.total + uaData.summary.ballistic.total + uaData.summary.cruise.total;

      if (!forceUpdate) {
        logger.info(
          `Remote sources unchanged (${losses.summary.totalRecords.toLocaleString()} losses, ${totalStrikes.toLocaleString()} strikes, ${frontline.timeline.length.toLocaleString()} days cached). Using cached dataset.`,
        );
      }

      await exportProjectSections('war-rf-ua', {
        'frontline-map': {
          summary: frontline.summary,
          timeline: frontline.timeline,
          layers: frontline.layers,
        },
        'frontline-dynamics': frontlineDynamics,
        'losses-map': losses.map,
        'losses-timeline': {
          periods: losses.periods,
          overallTimeline: losses.overallTimeline,
          summary: losses.summary,
        },
        'category-losses': {
          categoryChart: losses.categoryChart,
          summary: losses.summary,
        },
        'equipment-breakdown': {
          byCategory: losses.byCategory,
          periods: losses.periods,
          summary: losses.summary,
        },
        'uav-strikes': {
          rfAttacks: attacks.rfAttacks,
          uaAttacks: attacks.uaAttacks,
          unifiedTimeline: attacks.unifiedTimeline,
        },
        'missile-strikes': {
          rfAttacks: attacks.rfAttacks,
          uaAttacks: attacks.uaAttacks,
          unifiedTimeline: attacks.unifiedTimeline,
        },
      });

      if (forceUpdate) {
        logger.success(
          `Exported war-rf-ua datasets (${losses.summary.totalRecords.toLocaleString()} losses, ${totalStrikes.toLocaleString()} strikes, ${frontline.timeline.length.toLocaleString()} frontline days)`,
        );
      }
    },
    verbose,
  );
}

if (import.meta.main) {
  runWarRfUaPipeline(isUpdate(), isVerbose()).catch((err) => {
    getLogger('war-rf-ua').error('Fatal error running war-rf-ua pipeline:', err);
    process.exit(1);
  });
}
