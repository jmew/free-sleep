import moment from 'moment-timezone';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import memoryDB from '../db/memoryDB.js';
import { connectFranken, FrankenCommandTimeoutError } from './frankenServer.js';
import { wait } from './promises.js';
import { DeviceStatus } from '../routes/deviceStatus/deviceStatusSchema.js';
import { Side } from '../db/schedulesSchema.js';
import { Gesture, GestureSchema } from '../db/settingsSchema.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { markManualTempChange } from '../jobs/scheduleOverride.js';
import { DeepPartial } from 'ts-essentials';
import serverStatus from '../serverStatus.js';
import { trimixBase } from './trimixBaseControl.js';
import { BASE_PRESETS } from './basePresets.js';
import eventBus from '../events/eventBus.js';

// Pod 4+ only: gestures and the 2s cadence are the only path. The Pod 3
// 60s slow-poll branch was removed alongside the WebSocket initiative.
//
// IMPORTANT: this loop is also where physical-tap gestures (quad-tap to
// toggle the base, double/triple-tap for temperature) are detected — a
// gesture is "seen" by diffing the franken status snapshot against the
// previous one. So this cadence is also the worst-case quad-tap latency.
// We previously throttled to 10s when no WebSocket clients were connected,
// which made quad-tap take 5-10s when the app wasn't open. Gestures are
// a physical interaction independent of whether anyone's watching the
// app, so always poll fast.
const POLL_MS = 2_000;


export class FrankenMonitor {
  private isRunning: boolean;
  private deviceStatus?: DeviceStatus;
  private currentBasePreset: keyof typeof BASE_PRESETS = 'flat';

  constructor() {
    this.isRunning = false;
    this.deviceStatus = undefined;
  }

  public async start() {
    if (this.isRunning) {
      logger.warn('FrankenMonitor is already running');
      return;
    }
    this.isRunning = true;
    this.frankenLoop().catch(error => {
      logger.error(error);
      this.markStatus('failed', String(error));
    });
  }

  public stop() {
    if (!this.isRunning) return;
    logger.debug('Stopping FrankenMonitor loop');
    this.isRunning = false;
  }

  private markStatus(status: 'healthy' | 'failed', message = '') {
    const prev = serverStatus.status.frankenMonitor.status;
    serverStatus.status.frankenMonitor.status = status;
    serverStatus.status.frankenMonitor.message = message;
    serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
    if (prev !== status) {
      eventBus.emit('service-health', { frankenMonitor: serverStatus.status.frankenMonitor });
    }
  }

