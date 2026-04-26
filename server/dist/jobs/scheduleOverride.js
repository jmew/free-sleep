// Logic for "if user manually changes temp shortly before the next scheduled
// change, suppress the rest of the schedule."
//
// Wiring: call markManualTempChange() from each manual-change path
// (POST /api/deviceStatus, tap gestures). DO NOT call it from the scheduler
// jobs themselves — those are the ones we want to be suppressed.
import moment from 'moment-timezone';
import settingsDB from '../db/settings.js';
import schedulesDB from '../db/schedules.js';
import logger from '../logger.js';
export const OVERRIDE_WINDOW_HOURS = 3;
export const OVERRIDE_DURATION_HOURS = 12;
const DAYS = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];
// Walk today + tomorrow's schedules and return the next scheduled
// temperature-change moment, or null if none within 48h.
function findNextScheduledTempChange(side, now, timeZone) {
    const sideSchedule = schedulesDB.data[side];
    if (!sideSchedule)
        return null;
    for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
        const candidateDay = now.clone().tz(timeZone).add(dayOffset, 'day');
        const dayName = DAYS[candidateDay.day()];
        const daily = sideSchedule[dayName];
        if (!daily?.temperatures)
            continue;
        const sortedTimes = Object.keys(daily.temperatures).sort();
        for (const time of sortedTimes) {
            const [h, m] = time.split(':').map(Number);
            const candidate = candidateDay
                .clone()
                .hour(h)
                .minute(m)
                .second(0)
                .millisecond(0);
            if (candidate.isAfter(now)) {
                return candidate;
            }
        }
    }
    return null;
}
export const isTempScheduleOverridden = (side) => {
    const override = settingsDB.data[side]?.scheduleOverrides?.temperatureSchedules;
    if (!override?.disabled)
        return false;
    if (!override.expiresAt)
        return false;
    return moment(override.expiresAt).isAfter(moment());
};
export const markManualTempChange = async (side) => {
    await settingsDB.read();
    await schedulesDB.read();
    const timeZone = settingsDB.data.timeZone || 'UTC';
    const now = moment.tz(timeZone);
    const next = findNextScheduledTempChange(side, now, timeZone);
    if (!next) {
        logger.debug(`[manual temp] ${side}: no upcoming scheduled change found`);
        return;
    }
    const hoursUntil = next.diff(now, 'minutes') / 60;
    if (hoursUntil > OVERRIDE_WINDOW_HOURS) {
        logger.debug(`[manual temp] ${side}: next schedule at ${next.format()} is ${hoursUntil.toFixed(1)}h away (>${OVERRIDE_WINDOW_HOURS}h) — no override.`);
        return;
    }
    const expiresAt = now.clone().add(OVERRIDE_DURATION_HOURS, 'hours').format();
    settingsDB.data[side].scheduleOverrides.temperatureSchedules = {
        disabled: true,
        expiresAt,
    };
    await settingsDB.write();
    logger.info(`[manual temp] ${side}: schedule paused until ${expiresAt} (next change was at ${next.format()}, ${hoursUntil.toFixed(1)}h away).`);
};
//# sourceMappingURL=scheduleOverride.js.map