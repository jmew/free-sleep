import express, { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import moment from 'moment-timezone';
import { prisma } from '../../db/prisma.js';

import { classifyStages, median } from './sleepStages.js';

const router = express.Router();

interface SleepScoreQuery {
  side?: string;
  startTime?: string;
  endTime?: string;
}

type Component = {
  score: number;     // 0-100
  weight: number;    // sum of present component weights = 1
  value: string;     // human-readable original value
  available: boolean;
};

// --- Component scorers (each returns 0-100) ---

function scoreDuration(seconds: number): number {
  const hours = seconds / 3600;
  // 8h = 100, falls ~10pts per hour away, floor at 0
  const delta = Math.abs(hours - 8);
  return Math.max(0, Math.round(100 - delta * 10));
}

function scoreContinuity(timesExited: number): number {
  // 0 exits = 100, -15 per exit, floor at 0
  return Math.max(0, 100 - timesExited * 15);
}

function sustainedRestingHr(rows: {timestamp:number; heart_rate:number|null}[]) {
  const bins = new Map<number, number[]>();
  for (const row of rows) {
    if (!row.heart_rate) continue;
    const key = Math.floor(row.timestamp / 300);
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key)!.push(row.heart_rate);
  }
  const sustained = Array.from(bins.values()).filter(b => b.length >= 3).map(b => median(b)!);
  return sustained.length ? Math.min(...sustained) : 0;
}

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

router.get(
  '/sleep-score',
  async (req: Request<object, object, object, SleepScoreQuery>, res: Response) => {
    const { side, startTime, endTime } = req.query;
    if (!side || !startTime || !endTime) {
      return res.status(400).json({
        error: 'side, startTime, and endTime query params are required',
      });
    }

    const startUnix = moment(startTime).unix();
    const endUnix = moment(endTime).unix();

    // Sleep record covering this window (used for duration + bed exits)
    const sleepRecord = await prisma.sleep_records.findFirst({
      where: {
        side,
        entered_bed_at: { lte: startUnix + 60 },
        left_bed_at: { gte: endUnix - 60 },
      },
      orderBy: { entered_bed_at: 'asc' },
    });

    // Vitals during the window
    const vitalsQuery: Prisma.vitalsWhereInput = {
      side,
      timestamp: { gte: startUnix, lte: endUnix },
    };
    const [vitals, movements, history] = await Promise.all([
      prisma.vitals.findMany({ where: vitalsQuery }),
      prisma.movement.findMany({ where: {side, timestamp: {gte: startUnix, lt: endUnix}} }),
      prisma.vitals.findMany({where: {side, timestamp: {gte: startUnix - 28*86400, lt: startUnix}},
        select: {timestamp:true, hrv:true, heart_rate:true}}),
    ]);
    const epochs = classifyStages(vitals,movements,startUnix,endUnix);
    let durationSec = 0;
    let measured = 0;
    for (const e of epochs) {
      const seconds = Math.min(endUnix,e.endUnix) - Math.max(startUnix,e.startUnix);
      if (e.stage === 'unknown') continue;
      measured += seconds;
      if (e.stage !== 'awake') durationSec += seconds;
    }
    const coverage = measured / Math.max(1, endUnix-startUnix);
    const exits = sleepRecord?.times_exited_bed ?? 0;
    const avgHrv = median(vitals.map(v => v.hrv));
    const days = new Map<number, number[]>();
    for (const v of history) {
      if (!v.hrv) continue;
      const day = Math.floor(v.timestamp / 86400);
      if (!days.has(day)) days.set(day, []);
      days.get(day)!.push(v.hrv);
    }
    const typical = days.size >= 7 ? median(Array.from(days.values(),median)) : null;
    const minHr = sustainedRestingHr(vitals);
    const hrDays = new Map<number, typeof history>();
    for (const row of history) {
      const day = Math.floor(row.timestamp / 86400);
      if (!hrDays.has(day)) hrDays.set(day, []);
      hrDays.get(day)!.push(row);
    }
    const dailyRest = Array.from(hrDays.values(), sustainedRestingHr).filter(v => v > 0);
    const typicalHr = dailyRest.length >= 7 ? median(dailyRest) : null;
    const components: Record<string, Component> = {
      duration: {
        score: scoreDuration(durationSec),
        weight: 0.4,
        value: formatHours(durationSec),
        available: !!sleepRecord && coverage >= 0.8,
      },
      continuity: {
        score: scoreContinuity(exits),
        weight: 0.3,
        value: `${exits} ${exits === 1 ? 'exit' : 'exits'}`,
        available: !!sleepRecord,
      },
      hrv: {
        score: typical && avgHrv ? Math.round(100 * Math.min(1, avgHrv / typical)) : 0,
        weight: 0.15,
        value: avgHrv ? `${Math.round(avgHrv)} ms` : '—',
        available: !!avgHrv && !!typical,
      },
      restingHr: {
        score: typicalHr && minHr ? Math.round(100 * Math.min(1, typicalHr / minHr)) : 0,
        weight: 0.15,
        value: minHr > 0 ? `${Math.round(minHr)} bpm` : '—',
        available: !!typicalHr && minHr > 0,
      },
    };

    // Reweight: distribute missing components' weight proportionally across present ones.
    const totalAvailableWeight = Object.values(components)
      .filter((c) => c.available)
      .reduce((acc, c) => acc + c.weight, 0);

    let weightedSum = 0;
    for (const c of Object.values(components)) {
      if (!c.available) continue;
      const adjustedWeight = c.weight / totalAvailableWeight;
      weightedSum += c.score * adjustedWeight;
    }

    const score = sleepRecord && coverage >= 0.8 ? Math.round(weightedSum) : null;

    return res.json({ score, coverage, components });
  },
);

export default router;
