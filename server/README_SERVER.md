# Server Documentation

## Overview
Express server intended to run on the 8 sleep pod.  

## Developing

### Hot Reloading (on Pod) 
1. SSH into the Pod and run
```
fs-dev-server

# When you're done, undo this by CTR+C out of the npm run dev command & run:
systemctl start free-sleep
```
2. Run the front-end app with hot reload and point it to your Pod [app/README_APP.md](../app/README_APP.md#Developing)

### Hot Reloading (on computer, not your Pod)
- `npm run dev:local`


### My development process
1. I run this server on my Pod with hot reloading (see above)
1. I have IntelliJ setup to auto upload my file changes to the Pod [IntelliJ documentation for this config](https://www.jetbrains.com/help/idea/tutorial-deployment-in-product.html#downloading).
VSCode also has a similar feature, I think this is the documentation for it [VSCode](https://code.visualstudio.com/docs/remote/ssh)

--- 


## Architecture
The server is composed of the following key components:

### 1. **Core Server (`server.ts`):**
- Sets up and starts an Express.js server.
- Initializes middleware and routes.
- Manages graceful shutdown processes for reliability.

### 2. **Routes:**
- **`/api/deviceStatus`:** Fetches and updates the status of the device.
- **`/api/settings`:** Manages device settings (e.g., timezone, away mode, priming schedules).
- **`/api/schedules`:** Handles scheduling for device operations.
- **`/api/execute`:** Sends commands directly to the device.
- **`/api/metrics/vitals`:** Biometrics (heart rate, HRV, breathing rate)
- **`/api/metrics/sleep`:** Sleep intervals
- **`/api/metrics/server`:** In-process metrics — Franken command latency p50/p95,
  timeout count, queue depth, WS client count, job exec counts, memory/uptime.
  Read-only JSON; useful for debugging on the pod (`curl localhost:3000/api/metrics/server`).

### 3. **WebSocket — `/ws/events`:**
- Real-time push channel for the React app. Frames are JSON envelopes
  `{ channel, payload, ts }` with channels:
  - `device-status` — full DeviceStatus snapshot whenever it changes (the
    FrankenMonitor diffs and only emits on actual change). The app uses this
    to update React Query's cache in place; no follow-up HTTP refetch.
  - `service-health` — partial server-status patch when a check transitions
    (healthy ↔ failed). Triggers a `useServerStatus` invalidation on the client.
  - `job-event` — fired when a scheduled job starts / succeeds / fails
    (alarms, temperature changes, prime, etc.).
- Heartbeat: server pings every 15s and drops sockets that miss two pongs.
- Client wraps native `WebSocket` (no library); auto-reconnects with
  exponential backoff up to 30s. While disconnected, the React Query hooks
  fall back to their 30–60s polling.
- Adaptive polling: `FrankenMonitor` runs at 2s while ≥1 WS client is
  connected, 10s when idle. (Pod 4+ only — Pod 3's slower path was removed.)

### 4. **Command timeouts (`Franken`):**
- Every dac.sock command is now bounded by `FRANKEN_COMMAND_TIMEOUT_MS`
  (default 5000, env-overridable). On timeout the queued caller is rejected
  and the connection is torn down so the next call rebuilds it. Previously,
  a hung pod stalled the entire server until process restart.

### 5. **Jobs Scheduler (`src/jobs/`):**
- Schedules periodic tasks like temperature adjustments, power on/off, and device priming using the `node-schedule` library.
- Monitors changes to the DB storage files in `src/db/`, clears all schedules and recreates them every time changes are made


### 6. **Database (`src/db/`):**
- The JSON files are created the first time the server runs, you do not need to create them
- Uses `lowdb` for simple JSON-based storage.
- Includes schemas for schedules, settings, and time zones, validated with `zod`.


### 7. **8 Sleep Integration (`src/8sleep/`):**
- Contains utilities to communicate with the "Franken" device using Unix sockets.
  - This is based off of the EXISTING code on the pod in /home/dac/app/

---

## Key Features

### Device control
- The server connects to the device using a Unix socket @ `/deviceinfo/dac.sock` (varies by Pod version & firmware version, path is detected in install.sh script and saved to `/persistent/free-sleep-data/dac_sock_path.txt`)
- Commands are sent to the device for various operations, including temperature adjustments and status retrieval.

### Scheduling
- Jobs like temperature changes, power toggling, and device priming are scheduled based on user-defined schedules.
- Changes to schedules or settings automatically trigger updates to the jobs

---

## Installation

### Prerequisites
- Volta for node version control

### Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Start the server:
   ```bash
   npm start
   ```

---

## File Structure
```
server/
├── free-sleep-data/        # For local development - mimics the /persistent/free-sleep-data/ folder on Pod
├── src/
│   ├── 8sleep/             # Integration with the "Franken" device
│   ├── db/                 # JSON database and schemas
│   ├── jobs/               # Job scheduling utilities
│   ├── logger.ts           # Logging configuration
│   ├── routes/             # API routes
│   ├── setup/              # Middleware and routes setup
│   ├── server.ts           # Core server entry point
├── dist/                   # Compiled output (generated by TypeScript)
├── tsconfig.json           
├── package.json            
```

---



