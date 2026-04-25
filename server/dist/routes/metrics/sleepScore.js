import express from 'express';
import moment from 'moment-timezone';
import { prisma } from '../../db/prisma.js';
const router = express.Router();
// --- Component scorers (each returns 0-100) ---
function scoreDuration(seconds) {
    const hours = seconds / 3600;
    // 8h = 100, falls ~10pts per hour away, floor at 0
    const delta = Math.abs(hours - 8);
    return Math.max(0, Math.round(100 - delta * 10));
}
function scoreContinuity(timesExited) {
    // 0 exits = 100, -15 per exit, floor at 0
    return Math.max(0, 100 - timesExited * 15);
}
function scoreHrv(avgHrv) {
    // Bands tuned for sleep HRV (RMSSD-ish, ms)
    if (avgHrv >= 70)
        return 95;
    if (avgHrv >= 50)
        return 85;
    if (avgHrv >= 30)
        return 70;
    return 50;
}
function scoreRestingHr(minHr) {
    // Lower min HR during sleep = deeper rest
    if (minHr === 0)
        return 0;
    if (minHr < 55)
        return 95;
    if (minHr < 65)
        return 85;
    if (minHr < 75)
        return 70;
    if (minHr < 85)
        return 55;
    return 40;
}
function formatHours(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}
router.get('/sleep-score', async (req, res) => {
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
    const vitalsQuery = {
        side,
        timestamp: { gte: startUnix, lte: endUnix },
    };
    const hrAgg = await prisma.vitals.aggregate({
        where: vitalsQuery,
        _min: { heart_rate: true },
    });
    const hrvAgg = await prisma.vitals.aggregate({
        where: { ...vitalsQuery, hrv: { not: 0, lte: 120, gte: 30 } },
        _avg: { hrv: true },
    });
    const durationSec = sleepRecord?.sleep_period_seconds ?? endUnix - startUnix;
    const exits = sleepRecord?.times_exited_bed ?? 0;
    const minHr = hrAgg._min.heart_rate ?? 0;
    const avgHrv = hrvAgg._avg.hrv ?? 0;
    const components = {
        duration: {
            score: scoreDuration(durationSec),
            weight: 0.4,
            value: formatHours(durationSec),
            available: true,
        },
        continuity: {
            score: scoreContinuity(exits),
            weight: 0.3,
            value: `${exits} ${exits === 1 ? 'exit' : 'exits'}`,
            available: true,
        },
        hrv: {
            score: scoreHrv(avgHrv),
            weight: 0.15,
            value: avgHrv > 0 ? `${Math.round(avgHrv)} ms` : '—',
            available: avgHrv > 0,
        },
        restingHr: {
            score: scoreRestingHr(minHr),
            weight: 0.15,
            value: minHr > 0 ? `${Math.round(minHr)} bpm` : '—',
            available: minHr > 0,
        },
    };
    // Reweight: distribute missing components' weight proportionally across present ones.
    const totalAvailableWeight = Object.values(components)
        .filter((c) => c.available)
        .reduce((acc, c) => acc + c.weight, 0);
    let weightedSum = 0;
    for (const c of Object.values(components)) {
        if (!c.available)
            continue;
        const adjustedWeight = c.weight / totalAvailableWeight;
        weightedSum += c.score * adjustedWeight;
    }
    const score = Math.round(weightedSum);
    return res.json({ score, components });
});
export default router;
//# sourceMappingURL=sleepScore.js.map