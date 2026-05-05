import express, { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import moment from 'moment-timezone';
import { prisma } from '../../db/prisma.js';

const router = express.Router();

interface SleepStagesQuery {
  side?: string;
  startTime?: string;
  endTime?: string;
}

export type SleepStage = 'awake' | 'rem' | 'light' | 'deep';

type Epoch = {
  startUnix: number;       // epoch start (UTC seconds)
  endUnix: number;         // epoch end (UTC seconds)
  stage: SleepStage;
};

// Heuristic sleep-stage classifier with three improvements over the original
// per-epoch version:
//
//   1. Dense epochs covering the FULL requested period — one 5-min epoch per
//      bucket from periodStart to periodEnd. Buckets without a vitals record
//      use carry-forward (or movement-only) classification. Fixes the visible
//      "gaps in the chart" the user reported (vitals coverage was ~58%).
//
//   2. Sleep-onset / sleep-offset detection. Walks the timeline to find the
//      first sustained "calm" window (HR near baseline AND low movement) —
//      that's when you actually fell asleep, not when you got into bed.
//      Everything before onset and after offset is reclassified as 'awake'.
//      Without this, lying in bed watching TV reads as REM (elevated HR)
//      and inflates "Time slept".
//
//   3. Per-epoch fall-through is unchanged for actually-asleep buckets:
//      DEEP / REM / LIGHT decided by HR vs baseline, breathing, and HR-delta.
//
// Approach (still no ML, fully deterministic):
//   - baselineHR = 10th-percentile HR across the night = "deep sleep HR"
//   - calmMoveThreshold = 50th percentile of bucket movement = "low restless"
//   - sleep onset = first epoch where (HR ≤ baseline+5) AND (movement < calm)
//     stays true for ≥3 consecutive epochs (~15 min)
//
// Validation against polysomnography would require data we don't have, so
// think of these stages as "informed guesses" — the kind a sleep watch makes.

const BUCKET_SECONDS = 300;
const SLEEP_HR_DELTA_BPM = 5;
const ONSET_REQUIRED_CALM_BUCKETS = 3;  // 15 min of sustained calm = real sleep

function classifyStages(
  vitals: Array<{ timestamp: number; heart_rate: number | null; hrv: number | null; breathing_rate: number | null }>,
  movements: Array<{ timestamp: number; total_movement: number }>,
  periodStart: number,
  periodEnd: number,
): Epoch[] {
  // Build vitals lookup by 5-min bucket
  const vitalByBucket = new Map<number, typeof vitals[number]>();
  for (const v of vitals) {
    const bucket = Math.floor(v.timestamp / BUCKET_SECONDS) * BUCKET_SECONDS;
    if (!vitalByBucket.has(bucket)) vitalByBucket.set(bucket, v);
  }

  // Build movement lookup by 5-min bucket
  const moveByBucket = new Map<number, number>();
  for (const m of movements) {
    const bucket = Math.floor(m.timestamp / BUCKET_SECONDS) * BUCKET_SECONDS;
    moveByBucket.set(bucket, (moveByBucket.get(bucket) || 0) + m.total_movement);
  }

  // Baseline = 10th-percentile HR (the calmest few minutes of the night)
  const hrs = vitals.map((v) => v.heart_rate || 0).filter((h) => h > 0).sort((a, b) => a - b);
  const baselineHR = hrs.length ? hrs[Math.floor(hrs.length * 0.1)] : 60;

  // Movement threshold = 85th percentile = "restless / awake"
  const allMoves = Array.from(moveByBucket.values()).sort((a, b) => a - b);
  const moveThreshold = allMoves.length ? allMoves[Math.floor(allMoves.length * 0.85)] : 100;
  // For sleep-onset detection, "calm" just needs to be below the awake bar.
  // Earlier I used p50 here but that's by-definition strict — half of even
  // a perfectly slept night exceeds it, breaking onset detection. Mirror
  // the awake threshold so onset works whenever HR is low and movement
  // isn't at the awake-restless level.
  const calmMoveThreshold = moveThreshold;

  // HRV quartiles — used to distinguish REM (high HRV: autonomic activity,
  // dream-related cardiac variability) from deep sleep (low HRV: regulated
  // parasympathetic, steady cardiac rhythm). The literature is consistent on
  // this — high-frequency HRV power is the canonical REM marker.
  // We tolerate sparse / missing HRV gracefully: if the per-night spread is
  // too narrow (the upstream HRV calc occasionally collapses to a single
  // value when the present_for gate is failing), hrvSpreadOk goes false and
  // the REM branch becomes unreachable for the night — better to show 0%
  // REM than to hallucinate REM from HR alone.
  const hrvVals = vitals.map((v) => v.hrv ?? 0).filter((h) => h > 0).sort((a, b) => a - b);
  const hrvP25 = hrvVals.length ? hrvVals[Math.floor(hrvVals.length * 0.25)] : 0;
  const hrvP75 = hrvVals.length ? hrvVals[Math.floor(hrvVals.length * 0.75)] : 0;
  const hrvSpreadOk = hrvP75 - hrvP25 >= 5; // need at least 5 ms between Q1 and Q3 to be useful

  // REM requires BOTH elevated HRV (autonomic activity) AND modestly
  // elevated HR vs the night's deep-sleep baseline. The previous version
  // produced biologically impossible 40-70% REM nights because three
  // separate OR branches all funneled to REM (hrvHigh on its own, HR ≥
  // baseline+5 on its own, or HR-delta ≥ 4 on its own). Since hrvHigh is
  // by definition the top-25% of HRV values, ≥25% of every night was
  // automatically REM before any other criteria mattered. Now LIGHT is the
  // default for "not deep, not REM" — matching clinical sleep architecture
  // where Light is 50-60% of normal sleep, REM is 20-25%, Deep is 13-23%.
  const REM_HR_DELTA_BPM = 4;

  // Walk every 5-min bucket in the requested period (this is what fixes the
  // chart gaps — we emit an epoch even when vitals are missing).
  const startBucket = Math.floor(periodStart / BUCKET_SECONDS) * BUCKET_SECONDS;
  const endBucket = Math.ceil(periodEnd / BUCKET_SECONDS) * BUCKET_SECONDS;

  type WorkingEpoch = {
    bucket: number;
    movement: number;
    hr: number | null;
    br: number | null;
    hrv: number | null;
    isCalm: boolean;
    stage: SleepStage;
  };
  const working: WorkingEpoch[] = [];
  let lastClassifiedSleepStage: SleepStage = 'light';

  for (let b = startBucket; b < endBucket; b += BUCKET_SECONDS) {
    const v = vitalByBucket.get(b);
    const movement = moveByBucket.get(b) ?? 0;
    const hr = v?.heart_rate ?? null;
    const br = v?.breathing_rate ?? null;
    const hrv = v?.hrv ?? null;

    const hrCalm = hr !== null && hr <= baselineHR + SLEEP_HR_DELTA_BPM;
    const moveCalm = movement < calmMoveThreshold;
    const isCalm = hrCalm && moveCalm;

    // HRV-driven signal (only meaningful when the per-night HRV spread is
    // reasonable — see hrvSpreadOk above). hrvLow is intentionally unused
    // for now: requiring it for DEEP eats too many epochs (produced 2-4%
    // deep on real nights). "Not high HRV" captures the deep-sleep
    // signature well enough.
    const hrvHigh = hrvSpreadOk && hrv !== null && hrv >= hrvP75;

    let stage: SleepStage;
    if (movement >= moveThreshold && movement > 50) {
      stage = 'awake';
    } else if (hr === null) {
      // No vitals this bucket — carry forward the previous sleep stage if
      // movement is low; otherwise treat as light. Avoids leaving holes in
      // the chart while not fabricating "deep sleep" through restless gaps.
      stage = moveCalm ? lastClassifiedSleepStage : 'light';
    } else if (hr <= baselineHR + 2 && !hrvHigh) {
      // DEEP: low HR (near baseline) and HRV is NOT in the upper quartile.
      // When HRV is unusable (hrvSpreadOk false), hrvHigh is forced false
      // so this still fires on HR alone.
      stage = 'deep';
    } else if (hrvHigh && hr >= baselineHR + REM_HR_DELTA_BPM) {
      // REM: BOTH elevated HRV (autonomic / dream activity) AND modestly
      // elevated HR (4+ bpm above baseline). Requiring both signals is the
      // key change vs the old classifier — alone, hrvHigh covers ~25% of
      // every night by definition (it's the top quartile), and HR-only or
      // HR-delta gates lit up another huge chunk. The intersection is
      // consistent with clinical REM signatures and naturally falls in
      // the 15-25% range.
      stage = 'rem';
    } else {
      // LIGHT is the default for "not deep, not REM, not awake" — which
      // matches normal sleep architecture (Light = 50-60% of total sleep).
      stage = 'light';
    }

    if (stage !== 'awake') lastClassifiedSleepStage = stage;

    working.push({ bucket: b, movement, hr, br, hrv, isCalm, stage });
  }

  // Sleep-onset detection: first run of ≥ONSET_REQUIRED_CALM_BUCKETS consecutive
  // calm epochs. Until that point, the user was in bed but awake — relabel to
  // 'awake' so it doesn't count as "Time slept" and the chart shows the
  // pre-sleep period correctly.
  let onsetIdx = -1;
  let calmRun = 0;
  for (let i = 0; i < working.length; i++) {
    if (working[i].isCalm) {
      calmRun++;
      if (calmRun >= ONSET_REQUIRED_CALM_BUCKETS) {
        onsetIdx = i - ONSET_REQUIRED_CALM_BUCKETS + 1;
        break;
      }
    } else {
      calmRun = 0;
    }
  }

  // Sleep-offset detection. The "calm streak walking backward" rule used to
  // be the same as for onset, but it produced wake times that overshot real
  // wake by ~1 hour: phone-in-bed periods after waking have HR/movement
  // patterns very similar to light/REM sleep (low movement, HR a few bpm
  // above baseline) and the classifier had to call them light/REM. The
  // calm-streak rule then happily latched onto those short post-wake
  // sleep-ish bursts and reported wake = end of the latest one.
  //
  // Switch to a *sustained main sleep block* rule for offset: walk backward
  // to find the last run of ≥OFFSET_REQUIRED_SLEEP_BUCKETS consecutive
  // non-awake epochs (= 50 min of continuous classified sleep). The end
  // of that block is the real wake time. Brief 4-5-epoch bursts during
  // phone-in-bed are filtered out because they don't sustain long enough.
  const OFFSET_REQUIRED_SLEEP_BUCKETS = 10;  // 50 min of continuous sleep
  let offsetIdx = working.length;
  let sleepRun = 0;
  for (let i = working.length - 1; i >= 0; i--) {
    if (working[i].stage !== 'awake') {
      sleepRun++;
      if (sleepRun >= OFFSET_REQUIRED_SLEEP_BUCKETS) {
        // First epoch AFTER the sustained sleep block, walking forward.
        offsetIdx = i + OFFSET_REQUIRED_SLEEP_BUCKETS;
        break;
      }
    } else {
      sleepRun = 0;
    }
  }

  // If we never found a calm run, leave classifications as-is — the user
  // probably never properly slept (or vitals are too sparse to tell), and
  // the per-epoch heuristic is the best we have.
  if (onsetIdx >= 0) {
    for (let i = 0; i < onsetIdx; i++) working[i].stage = 'awake';
    for (let i = offsetIdx; i < working.length; i++) working[i].stage = 'awake';
  }

  return working.map((w) => ({
    startUnix: w.bucket,
    endUnix: w.bucket + BUCKET_SECONDS,
    stage: w.stage,
  }));
}

router.get(
  '/sleep-stages',
  async (req: Request<object, object, object, SleepStagesQuery>, res: Response) => {
    const { side, startTime, endTime } = req.query;
    if (!side || !startTime || !endTime) {
      return res.status(400).json({ error: 'side, startTime, endTime required' });
    }

    const startUnix = moment(startTime).unix();
    const endUnix = moment(endTime).unix();

    const vitalsQuery: Prisma.vitalsWhereInput = {
      side,
      timestamp: { gte: startUnix, lte: endUnix },
    };
    const vitalsRaw = await prisma.vitals.findMany({
      where: vitalsQuery,
      orderBy: { timestamp: 'asc' },
    });

    const movements = await prisma.movement.findMany({
      where: { side, timestamp: { gte: startUnix, lte: endUnix } },
      orderBy: { timestamp: 'asc' },
    });

    // Bucket-snap + dedupe is now inside classifyStages.
    const rawEpochs = classifyStages(
      vitalsRaw.map((v) => ({
        timestamp: v.timestamp,
        heart_rate: v.heart_rate,
        hrv: v.hrv,
        breathing_rate: v.breathing_rate,
      })),
      movements.map((m) => ({ timestamp: m.timestamp, total_movement: m.total_movement })),
      startUnix,
      endUnix,
    );

    // Clamp each epoch to the requested period AND drop epochs that fall
    // entirely outside it. Belt-and-suspenders — the SQL query already filters
    // by timestamp range, but the classifier extends each epoch by 300s so the
    // last one could overrun endUnix.
    const epochs = rawEpochs
      .map((e) => ({
        ...e,
        startUnix: Math.max(e.startUnix, startUnix),
        endUnix: Math.min(e.endUnix, endUnix),
      }))
      .filter((e) => e.endUnix > e.startUnix);

    // Roll up totals per stage
    const totals: Record<SleepStage, number> = { awake: 0, rem: 0, light: 0, deep: 0 };
    for (const e of epochs) totals[e.stage] += e.endUnix - e.startUnix;
    const totalSeconds = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    const percentages: Record<SleepStage, number> = {
      awake: Math.round((totals.awake / totalSeconds) * 100),
      rem:   Math.round((totals.rem   / totalSeconds) * 100),
      light: Math.round((totals.light / totalSeconds) * 100),
      deep:  Math.round((totals.deep  / totalSeconds) * 100),
    };

    return res.json({ epochs, totals, percentages, totalSeconds });
  },
);

export default router;