  private async processGesture(side: Side, gesture: Gesture) {
    const behavior = settingsDB.data[side].taps[gesture];
    logger.debug(`[processGesture] side: ${side}, gesture: ${gesture}, type: ${behavior.type}`);

    if (behavior.type === 'temperature') {
      const currentTemperatureTarget = this.deviceStatus![side].targetTemperatureF;
      let newTemperatureTargetF;
      const change = behavior.amount;
      if (behavior.change === 'increment') {
        newTemperatureTargetF = currentTemperatureTarget + change;
      } else {
        newTemperatureTargetF = currentTemperatureTarget + (-1 * change);
      }
      logger.debug(`Processing gesture temperature change for ${side}. ${currentTemperatureTarget} -> ${newTemperatureTargetF}`);
      await updateDeviceStatus({ [side]: { targetTemperatureF: newTemperatureTargetF } } as DeepPartial<DeviceStatus>);
      // Tap counts as a manual change for schedule-override purposes.
      await markManualTempChange(side);
      return;
    } else if (behavior.type === 'base_control') {
      this.currentBasePreset =
        this.currentBasePreset === 'relax' ? 'flat' : 'relax';

      const targetPreset = BASE_PRESETS[this.currentBasePreset];

      // If the base is already at the target position, skip the BLE command
      // entirely. Calling setPosition with the same position is a no-op at
      // the hardware level — but it leaves isMoving=true in memoryDB with
      // no incoming position-change packets to ever clear it (the timeout
      // in trimixBaseControl.parseNotification only gets armed inside the
      // positionChanged branch). The result is a permanently stuck "Stop
      // movement" button on the elevation page.
      const current = memoryDB.data?.baseStatus;
      if (current && current.head === targetPreset.head && current.feet === targetPreset.feet) {
        logger.info(
          `[quadTap] Already at ${this.currentBasePreset} preset (head=${current.head}, feet=${current.feet}); skipping setPosition.`,
        );
        return;
      }

      logger.info(
        `[quadTap] Cycling base to ${this.currentBasePreset} preset:`,
        targetPreset,
      );

      try {
        if (memoryDB.data) {
          memoryDB.data.baseStatus = {
            head: targetPreset.head,
            feet: targetPreset.feet,
            isMoving: true,
            lastUpdate: new Date().toISOString(),
            isConfigured: true,
          };
          await memoryDB.write();
        }

        if (this.currentBasePreset === 'flat') {
          await trimixBase.goToFlat();
        } else {
          await trimixBase.setPosition({
            head: targetPreset.head,
            feet: targetPreset.feet,
            feedRate: targetPreset.feedRate,
          });
        }
      } catch (error) {
        logger.error(
          `[quadTap] Failed to set base preset: ${error instanceof Error ? error.message : String(error)}`,
        );
        this.currentBasePreset =
        this.currentBasePreset === 'relax' ? 'flat' : 'relax';
      }

    } else if (behavior.type) {
      // TODO: Add alarm handling
      logger.warn('Skipping gesture...');
    }
  }

  private processGesturesForSide(nextDeviceStatus: DeviceStatus, side: Side) {
    try {
      for (const gesture of GestureSchema.options) {
        if (nextDeviceStatus[side].taps?.[gesture] !== this?.deviceStatus?.[side].taps?.[gesture]) {
          this.processGesture(side, gesture);
        }
      }
    } catch (error) {
      logger.error(error);
    }
  }

  private async processGestures(nextDeviceStatus: DeviceStatus) {
    if (!this.deviceStatus) {
      logger.warn('Missing current deviceStatus, exiting...');
      return;
    }

    this.processGesturesForSide(nextDeviceStatus, 'left');
    this.processGesturesForSide(nextDeviceStatus, 'right');
  }

  // Cheap deep-equality for the status payload. The shape is stable so a
  // JSON round-trip is the simplest correct comparison.
  private hasStatusChanged(next: DeviceStatus): boolean {
    if (!this.deviceStatus) return true;
    return JSON.stringify(this.deviceStatus) !== JSON.stringify(next);
  }

  private async frankenLoop() {
    const franken = await connectFranken();
    this.deviceStatus = await franken.getDeviceStatus(true);
    eventBus.emit('device-status', this.deviceStatus);

    while (this.isRunning) {
      try {
        while (this.isRunning) {
          await wait(POLL_MS);
          if (!this.isRunning) break;
          const f = await connectFranken();
          let nextDeviceStatus: DeviceStatus;
          try {
            nextDeviceStatus = await f.getDeviceStatus(true);
          } catch (error) {
            if (error instanceof FrankenCommandTimeoutError) {
              logger.warn(`FrankenMonitor: ${error.message}; will retry next tick`);
              this.markStatus('failed', error.message);
              continue;
            }
            throw error;
          }

          await settingsDB.read();
          this.processGestures(nextDeviceStatus);

          if (this.hasStatusChanged(nextDeviceStatus)) {
            eventBus.emit('device-status', nextDeviceStatus);
          }
          this.deviceStatus = nextDeviceStatus;
          this.markStatus('healthy', '');
        }
      } catch (error) {
        this.markStatus('failed', String(error));
        logger.error(error instanceof Error ? error.message : String(error), 'franken disconnected');
        await wait(POLL_MS);
      }
    }
    logger.debug('FrankenMonitor loop exited');
  }
}
