// Per-side presence-based auto-off.
//
// If a side has been ON without any reported presence for PRESENCE_AUTO_OFF_MS,
// we turn it off automatically. Acts independently per side. Skipped while a
// side is in awayMode. The grace period from "user just turned the side on"
// counts toward the timeout — if the user turns the side on but never lays
// down, we still shut it off after the timeout elapses.
import moment from 'moment-timezone';
import logger from '../logger.js';
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
    const presence = getPresenceData();
    const now = Date.now();
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