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

Device control:
- **`/api/deviceStatus`:** Fetches and updates the status of the device.
- **`/api/settings`:** Manages device settings (timezone, away mode, priming schedules, temperature format, daily reboot).
- **`/api/schedules`:** Daily schedules for power on/off, temperature, and alarms.
- **`/api/execute`:** Sends raw franken commands directly to the device (`SET_TEMP`, `PRIME`, etc.). See [API.md](./API.md).
- **`/api/alarm`:** Trigger / dismiss the bed-vibration alarm.
- **`/api/base-control`:** Adjustable-base position control (Pod 4+): get state, set head/foot %, run preset, stop.
- **`/api/jobs`:** Manually run a scheduled job (e.g. analyze-sleep) on demand.

Biometrics & sleep data:
- **`/api/metrics/vitals`** + **`/api/metrics/vitals/summary`:** Heart rate, HRV, breathing rate (raw rows + summary stats).
- **`/api/metrics/movement`:** Bed-movement records derived from piezo data.
- **`/api/metrics/sleep`:** Sleep records (entered_bed_at / left_bed_at / present_intervals); supports GET, PUT (edit), DELETE.
- **`/api/metrics/sleep-stages`:** Per-epoch sleep-stage classification (awake / REM / light / deep).
- **`/api/metrics/sleep-score`:** Aggregate score for a given sleep period.
- **`/api/metrics/presence`:** Real-time presence flags per side (in-memory; updated by the biometrics service).

Operations & introspection:
- **`/api/serverStatus`:** Health snapshot of every service (express, jobs, franken socket, biometrics, etc.).
- **`/api/services`:** Toggle and inspect service state (e.g., enable/disable biometrics, sentry).
- **`/api/logs`** + **`/api/logs/:filename`:** List log files and stream content via SSE.
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
Hybrid setup — different storage backends for different data shapes:
- **LowDB (JSON files at `/persistent/free-sleep-data/lowdb/`)** for low-volume config data:
  - `schedulesDB.json` — daily schedules (power, temperature, alarms)
  - `settingsDB.json` — timezone, away mode, prime time, etc.
  - Schemas validated with `zod`. Files are created on first run; you do not need to create them.
- **SQLite via Prisma (`/persistent/free-sleep-data/free-sleep.db`)** for biometric time-series:
  - Tables: `vitals`, `movement`, `sleep_records` (schema in `prisma/schema.prisma`).
  - Migrations in `prisma/migrations/` are applied on server startup.
  - Read paths: `loadVitalsRecords.ts`, `loadMovementRecords.ts`, `loadSleepRecords.ts`.


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
├── free-sleep-data/        # Local-dev mirror of /persistent/free-sleep-data/ on the Pod
├── prisma/
│   ├── schema.prisma       # SQLite schema for vitals, movement, sleep_records
│   └── migrations/         # Auto-applied on server start
├── src/
│   ├── 8sleep/             # Franken socket client (dac.sock), command queue, monitor
│   ├── db/                 # LowDB stores + Prisma client + read helpers
│   ├── events/             # In-process eventBus (DeviceStatus / serverStatus / job events)
│   ├── jobs/               # node-schedule jobs + jobEvents emitter
│   ├── metrics/            # In-process metrics (latency histograms, queue depth, WS clients)
│   ├── routes/             # Express routes (one folder per resource group)
│   │   ├── alarm/  baseControl/  deviceStatus/  execute/  jobs/  logs/
│   │   ├── metrics/        # vitals, movement, sleep, sleepStages, sleepScore, presence
│   │   ├── metricsServer/  # /api/metrics/server
│   │   ├── schedules/  serverStatus/  services/  settings/
│   ├── ws/                 # WebSocket server (heartbeat + eventBus → clients)
│   ├── setup/              # Middleware + route registration
│   ├── logger.ts           # Logging configuration
│   ├── server.ts           # Core server entry point
├── dist/                   # Compiled output (generated by TypeScript)
├── tsconfig.json
├── package.json
```

---

## Pod-side runtime configuration

These changes live on the Pod itself, not in this repo. They were applied
manually after a fresh install to free RAM/CPU/disk and quiet logs. If you
re-image a Pod or fork this onto a new device, replay them. Each is reversible.

### 1. Cap journald at 100 MB (recovers ~700 MB on `/persistent`)

`/var/log/journal` is symlinked to `/persistent/journal`, so unbounded systemd
logs eat into the persistent partition.

```bash
# On the Pod (as root):
sed -i.bak 's/^SystemMaxUse=.*/SystemMaxUse=100M/' /etc/systemd/journald.conf
systemctl restart systemd-journald
journalctl --vacuum-size=100M
```

Reverse: `cp /etc/systemd/journald.conf.bak /etc/systemd/journald.conf && systemctl restart systemd-journald`.

### 2. Disable `Eight.Capybara` (frees ~180 MB RAM and ~11% CPU)

Capybara is Eight Sleep's proprietary cloud-telemetry agent. It's not used by
free-sleep — local control goes through `frankenfirmware` on `dac.sock`, not
the `capybara-dac` socket. Capybara's only systemd reverse-dependency is
`multi-user.target` (i.e. nothing critical needs it).

```bash
# On the Pod:
systemctl stop capybara
systemctl disable capybara   # use disable, NOT mask — disable is reversible
```

Reverse: `systemctl enable --now capybara`.

If a future Eight firmware update misbehaves, re-enable first as a sanity check.

### 3. Pin the resolved node binary in `free-sleep.service` (frees ~30 MB RAM)

The default unit file used `/home/dac/.volta/bin/node` — that's volta's shim,
which exec's the real node but stays as an idle parent process. Pin to the
resolved path so there's only one process:

```bash
# On the Pod:
NEW_NODE_PATH=$(sudo -u dac /home/dac/.volta/bin/volta which node)
SVC=/etc/systemd/system/free-sleep.service
cp "$SVC" "${SVC}.bak"
sed -i "s|^ExecStart=.*|ExecStart=${NEW_NODE_PATH} dist/server.js|" "$SVC"
systemctl daemon-reload
systemctl restart free-sleep
```

Verify with `pstree -p $(systemctl show -p MainPID --value free-sleep)` — should
be a single node process, not parent + child.

Reverse: `cp ${SVC}.bak ${SVC} && systemctl daemon-reload && systemctl restart free-sleep`.

If volta upgrades the cached node version later, the pinned path will go stale.
Re-run the snippet above to refresh it.

### 4. Quieter access logger (in-repo)

The express access logger now demotes successful, fast (< 250 ms) responses
from `info` to `debug`. In production (`NODE_ENV=production`, default
`LOG_LEVEL=info`) those are dropped entirely; only ≥ 400 status codes or
slow responses are logged. See [setup/middleware.ts](src/setup/middleware.ts).
Set `LOG_LEVEL=debug` in `/home/dac/free-sleep/server/.env.pod` to bring back
verbose access logging temporarily.

### 5. Less spammy presence-debug log (in-repo)

[`biometric_processor.py`](../biometrics/stream/biometric_processor.py) now
emits `[presence-debug]` once a minute per side instead of every 30 s.

### Verifying the optimizations

```bash
# RAM should show ~150–200 MB more available than a stock Pod:
ssh -p 8822 root@<pod> 'free -h | head -2'

# /persistent should be << 1 GB:
ssh -p 8822 root@<pod> 'df -h /persistent | tail -1'

# Capybara should be inactive/disabled:
ssh -p 8822 root@<pod> 'systemctl status capybara || true'

# Single-process node:
ssh -p 8822 root@<pod> 'pstree -p $(systemctl show -p MainPID --value free-sleep)'
```


