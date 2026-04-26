// LowDB, stores the schedules in /persistent/free-sleep-data/lowdb/settingsDB.json
import _ from 'lodash';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import config from '../config.js';
const defaultSideSettings = {
    name: 'Side',
    awayMode: false,
    scheduleOverrides: {
        temperatureSchedules: {
            disabled: false,
            expiresAt: ''
        },
        alarm: {
            disabled: false,
            timeOverride: '',
            expiresAt: '',
        }
    },
    taps: {
        doubleTap: {
            type: 'temperature',
            change: 'decrement',
            amount: 2,
        },
        tripleTap: {
            type: 'temperature',
            change: 'increment',
            amount: 2,
        },
        quadTap: {
            type: 'base_control',
            behavior: 'toggle_preset',
        },
    }
};
const defaultData = {
    id: crypto.randomUUID(),
    timeZone: 'UTC',
    temperatureFormat: 'fahrenheit',
    rebootDaily: true,
    left: {
        ..._.cloneDeep(defaultSideSettings),
        name: 'Left',
    },
    right: {
        ..._.cloneDeep(defaultSideSettings),
        name: 'Right',
    },
    primePodDaily: {
        enabled: false,
        time: '14:00',
    },
};
const file = new JSONFile(`${config.lowDbFolder}settingsDB.json`);
const settingsDB = new Low(file, defaultData);
await settingsDB.read();
// Allows us to add default values to the settings if users have existing settingsDB.json data
settingsDB.data = _.merge({}, defaultData, settingsDB.data);
// Migration: 'celsius' display format was replaced by 'level' (-10..+10 scale
// matching the official Pod app). Force any existing 'celsius' value to 'level'.
// @ts-ignore - 'celsius' is no longer in the union but old saved data may have it
if (settingsDB.data.temperatureFormat === 'celsius') {
    settingsDB.data.temperatureFormat = 'level';
}
// Migration: Bump temperature tap amount from old default of 1 to 2.
for (const sideKey of ['left', 'right']) {
    for (const gesture of ['doubleTap', 'tripleTap']) {
        const tap = settingsDB.data[sideKey].taps[gesture];
        if (tap.type === 'temperature' && tap.amount === 1) {
            tap.amount = 2;
        }
    }
}
// Migration: Force update quadTap from 'alarm' to 'base_control' if it's the old default
if (settingsDB.data.left.taps.quadTap.type === 'alarm') {
    const baseControlTap = {
        type: 'base_control',
        behavior: 'toggle_preset',
    };
    settingsDB.data.left.taps.quadTap = baseControlTap;
    settingsDB.data.right.taps.quadTap = baseControlTap;
}
await settingsDB.write();
export default settingsDB;
//# sourceMappingURL=settings.js.map