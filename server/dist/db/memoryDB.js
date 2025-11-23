// This is for storing data in memory when we don't want to update any files in the config.dbFolder
// Updating files in the config.dbFolder will re-trigger job deletion and creation
// This only keeps track of if the alarm is running, since we can't get that programmatically from the pod
import { Low, Memory } from 'lowdb';
const defaultMemoryDB = {
    left: {
        isAlarmVibrating: false,
        analyzeSleep: {
            lastRan: undefined,
        }
    },
    right: {
        isAlarmVibrating: false,
        analyzeSleep: {
            lastRan: undefined,
        }
    },
};
const adapter = new Memory();
const memoryDB = new Low(adapter, defaultMemoryDB);
await memoryDB.read();
memoryDB.data = memoryDB.data || defaultMemoryDB;
await memoryDB.write();
export default memoryDB;
//# sourceMappingURL=memoryDB.js.map