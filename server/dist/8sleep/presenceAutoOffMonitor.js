// Per-side presence-based auto-off.
//
// If a side has been ON without any reported presence for PRESENCE_AUTO_OFF_MS,
// we turn it off automatically. Acts independently per side. Skipped while a
// side is in awayMode. The grace period from "user just turned the side on"
// counts toward the timeout — if the user turns the side on but never lays
// down, we still shut it off after the timeout elapses.
//
// IMPORTANT: skipped while we're inside the user's explicit power schedule's
// on-window. Without this guard, a noisy partner can starve the dominance
// arbiter on the lighter sleeper's side (decision_L=False because
// R-signal >> L-signal), causing the algorithm to treat the user as
// not-present for >45 min mid-sleep and silently shut the bed off at 3 AM
// even though they're peacefully asleep. The schedule is the user's
// declarative intent ("keep this side on until 09:50"); the presence heuristic
// is only a safety net for naps and forgot-to-turn-off cases outside that
// window.
import moment from 'moment-timezone';
import logger from '../logger.js';
import schedulesDB from '../db/schedules.js';
import settingsDB from '../db/settings.js';
import { getPresenceData } from '../routes/metrics/presence.js';
import { getDeviceStatusCoalesced } from './frankenServer.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
export const PRESENCE_AUTO_OFF_MS = 45 * 60 * 1000;
const CHECK_INTERVAL_MS = 60 * 1000;
// Per-side tracking. We need the on-transition timestamp because the
// presence stream may not have emitted any "present" event for a side that
// was never occupied — without this we'd auto-off immediately on a fresh
// power-on. We also avoid firing repeatedly for the same idle session.
const lastSeenOnAt = { left: null, right: null };
const prevIsOn = { left: null, right: null };
let timer = null;
/**
 * Returns true if `now` falls inside an enabled power schedule's on-window
 * for the given side. Handles overnight schedules (off-time before noon ⇒
 * crosses midnight). The off threshold uses isEndTimeNextDay: hour <= 12
 * means the off fires the next day, matching the rest of the codebase's
 * convention (see [`utils.ts:isEndTimeNextDay`](../jobs/utils.ts)).
 */
function isInActivePowerSchedule(side, now, schedules) {
    const todayName = now.format('dddd').toLowerCase();
    const yesterdayName = now.clone().subtract(1, 'day').format('dddd').toLowerCase();
    const today = schedules[side]?.[todayName];
    const yesterday = schedules[side]?.[yesterdayName];
    const parseAt = (anchor, hhmm) => {
        const [h, m] = hhmm.split(':').map(Number);
        return anchor.clone().startOf('day').hour(h).minute(m).second(0).millisecond(0);
    };
    const isOvernight = (off) => Number(off.split(':')[0]) <= 12;
    // Yesterday's overnight schedule (e.g., on=21:50 → off=09:50 next day).
    // Active if now is between yesterday-on and today-off-time.
    if (yesterday?.power.enabled && isOvernight(yesterday.power.off)) {
        const yOn = parseAt(now.clone().subtract(1, 'day'), yesterday.power.on);
        const tOff = parseAt(now, yesterday.power.off);
        if (now.isSameOrAfter(yOn) && now.isBefore(tOff))
            return true;
    }
    // Today's schedule. Two cases:
    //   - Same-day (off later than on, e.g. on=14:00 → off=18:00): window is
    //     [today-on, today-off].
    //   - Overnight (off before noon, e.g. on=21:50 → off=09:50): window from
    //     today-on through end-of-today; the wrap into tomorrow morning is
    //     handled when "tomorrow" rolls over and yesterday-overnight kicks in.
    if (today?.power.enabled) {
        const tOn = parseAt(now, today.power.on);
        if (isOvernight(today.power.off)) {
            if (now.isSameOrAfter(tOn))
                return true;
        }
        else {
            const tOff = parseAt(now, today.power.off);
            if (now.isSameOrAfter(tOn) && now.isBefore(tOff))
                return true;
        }
    }
    return false;
}
async function tick() {
    let status;
    try {
        status = await getDeviceStatusCoalesced();
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`presenceAutoOff: skip tick (status fetch failed): ${msg}`);
        return;
    }
    await settingsDB.read();
    await schedulesDB.read();
    const presence = getPresenceData();
    const now = Date.now();
    const tz = settingsDB.data.timeZone || 'UTC';
    const nowMoment = moment.tz(now, tz);
    for (const side of ['left', 'right']) {
        const isOn = !!status?.[side]?.isOn;
        if (isOn && !prevIsOn[side]) {
            lastSeenOnAt[side] = now;
        }
        if (!isOn) {
            lastSeenOnAt[side] = null;
        }
        prevIsOn[side] = isOn;
        if (!isOn)
            continue;
        if (settingsDB.data[side].awayMode)
            continue;
        // Respect the user's explicit power schedule. If we're inside their
        // declared on-window (e.g., 21:50 → 09:50 overnight), don't auto-off —
        // the schedule's own power-off job will handle shutdown at the right time.
        if (isInActivePowerSchedule(side, nowMoment, schedulesDB.data))
            continue;
        // If the live stream currently reports present, the user is on the bed
        // right now — don't even consider auto-off. The stream's hysteresis
        // (3-min stillness grace + 3-consecutive-elevated entry) already filters
        // jitter, so trusting it here is much more reliable than computing from
        // lastPresenceAt while the Python only POSTs on transitions.
        if (presence[side].present)
            continue;
        const lastPresenceAt = presence[side].lastPresenceAt
            ? moment(presence[side].lastPresenceAt).valueOf()
            : null;
        // Reference = the most recent of (we noticed the side turned on) and
        // (last reported presence). Whichever happened most recently is the
        // start of the current "no-presence" window.
        const refs = [];
        if (lastSeenOnAt[side] !== null)
            refs.push(lastSeenOnAt[side]);
        if (lastPresenceAt !== null)
            refs.push(lastPresenceAt);
        if (refs.length === 0)
            continue;
        const ref = Math.max(...refs);
        if (now - ref > PRESENCE_AUTO_OFF_MS) {
            const idleMin = Math.round((now - ref) / 60_000);
            logger.info(`presenceAutoOff: turning off ${side} — no presence for ${idleMin} min`);
            try {
                await updateDeviceStatus({ [side]: { isOn: false } });
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                logger.error(`presenceAutoOff: failed to turn off ${side}: ${msg}`);
            }
        }
    }
}
export function startPresenceAutoOff() {
    if (timer)
        return;
    logger.info(`presenceAutoOff: starting (timeout ${PRESENCE_AUTO_OFF_MS / 60_000}min, check every ${CHECK_INTERVAL_MS / 1_000}s)`);
    timer = setInterval(() => { void tick(); }, CHECK_INTERVAL_MS);
}
export function stopPresenceAutoOff() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}
//# sourceMappingURL=presenceAutoOffMonitor.js.map