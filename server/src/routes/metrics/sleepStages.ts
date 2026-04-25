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

// Heuristic per-epoch classifier.
//
// Inputs available per ~5-min epoch:
//   - heart_rate (bpm)
//   - hrv (ms)
//   - breathing_rate (brpm)
//   - movement (sum of total_movement in window)
//
// Approach (no ML, fully deterministic):
//   1. Build a baseline = 10th percentile of HR across the night = "deep sleep HR".
//   2. For each epoch:
//      • If movement >> typical → AWAKE (sleep interruption)
//      • Else if HR ≤ baseline + 2 AND breathing ≤ 14 → DEEP (slow & steady)
//      • Else if HR varies a lot from prev epoch OR HR ≥ baseline + 5 → REM
//        (REM has elevated HR + irregular breathing)
//      • Else → LIGHT
//
// This is a rough heuristic. Validation against polysomnography would require
// data we don't have, so think of these stages as "informed guesses" — the
// kind a sleep watch makes. Refine over time as real-world data lands.
function classifyStages(
  vitals: Array<{ timestamp: number; heart_rate: number | null; breathing_rate: number | null }>,
  movements: Array<{ timestamp: number; total_movement: number }>,
): Epoch[] {
  if (vitals.length === 0) return [];

  // Build movement lookup keyed by 5-min bucket
  const moveByBucket = new Map<number, number>();
  for (const m of movements) {
    const bucket = Math.floor(m.timestamp / 300) * 300;
    moveByBucket.set(bucket, (moveByBucket.get(bucket) || 0) + m.total_movement);
  }

  // Baseline = 10th-percentile HR
  const hrs = vitals.map((v) => v.heart_rate || 0).filter((h) => h > 0).sort((a, b) => a - b);
  const baselineHR = hrs.length ? hrs[Math.floor(hrs.length * 0.1)] : 60;

  // Movement threshold = 80th percentile of movement counts (above this = restless)
  const moves = Array.from(moveByBucket.values()).sort((a, b) => a - b);
  const moveThreshold = moves.length ? moves[Math.floor(moves.length * 0.85)] : 100;

  const epochs: Epoch[] = [];
  for (let i = 0; i < vitals.length; i++) {
    const v = vitals[i];
    const hr = v.heart_rate ?? baselineHR;
    const br = v.breathing_rate ?? 14;
    const bucket = Math.floor(v.timestamp / 300) * 300;
    const movement = moveByBucket.get(bucket) ?? 0;
    const prevHr = i > 0 ? (vitals[i - 1].heart_rate ?? baselineHR) : hr;
    const hrDelta = Math.abs(hr - prevHr);

    let stage: SleepStage;
    if (movement >= moveThreshold && movement > 50) {
      stage = 'awake';
    } else if (hr <= baselineHR + 2 && br <= 14) {
      stage = 'deep';
    } else if (hrDelta >= 4 || hr >= baselineHR + 5) {
      stage = 'rem';
    } else {
      stage = 'light';
    }

    epochs.push({
      startUnix: v.timestamp,
      endUnix: v.timestamp + 300,
      stage,
    });
  }

  return epochs;
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

    // Dedupe by timestamp — defensive against historical data inserted before
    // the (side, timestamp) unique constraint was enforced. Without this, a
    // duplicate row would inflate stage totals (one night reporting 40+ hours
    // is the symptom).
    const seenTs = new Set<number>();
    const vitals = vitalsRaw.filter((v) => {
      if (seenTs.has(v.timestamp)) return false;
      seenTs.add(v.timestamp);
      return true;
    });

    const movements = await prisma.movement.findMany({
      where: { side, timestamp: { gte: startUnix, lte: endUnix } },
      orderBy: { timestamp: 'asc' },
    });

    const rawEpochs = classifyStages(
      vitals.map((v) => ({
        timestamp: v.timestamp,
        heart_rate: v.heart_rate,
        breathing_rate: v.breathing_rate,
      })),
      movements.map((m) => ({ timestamp: m.timestamp, total_movement: m.total_movement })),
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
