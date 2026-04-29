import _ from 'lodash';
import { create } from 'zustand';
import { DeepPartial } from 'ts-essentials';
import { DeviceStatus } from '@api/deviceStatusSchema.ts';


type ControlTempStore = {
  deviceStatus: DeviceStatus | undefined;
  pendingEdits: number;
  setDeviceStatus: (newDeviceStatus: DeepPartial<DeviceStatus>) => void;
  beginEdit: () => void;
  endEdit: () => void;
  syncFromServer: (next: DeviceStatus) => void;
};

export const useControlTempStore = create<ControlTempStore>((set, get) => ({
  deviceStatus: undefined,
  pendingEdits: 0,
  setDeviceStatus: (newDeviceStatus) => {
    const { deviceStatus } = get();
    const updatedDeviceStatus = _.merge(deviceStatus, newDeviceStatus);
    set({ deviceStatus: updatedDeviceStatus });
  },
  beginEdit: () => set((s) => ({ pendingEdits: s.pendingEdits + 1 })),
  endEdit: () => set((s) => ({ pendingEdits: Math.max(0, s.pendingEdits - 1) })),
  // Server-pushed state. While the user has an edit in flight, ignore it —
  // a stale push from the FrankenMonitor 2s poll would otherwise clobber the
  // optimistic value the user just typed/tapped.
  syncFromServer: (next) => {
    if (get().pendingEdits > 0) return;
    set({ deviceStatus: next });
  },
}));
