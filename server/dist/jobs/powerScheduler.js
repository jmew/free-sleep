import schedule from 'node-schedule';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { getDayIndexForSchedule, getDayOfWeekIndex, logJob } from './utils.js';
import { executeAnalyzeSleep } from './analyzeSleep.js';
import moment from 'moment-timezone';
import serverStatus from '../serverStatus.js';
import logger from '../logger.js';
import servicesDB from '../db/services.js';
import memoryDB from '../db/memoryDB.js';
export const schedulePowerOn = (settingsData, side, day, power) => {
    if (!power.enabled)
        return;
    if (settingsData[side].awayMode)
        return;
    if (settingsData.timeZone === null)
        return;
    const onRule = new schedule.RecurrenceRule();
    const dayOfWeekIndex = getDayOfWeekIndex(day);
    onRule.dayOfWeek = dayOfWeekIndex;
    const [onHour, onMinute] = power.on.split(':').map(Number);
    const time = power.on;
    onRule.hour = onHour;
    onRule.minute = onMinute;
    onRule.tz = settingsData.timeZone;
    logJob('Scheduling power on job', side, day, dayOfWeekIndex, time);
    schedule.scheduleJob(`${side}-${day}-${time}-power-on`, onRule, async () => {
        try {
            logJob('Executing power on job', side, day, dayOfWeekIndex, time);
            await updateDeviceStatus({
                [side]: {
                    isOn: true,
                    targetTemperatureF: power.onTemperature
                }
            });
            serverStatus.status.powerSchedule.status = 'healthy';
            serverStatus.status.powerSchedule.message = '';
        }
        catch (error) {
            serverStatus.status.powerSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.status.powerSchedule.message = message;
            logger.error(error);
        }
    });
};
// Sleep analysis runs daily per side, decoupled from the power schedule.
// Previously it was scheduled inside schedulePowerOffAndSleepAnalysis and
// only fired if `power.enabled` was true — which meant a partner who used
// the bed but had no temperature schedule (e.g. wife on the right side
// without an active heating schedule) never had sleep records generated
// for them, even though the biometrics stream was collecting their data.
//
// Now sleep analysis is independent: one daily job per side, gated only
// by the system-wide `biometrics.enabled` toggle. The 12:00 default is
// late enough to comfortably cover users who sleep until 11-11:30 AM,
// AND we now have a RAW-file archive (scripts/archive-raw.sh +
// /etc/systemd/system/free-sleep-archive-raw.timer) that hardlinks
// piezo files before frankenfirmware's ~75-min rolling-buffer truncation,
// so the analyze always sees the previous 12 h regardless of when it
// runs. Tweak these constants if both sleepers routinely wake later.
const SLEEP_ANALYSIS_HOUR = 12;
const SLEEP_ANALYSIS_MINUTE = 0;
export const scheduleSleepAnalysis = (settingsData, side) => {
    if (settingsData[side].awayMode)
        return;
    if (settingsData.timeZone === null)
        return;
    const dailyRule = new schedule.RecurrenceRule();
    dailyRule.hour = SLEEP_ANALYSIS_HOUR;
    dailyRule.minute = SLEEP_ANALYSIS_MINUTE;
    dailyRule.tz = settingsData.timeZone;
    const time = `${String(SLEEP_ANALYSIS_HOUR).padStart(2, '0')}:${String(SLEEP_ANALYSIS_MINUTE).padStart(2, '0')}`;
    logger.debug(`Scheduling daily sleep-analyzer job for ${side} at ${time}`);
    schedule.scheduleJob(`daily-analyze-sleep-${side}`, dailyRule, async () => {
        await servicesDB.read();
        if (!servicesDB.data.biometrics.enabled) {
            logger.debug('Not executing sleep analyzer job, biometrics is disabled');
            return;
        }
        await memoryDB.read();
        const now = performance.now();
        if (memoryDB.data[side].analyzeSleep.lastRan) {
            const diffMs = now - memoryDB.data[side].analyzeSleep.lastRan;
            const tenMinutesMs = 10 * 60 * 1000;
            if (diffMs <= tenMinutesMs) {
                logger.debug(`Duplicate sleep-analyzer job for ${side}, skipping`);
                return;
            }
        }
        memoryDB.data[side].analyzeSleep.lastRan = now;
        await memoryDB.write();
        logger.info(`Executing daily sleep analyzer job for ${side}`);
        executeAnalyzeSleep(side, moment().subtract(12, 'hours').toISOString(), moment().add(1, 'hours').toISOString());
    });
};
export const schedulePowerOff = (settingsData, side, day, power) => {
    if (!power.enabled)
        return;
    if (settingsData[side].awayMode)
        return;
    if (settingsData.timeZone === null)
        return;
    const offRule = new schedule.RecurrenceRule();
    const dayOfWeekIndex = getDayIndexForSchedule(day, power.off);
    offRule.dayOfWeek = dayOfWeekIndex;
    const time = power.off;
    const [offHour, offMinute] = time.split(':').map(Number);
    offRule.hour = offHour;
    offRule.minute = offMinute;
    offRule.tz = settingsData.timeZone;
    logJob('Scheduling power off job', side, day, dayOfWeekIndex, time);
    schedule.scheduleJob(`${side}-${day}-${time}-power-off`, offRule, async () => {
        try {
            logJob('Executing power off job', side, day, dayOfWeekIndex, time);
            await updateDeviceStatus({
                [side]: {
                    isOn: false,
                }
            });
            serverStatus.status.powerSchedule.status = 'healthy';
            serverStatus.status.powerSchedule.message = '';
        }
        catch (error) {
            serverStatus.status.powerSchedule.status = 'failed';
            const message = error instanceof Error ? error.message : String(error);
            serverStatus.status.powerSchedule.message = message;
            logger.error(error);
        }
    });
};
//# sourceMappingURL=powerScheduler.js.map