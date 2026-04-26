import React, { useEffect } from 'react';
import { create } from 'zustand';
import moment from 'moment-timezone';

import { useSettings } from '@api/settings.ts';
import { useServices } from '@api/services.ts';
import { closeSentry, initSentryTags } from '../sentry.tsx';
import { useDeviceStatus } from '@api/deviceStatus.ts';
import { useEventStream } from '@api/eventStream.ts';

export type Side = 'left' | 'right';

type AppState = {
  isUpdating: boolean;
  setIsUpdating: (isUpdating: boolean) => void;
  side: Side;
  setSide: (side: Side) => void;
};

const SIDE_KEY = 'side';
export const USER_ID_KEY = 'user_id';
export const HUB_VERSION_KEY = 'pod_version';
export const COVER_VERSION_KEY = 'cover_version';

// Create Zustand store
export const useAppStore = create<AppState>((set) => ({
  isUpdating: false,
  setIsUpdating: (isUpdating: boolean) => set({ isUpdating }),
  side: localStorage.getItem(SIDE_KEY) as Side || 'left',
  setSide: (side: Side) => {
    set({ side });
    localStorage.setItem(SIDE_KEY, side);
  },
}));

// AppStoreProvider to sync Zustand with react-query's isFetching
export function AppStoreProvider({ children }: React.PropsWithChildren) {
  // One WebSocket for the whole app — pushes device-status/service-health
  // updates straight into the React Query cache. Mounted at the tree root so
  // there's no per-page connection churn.
  useEventStream();
  const { data: settings } = useSettings();
  const { data: services } = useServices();
  const { data: deviceStatus } = useDeviceStatus();

  useEffect(() => {
    if (!settings) return;
    moment.tz.setDefault(settings.timeZone);
  }, [settings]);

  useEffect(() => {
    if (!settings || !deviceStatus || !services) return;
    localStorage.setItem(USER_ID_KEY, settings.id);
    localStorage.setItem(HUB_VERSION_KEY, deviceStatus.hubVersion);
    localStorage.setItem(COVER_VERSION_KEY, deviceStatus.coverVersion);

    if (services.sentryLogging) {
      initSentryTags(settings, deviceStatus);
    } else {
      closeSentry();
    }
  }, [settings, deviceStatus, services]);

  return <>{ children }</>;
}
