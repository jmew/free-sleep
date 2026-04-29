import path from 'path';
import chokidar from 'chokidar';
import moment from 'moment-timezone';
import schedule from 'node-schedule';

import config from '../config.js';
import logger from '../logger.js';
import schedulesDB from '../db/schedules.js';
import serverStatus from '../serverStatus.js';
import settingsDB from '../db/settings.js';
import { DayOfWeek, Side } from '../db/schedulesSchema.js';
import { isSystemDateValid } from './isSystemDateValid.js';
import { scheduleAlarm, scheduleAlarmOverride, scheduleOneOffAlarm } from './alarmScheduler.js';
import { schedulePowerOff, schedulePowerOn, scheduleSleepAnalysis } from './powerScheduler.js';
import { schedulePrimingRebootAndCalibration } from './primeScheduler.js';
import { scheduleTemperatures } from './temperatureScheduler.js';
import eventBus from '../events/eventBus.js';
import { emitJobEvent } from './jobEvents.js';


async function setupJobs() {
  try {
    if (serverStatus.status.jobs.status === 'started') {
      logger.debug('Job setup already running, skipping duplicate execution.');
      return;
    }
    serverStatus.status.jobs.status = 'started';


    // Clear existing jobs
    logger.info('Canceling old jobs...');
    Object.keys(schedule.scheduledJobs).forEach((jobName) => {
      schedule.cancelJob(jobName);
    });
    await schedule.gracefulShutdown();

    await settingsDB.read();
    await schedulesDB.read();

    moment.tz.setDefault(settingsDB.data.timeZone || 'UTC');

    const schedulesData = schedulesDB.data;
    const settingsData = settingsDB.data;

    logger.info('Scheduling jobs...');
    scheduleAlarmOverride(settingsData, 'left');
    scheduleAlarmOverride(settingsData, 'right');
    scheduleOneOffAlarm(settingsData, 'left');
    scheduleOneOffAlarm(settingsData, 'right');
    // Sleep analysis runs daily per side, decoupled from power schedule —
    // a side that's being measured (biometrics on, person actually using
    // it) gets sleep records even when no temperature schedule is enabled
    // for that side. Was previously gated on power.enabled inside the
    // per-day loop, which silently skipped partners without heating
    // schedules.
    scheduleSleepAnalysis(settingsData, 'left');
    scheduleSleepAnalysis(settingsData, 'right');
    Object.entries(schedulesData).forEach(([side, sideSchedule]) => {
      Object.entries(sideSchedule).forEach(([day, schedule]) => {
        schedulePowerOn(settingsData, side as Side, day as DayOfWeek, schedule.power);
        schedulePowerOff(settingsData, side as Side, day as DayOfWeek, schedule.power);
        scheduleTemperatures(settingsData, side as Side, day as DayOfWeek, schedule.temperatures);
        scheduleAlarm(settingsData, side as Side, day as DayOfWeek, schedule);
      });
    });
    schedulePrimingRebootAndCalibration(settingsData);

    logger.info('Done scheduling jobs!');
    serverStatus.status.alarmSchedule.status = 'healthy';
    serverStatus.status.jobs.status = 'healthy';
    serverStatus.status.primeSchedule.status = 'healthy';
    serverStatus.status.powerSchedule.status = 'healthy';
    serverStatus.status.rebootSchedule.status = 'healthy';
    serverStatus.status.temperatureSchedule.status = 'healthy';
    emitJobEvent({ jobName: 'setupJobs', status: 'ok' });
    eventBus.emit('service-health', {
      jobs: serverStatus.status.jobs,
      alarmSchedule: serverStatus.status.alarmSchedule,
      primeSchedule: serverStatus.status.primeSchedule,
      powerSchedule: serverStatus.status.powerSchedule,
      rebootSchedule: serverStatus.status.rebootSchedule,
      temperatureSchedule: serverStatus.status.temperatureSchedule,
    });
  } catch (error: unknown) {
    serverStatus.status.jobs.status = 'failed';
    const message = error instanceof Error ? error.message : String(error);
    logger.error(error);
    serverStatus.status.jobs.message = message;
    emitJobEvent({ jobName: 'setupJobs', status: 'fail', message });
    eventBus.emit('service-health', { jobs: serverStatus.status.jobs });
  }
}

let RETRY_COUNT = 0;

function waitForValidDateAndSetupJobs() {
  serverStatus.status.systemDate.status = 'started';

  if (isSystemDateValid()) {
    serverStatus.status.systemDate.status = 'healthy';
    serverStatus.status.systemDate.message = '';
    logger.info('System date is valid. Setting up jobs...');
    void setupJobs();
  } else if(RETRY_COUNT < 20) {
    serverStatus.status.systemDate.status = 'retrying';
    const message = `System date is invalid (year 2010). Retrying in 5 seconds... (Attempt #${RETRY_COUNT}})`;
    serverStatus.status.systemDate.message = message;
    RETRY_COUNT++;
    logger.debug(message);
    setTimeout(waitForValidDateAndSetupJobs, 5_000);
  } else {
    const message = `System date is invalid! No jobs can be scheduled! ${new Date().toISOString()} `;
    serverStatus.status.systemDate.message = message;
    logger.warn(message);
  }
}


// Monitor the JSON file and refresh jobs on change
chokidar.watch(config.lowDbFolder).on('change', (changedPath) => {
  const fileName = path.basename(changedPath);
  if (fileName === 'servicesDB.json') {
    logger.info(`Skipping restarting jobs for DB change: ${fileName}`);
    return;
  } else {
    logger.info(`Detected DB change, reloading... ${fileName}`);
  }

  if (serverStatus.status.systemDate.status === 'healthy') {
    void setupJobs();
  } else {
    waitForValidDateAndSetupJobs();
  }
});

// Initial job setup
waitForValidDateAndSetupJobs();
