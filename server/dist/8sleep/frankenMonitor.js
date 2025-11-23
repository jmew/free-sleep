import moment from 'moment-timezone';
import logger from '../logger.js';
import settingsDB from '../db/settings.js';
import memoryDB from '../db/memoryDB.js';
import { connectFranken } from './frankenServer.js';
import { wait } from './promises.js';
import { Version } from '../routes/deviceStatus/deviceStatusSchema.js';
import { GestureSchema } from '../db/settingsSchema.js';
import { updateDeviceStatus } from '../routes/deviceStatus/updateDeviceStatus.js';
import serverStatus from '../serverStatus.js';
import { trimixBase } from './trimixBaseControl.js';
import { BASE_PRESETS } from './basePresets.js';
export class FrankenMonitor {
    isRunning;
    deviceStatus;
    currentBasePreset = 'relax';
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
            serverStatus.status.frankenMonitor.status = 'failed';
            serverStatus.status.frankenMonitor.message = String(error);
            serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
        });
    }
    stop() {
        if (!this.isRunning)
            return;
        logger.debug('Stopping FrankenMonitor loop');
        this.isRunning = false;
    }
    async processGesture(side, gesture) {
        const behavior = settingsDB.data[side].taps[gesture];
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
            return await updateDeviceStatus({ [side]: { targetTemperatureF: newTemperatureTargetF } });
        }
        else if (behavior.type === 'base_control') {
            // Cycle between relax and flat presets
            this.currentBasePreset =
                this.currentBasePreset === 'relax' ? 'flat' : 'relax';
            const targetPreset = BASE_PRESETS[this.currentBasePreset];
            logger.info(`[quadTap] Cycling base to ${this.currentBasePreset} preset:`, targetPreset);
            try {
                // Update memory DB to reflect movement
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
                // Control the base via BLE
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
                // Revert preset state on error
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
    async frankenLoop() {
        const franken = await connectFranken();
        this.deviceStatus = await franken.getDeviceStatus(false);
        let hasGestures = this.deviceStatus.coverVersion !== Version.Pod3;
        let waitTime = hasGestures ? 2_000 : 60_000;
        if (hasGestures) {
            this.deviceStatus = await franken.getDeviceStatus(true);
            logger.debug(`Gestures supported for ${this.deviceStatus.coverVersion}`);
        }
        else {
            logger.debug(`Gestures not supported for ${this.deviceStatus.coverVersion}`);
        }
        // No point in querying device status every 3 seconds for checking the prime status...
        while (this.isRunning) {
            try {
                while (this.isRunning) {
                    hasGestures = this.deviceStatus.coverVersion !== Version.Pod3;
                    waitTime = hasGestures ? 2_000 : 60_000;
                    await wait(waitTime);
                    if (!this.isRunning)
                        break;
                    const franken = await connectFranken();
                    const nextDeviceStatus = await franken.getDeviceStatus(hasGestures);
                    await settingsDB.read();
                    if (hasGestures) {
                        this.processGestures(nextDeviceStatus);
                    }
                    this.deviceStatus = nextDeviceStatus;
                    serverStatus.status.frankenMonitor.status = 'healthy';
                    serverStatus.status.frankenMonitor.message = '';
                    serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
                }
            }
            catch (error) {
                serverStatus.status.frankenMonitor.status = 'failed';
                serverStatus.status.frankenMonitor.message = String(error);
                serverStatus.status.frankenMonitor.timestamp = moment.tz().format();
                logger.error(error instanceof Error ? error.message : String(error), 'franken disconnected');
                await wait(waitTime);
            }
        }
        logger.debug('FrankenMonitor loop exited');
    }
}
//# sourceMappingURL=frankenMonitor.js.map