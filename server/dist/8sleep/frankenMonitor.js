import moment from 'moment-timezone';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import memoryDB from '../db/memoryDB.js';
import { connectFranken, FrankenCommandTimeoutError } from './frankenServer.js';
import { wait } from './promises.js';
import { GestureSchema } from '../db/settingsSchema.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import { markManualTempChange } from '../jobs/scheduleOverride.js';
import serverStatus from '../serverStatus.js';
import { trimixBase } from './trimixBaseControl.js';
import { BASE_PRESETS } from './basePresets.js';
import eventBus from '../events/eventBus.js';
// Pod 4+ only: gestures and the 2s cadence are the only path. The Pod 3
// 60s slow-poll branch was removed alongside the WebSocket initiative.
const ACTIVE_POLL_MS = 2_000;
const IDLE_POLL_MS = 10_000;
export class FrankenMonitor {
    isRunning;
    deviceStatus;
    currentBasePreset = 'flat';
    constructor() {
        this.isRunning = false;
        this.deviceStatus = undefined;
    }
    async start() {
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
    stop() {
        if (!this.isRunning)
            return;
        logger.debug('Stopping FrankenMonitor loop');
        this.isRunning = false;
    }
    markStatus(status, message = '') {
        const prev = serverStatus.status.frankenMonitor.status;
        serverStatus.status.frankenMonitor.status = status;
        serverStatus.status.frankenMonitor.message = message;
        serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
        if (prev !== status) {
            eventBus.emit('service-health', { frankenMonitor: serverStatus.status.frankenMonitor });
        }
    }
    async processGesture(side, gesture) {
        const behavior = settingsDB.data[side].taps[gesture];
        logger.debug(`[processGesture] side: ${side}, gesture: ${gesture}, type: ${behavior.type}`);
        if (behavior.type === 'temperature') {
            const currentTemperatureTarget = this.deviceStatus[side].targetTemperatureF;
            let newTemperatureTargetF;
            const change = behavior.amount;
            if (behavior.change === 'increment') {
                newTemperatureTargetF = currentTemperatureTarget + change;
            }
            else {
                newTemperatureTargetF = currentTemperatureTarget + (-1 * change);
            }
            logger.debug(`Processing gesture temperature change for ${side}. ${currentTemperatureTarget} -> ${newTemperatureTargetF}`);
            await updateDeviceStatus({ [side]: { targetTemperatureF: newTemperatureTargetF } });
            // Tap counts as a manual change for schedule-override purposes.
            await markManualTempChange(side);
            return;
        }
        else if (behavior.type === 'base_control') {
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
                logger.info(`[quadTap] Already at ${this.currentBasePreset} preset (head=${current.head}, feet=${current.feet}); skipping setPosition.`);
                return;
            }
            logger.info(`[quadTap] Cycling base to ${this.currentBasePreset} preset:`, targetPreset);
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
                }
                else {
                    await trimixBase.setPosition({
                        head: targetPreset.head,
                        feet: targetPreset.feet,
                        feedRate: targetPreset.feedRate,
                    });
                }
            }
            catch (error) {
                logger.error(`[quadTap] Failed to set base preset: ${error instanceof Error ? error.message : String(error)}`);
                this.currentBasePreset =
                    this.currentBasePreset === 'relax' ? 'flat' : 'relax';
            }
        }
        else if (behavior.type) {
            // TODO: Add alarm handling
            logger.warn('Skipping gesture...');
        }
    }
    processGesturesForSide(nextDeviceStatus, side) {
        try {
            for (const gesture of GestureSchema.options) {
                if (nextDeviceStatus[side].taps?.[gesture] !== this?.deviceStatus?.[side].taps?.[gesture]) {
                    this.processGesture(side, gesture);
                }
            }
        }
        catch (error) {
            logger.error(error);
        }
    }
    async processGestures(nextDeviceStatus) {
        if (!this.deviceStatus) {
            logger.warn('Missing current deviceStatus, exiting...');
            return;
        }
        this.processGesturesForSide(nextDeviceStatus, 'left');
        this.processGesturesForSide(nextDeviceStatus, 'right');
    }
    // Cheap deep-equality for the status payload. The shape is stable so a
    // JSON round-trip is the simplest correct comparison.
    hasStatusChanged(next) {
        if (!this.deviceStatus)
            return true;
        return JSON.stringify(this.deviceStatus) !== JSON.stringify(next);
    }
    currentWaitTime() {
        return eventBus.clientCount > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    }
    async frankenLoop() {
        const franken = await connectFranken();
        this.deviceStatus = await franken.getDeviceStatus(true);
        eventBus.emit('device-status', this.deviceStatus);
        while (this.isRunning) {
            try {
                while (this.isRunning) {
                    await wait(this.currentWaitTime());
                    if (!this.isRunning)
                        break;
                    const f = await connectFranken();
                    let nextDeviceStatus;
                    try {
                        nextDeviceStatus = await f.getDeviceStatus(true);
                    }
                    catch (error) {
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
            }
            catch (error) {
                this.markStatus('failed', String(error));
                logger.error(error instanceof Error ? error.message : String(error), 'franken disconnected');
                await wait(this.currentWaitTime());
            }
        }
        logger.debug('FrankenMonitor loop exited');
    }
}
//# sourceMappingURL=frankenMonitor.js.map