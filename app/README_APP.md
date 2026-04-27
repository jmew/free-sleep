# App Documentation

## Overview
This application is a React-based frontend designed to manage the 8 sleep pod's settings, schedules, and temperature controls. 
It communicates with the backend API to fetch, update, and synchronize data. 
The app uses Material-UI for styling and layout, Zustand for state management, and React Query for API interaction.


## Developing
1. **Optional**: If you also want to make changes to the back-end server at the same time, setup the back-end server to run in hot reload mode [server/README_SERVER.md](../server/README_SERVER.md#Developing)
1. Run vite hot reloading & specify the IP address for your Pod. This tells axios to make API requests at a different IP (see [app/src/api/api.ts](app/src/api/api.ts))
- `VITE_POD_IP=<YOUR_POD_IP> npm run dev`
- `VITE_POD_IP=192.168.1.50 npm run dev`

---

## Key Features
- **Dynamic Temperature Control**: Adjust temperature settings with a circular slider.
- **Scheduling**: Set and manage daily temperature schedules with power on/off times and temperature adjustments.
- **Alarms**: Per-day alarm configuration with vibration intensity, pattern, and duration.
- **Adjustable base control** (Pod 4+): manual head/foot positioning and presets.
- **Sleep dashboard**: per-night sleep stages chart, heart rate / breathing rate / HRV trends, sleep score, sleep consistency.
- **Settings Management**: Update timezone, temperature units, away mode, daily priming, daily reboot.
- **Device Status**: Monitor and update the device's operational status.
- **Multi-Side Control**: Configure settings for both left and right sides of the device.
- **Real-time updates**: WebSocket client (`api/eventStream.ts`) consumes `/ws/events` and pushes deviceStatus / serverStatus / job-event changes into React Query's cache, so the UI reflects pod state without polling.
---

## Directory Structure

### **Main Application Files**
- `main.tsx`: Entry point, sets up routing, themes, and context providers.
- `vite-env.d.ts`: Type definitions for the Vite environment.

### **State Management**
- `appStore.tsx`: Global state using Zustand for tracking UI updates, selected side, and fetching status.

### **API (`src/api/`)**
React Query hooks + Axios client + Zod schemas. One file per resource group:
- `deviceStatus.ts`, `settings.ts`, `schedules.ts`, `alarm.ts`, `baseControl.ts`, `jobs.ts`, `logs.ts`
- `services.ts`, `serverStatus.ts`, `serverInfo.ts`
- `vitals.ts`, `movement.ts`, `sleep.ts`, `sleepStages.ts`, `sleepScore.ts`, `presence.ts`
- `timeZones.ts` — static timezone list
- `eventStream.ts` — WebSocket subscription that updates React Query caches in place
- `*Schema.ts` — shared Zod schemas (`schedulesSchema`, `settingsSchema`, `serverStatusSchema`, etc.)
- `api.ts` — Axios setup; respects `VITE_POD_IP` for dev mode

### **Components**
- `Layout`: Main application layout with a navbar and routed content.
- `Navbar`: Provides navigation for different app sections with responsive support.
- `PageContainer`: Standardized container for page content.
- Charts: `VitalsLineChart`, `SleepStagesCard`, `SleepFitnessCard`, `SleepConsistencyCard`, `SleepBalanceCard`, `VitalsSummaryCard`.

### **Pages (`src/pages/`)**
- **ControlTempPage**: Real-time temperature adjustments (slider, power button, away-mode notifications).
- **SchedulePage**: Daily schedules — power, temperature, alarms — with multi-day apply.
- **SettingsPage**: Timezone, units, away mode, daily priming, daily reboot, brightness, alarm test, license/about.
- **BaseControlPage**: Adjustable-base position (Pod 4+).
- **DataPage** (and `DataPage/SleepPage`): Sleep dashboard — week strip, sleep stages, vitals charts, sleep score / consistency.
- **StatusPage**: Service health overview using `/api/serverStatus`.

---

## State Management
The app uses:
1. **Zustand**: For local state management (selected side, UI toggles).
2. **React Query**: For fetching and caching API data — with automatic retries, refetch on focus, and live updates via `eventStream.ts`.

---

## API Integration
- **React Query** is used for seamless API interactions with optimistic updates and error handling.
- **WebSocket** (`/ws/events`) is the realtime path: `eventStream.ts` connects on app start, auto-reconnects with exponential backoff up to 30s, and falls back to React Query's polling while disconnected.
- **Axios** provides the underlying HTTP client setup in `api/api.ts`.

--- 

## Themes and Styles
- **Material-UI**: Provides consistent theming and components.

---

## Error Handling
- **Device Status Errors**: Prompts the user to retry fetching status.
- **Schedule Validation**: Ensures times and temperatures are within valid ranges.

---

## Extensibility
- **Add Features**: Easily add new pages by extending the routing setup in `main.tsx`.

---

## License and Disclaimer
The app is open source under the MIT License. For full terms, refer to the license modal in the settings page.
