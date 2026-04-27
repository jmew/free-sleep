# API Endpoints

The server exposes RESTful endpoints for interaction. All responses are JSON unless noted otherwise.

---

## `/api/deviceStatus`

### GET

- Retrieves the current status of the device.

#### Response

```json
{
  "left": {
    "currentTemperatureLevel": -43,
    "currentTemperatureF": 71,
    "targetTemperatureF": 64,
    "secondsRemaining": 0,
    "isOn": false,
    "isAlarmVibrating": false
  },
  "right": {
    "currentTemperatureLevel": -47,
    "currentTemperatureF": 70,
    "targetTemperatureF": 64,
    "secondsRemaining": 0,
    "isOn": false,
    "isAlarmVibrating": false
  },
  "coverVersion": "Pod 3",
  "hubVersion": "Pod 3",
  "freeSleep": {
    "version": "1.0.0",
    "branch": "main"
  },
  "waterLevel": "true",
  "isPriming": false,
  "settings": {
    "v": 1,
    "gainLeft": 400,
    "gainRight": 400,
    "ledBrightness": 0
  },
  "wifiStrength": 52
}
```

### POST

- Updates the device; send only the fields you want to change.

#### Request Body

```json
{
  "left": {
    "targetTemperatureF": 88,
    "isOn": true
  },
  "right": {
    "targetTemperatureF": 90,
    "isOn": false
  },
  "isPriming": true
}
```

---

## `/api/settings`

### GET

- Retrieves the current settings of the system.

#### Response

```json
{
  "id": "d07caf20-4f6a-4a9b-be8e-012989b0a65f",
  "timeZone": "America/Los_Angeles",
  "temperatureFormat": "fahrenheit",
  "rebootDaily": true,
  "left": {
    "name": "Left",
    "awayMode": false
  },
  "right": {
    "name": "Right",
    "awayMode": true
  },
  "primePodDaily": {
    "enabled": true,
    "time": "14:00"
  }
}
```

### POST

- Updates system settings; send only the fields you want to change.

#### Request Body

```json
{
  "timeZone": "America/Los_Angeles",
  "temperatureFormat": "fahrenheit",
  "rebootDaily": true,
  "left": {
    "name": "Left",
    "awayMode": false
  },
  "right": {
    "name": "Right",
    "awayMode": true
  },
  "primePodDaily": {
    "enabled": true,
    "time": "14:00"
  }
}
```

---

## `/api/schedules`

### GET

- Retrieves the current schedules for the system.

#### Response

```json
{
  "left": {
    "monday": {
      "temperatures": {
        "07:00": 72,
        "22:00": 68
      },
      "power": {
        "on": "20:00",
        "off": "08:00",
        "onTemperature": 82,
        "enabled": true
      },
      "alarm": {
        "time": "08:00",
        "vibrationIntensity": 1,
        "vibrationPattern": "rise",
        "duration": 10,
        "enabled": true,
        "alarmTemperature": 78
      }
    }
  }
}
```

### POST

- Updates the schedules for the system.

#### Request Body

```json
{
  "left": {
    "monday": {
      "power": {
        "on": "19:00",
        "off": "07:00",
        "enabled": true
      }
    }
  }
}
```

#### Response

```json
{
  "left": {
    "monday": {
      "temperatures": {},
      "power": {
        "on": "19:00",
        "off": "07:00",
        "onTemperature": 82,
        "enabled": true
      },
      "alarm": {
        "time": "08:00",
        "vibrationIntensityStart": 1,
        "vibrationIntensityEnd": 1,
        "duration": 10,
        "enabled": false,
        "alarmTemperature": 78
      }
    }
  }
}
```

---

## `/api/execute`

### POST

- Executes a specific command on the device.

#### Request Body

```json
{
  "command": "SET_TEMP",
  "arg": "90"
}
```

#### Response

```json
{
  "success": true,
  "message": "Command 'SET_TEMP' executed successfully."
}
```

---

## `/api/alarm`

### POST

- Triggers the bed-vibration alarm immediately, independent of any schedule. Useful for testing alarm patterns/intensities from the UI.

#### Request Body

Same shape as the `alarm` field in `/api/schedules` (validated by `AlarmJobSchema`).

```json
{
  "side": "left",
  "vibrationIntensity": 1,
  "vibrationPattern": "rise",
  "duration": 10,
  "alarmTemperature": 78
}
```

#### Response

Returns the current schedules DB.

---

## `/api/base-control`  (Pod 4+)

Adjustable-base position control. Talks to the base over BLE; position state is mirrored in `memoryDB.baseStatus`.

### GET `/api/base-control`

Current base status.

```json
{
  "head": 30,
  "feet": 0,
  "isMoving": false,
  "lastUpdate": "2026-04-26T10:12:34Z",
  "isConfigured": true
}
```

### POST `/api/base-control`

Move base to an absolute position.

#### Request Body

| Field | Range | Required | Default |
|---|---|---|---|
| `head`     | 0–60 (degrees) | yes | — |
| `feet`     | 0–45 (degrees) | yes | — |
| `feedRate` | 30–100         | no  | 50  |

```json
{ "head": 25, "feet": 10, "feedRate": 50 }
```

### POST `/api/base-control/preset`

Move to a named preset defined in `8sleep/basePresets.ts` (e.g. `flat`, `read`, `tv`, `zeroG`).

```json
{ "preset": "zeroG" }
```

### POST `/api/base-control/stop`

Emergency-stop any in-progress base movement.

---

## `/api/jobs`

### POST

- Manually run one or more scheduled jobs on demand. Useful from the UI when, e.g., a sleep analysis didn't fire automatically.

#### Request Body

Array of job keys:

```json
["analyzeSleepLeft", "analyzeSleepRight"]
```

Valid keys:
- `analyzeSleepLeft` / `analyzeSleepRight` — re-run sleep detection over the last 12 hours.
- `biometricsCalibrationLeft` / `biometricsCalibrationRight` — recalibrate cap-sensor presence thresholds over the last 2 hours.
- `reboot` — schedule a reboot.
- `update` — run the update script.

---

## `/api/metrics/sleep`

### GET

- Retrieves sleep records based on optional query parameters.
- Query parameters:
  - `side` (optional): Filter by the side of the bed (e.g., "left" or "right").
  - `startTime` (optional): Filter by the start time of sleep records, in ISO 8601 format.
  - `endTime` (optional): Filter by the end time of sleep records, in ISO 8601 format.

#### Response

```json
[
  {
    "id": 1,
    "side": "left",
    "entered_bed_at": "2025-02-15T22:00:00Z",
    "left_bed_at": "2025-02-16T06:00:00Z",
    "sleep_period_seconds": 28800,
    "times_exited_bed": 2
  },
  {
    "id": 2,
    "side": "right",
    "entered_bed_at": "2025-02-15T23:00:00Z",
    "left_bed_at": "2025-02-16T07:00:00Z",
    "sleep_period_seconds": 28800,
    "times_exited_bed": 1
  }
]
```

### PUT `/api/metrics/sleep`

- Edits an existing sleep record (e.g., correct a bedtime that was off because of a presence-detection glitch). Body specifies the record id and the fields to overwrite.

### DELETE `/api/metrics/sleep/:id`

- Removes a sleep record. Useful for naps or false detections that should not count.

---

## `/api/metrics/vitals`

### GET

- Retrieves vital records based on optional query parameters.
- Query parameters:
  - `side` (optional): Filter by the side of the bed (e.g., "left" or "right").
  - `startTime` (optional): Filter by the start time of vital records, in ISO 8601 format.
  - `endTime` (optional): Filter by the end time of vital records, in ISO 8601 format.

#### Response

```json
[
  {
    "id": 1,
    "side": "left",
    "timestamp": "2025-02-15T22:00:00Z",
    "heart_rate": 72,
    "breathing_rate": 16,
    "hrv": 42
  },
  {
    "id": 2,
    "side": "right",
    "timestamp": "2025-02-15T23:00:00Z",
    "heart_rate": 74,
    "breathing_rate": 15,
    "hrv": 45
  }
]
```

---

## `/api/metrics/vitals/summary`

### GET

- Retrieves summary statistics for vitals, including heart rate, breathing rate, and HRV (heart rate variability) within an optional time range.
- Query parameters:
  - `side` (optional): Filter by the side of the bed (e.g., "left" or "right").
  - `startTime` (optional): Filter by the start time of records, in ISO 8601 format.
  - `endTime` (optional): Filter by the end time of records, in ISO 8601 format.

#### Response

```json
{
  "avgHeartRate": 72,
  "minHeartRate": 65,
  "maxHeartRate": 80,
  "avgHRV": 52,
  "avgBreathingRate": 17
}
```

---

## `/api/metrics/movement`

### GET

- Per-bucket movement records derived from piezo data. Used to render the "movement" chart and as input to the sleep-stage classifier (high-movement epochs are flagged as `awake`).
- Query parameters: `side`, `startTime`, `endTime` (all optional, ISO 8601).

#### Response

```json
[
  { "id": 1, "side": "left", "timestamp": "2025-02-15T22:05:00Z", "total_movement": 312 },
  { "id": 2, "side": "left", "timestamp": "2025-02-15T22:10:00Z", "total_movement": 87 }
]
```

---

## `/api/metrics/sleep-stages`

### GET

- Per-epoch sleep-stage classification (awake / REM / light / deep) for a side over a time range. Heuristic classifier — no ML — built from the per-5-min `vitals` and `movement` rows. See [biometrics/BIOMETRICS.md](../biometrics/BIOMETRICS.md) for the algorithm.
- Required query parameters: `side`, `startTime`, `endTime`.

#### Response

```json
{
  "epochs": [
    { "startUnix": 1739659200, "endUnix": 1739659500, "stage": "deep" },
    { "startUnix": 1739659500, "endUnix": 1739659800, "stage": "rem" }
  ],
  "totals":      { "awake": 0,    "rem": 5400, "light": 12000, "deep": 5100 },
  "percentages": { "awake": 0,    "rem": 24,   "light": 53,    "deep": 23 },
  "totalSeconds": 22500
}
```

---

## `/api/metrics/sleep-score`

### GET

- Returns an aggregate sleep score for a given sleep period, broken down into component contributions (duration, stage balance, consistency, etc.).
- Query parameters: `side`, `startTime`, `endTime`.

---

## `/api/metrics/server`

### GET

- In-process server metrics, intended for local debugging on the Pod (`curl localhost:3000/api/metrics/server`).

#### Response (shape; values are point-in-time)

```json
{
  "franken": {
    "queueDepth": 0,
    "commandLatencyMs": { "p50": 18, "p95": 47, "count": 8231 },
    "timeouts": 0
  },
  "ws": { "clients": 1 },
  "jobs": { "alarm": { "ok": 4, "failed": 0 }, "temperature": { "ok": 28, "failed": 0 } },
  "process": { "uptimeSeconds": 7521, "rssMb": 93 }
}
```

---

## Partial Updates for POST Requests

The POST endpoints (`/api/deviceStatus`, `/api/settings`, `/api/schedules`) support partial updates. You can send only the fields you wish to modify, and the system merges your input with the existing data.

### Example for `/api/deviceStatus`

#### Request Body

```json
{
  "left": {
    "targetTemperatureF": 88
  }
}
```

---

## `/api/services`

### GET

- Enables or disables certain services and retrieves their health information.

#### Response

```json
{
  "sentryLogging": {
    "enabled": true,
  },
  "biometrics": {
    "enabled": true,
    "jobs": {
      "installation": {
        "name": "Biometrics installation",
        "message": "",
        "status": "healthy",
        "description": "Whether or not biometrics was installed successfully",
        "timestamp": ""
      },
      "stream": {
        "name": "Biometrics stream",
        "message": "",
        "status": "healthy",
        "description": "Consumes the sensor data as a stream and calculates biometrics",
        "timestamp": "2025-11-01T17:14:50.003582+00:00"
      },
      "analyzeSleepLeft": {
        "name": "Analyze sleep - left",
        "message": "IntegrityError('UNIQUE constraint failed: movement.side, movement.timestamp')",
        "status": "failed",
        "description": "Analyzes sleep period",
        "timestamp": "2025-11-01T17:01:27.317609+00:00"
      },
      "analyzeSleepRight": {
        "name": "Analyze sleep - right",
        "message": "",
        "status": "healthy",
        "description": "Analyzes sleep period",
        "timestamp": "2025-10-26T08:04:10.404431+00:00"
      },
      "calibrateLeft": {
        "name": "Calibration job - Left",
        "message": "",
        "status": "healthy",
        "description": "Calculates presence thresholds for cap sensor data",
        "timestamp": "2025-10-30T21:01:18.225128+00:00"
      },
      "calibrateRight": {
        "name": "Calibration job - Right",
        "message": "",
        "status": "healthy",
        "description": "Calculates presence thresholds for cap sensor data",
        "timestamp": "2025-10-30T21:30:44.018862+00:00"
      }
    }
  }
}

```

--- 

## /api/metrics/presence

### GET

- Tracks whether someone is present on the left and/or right side.
Stored in-memory (resets on server restart).
Timestamps are server-generated.

#### Response

```json
{
  "left": {
    "present": false,
    "lastUpdatedAt": "2025-12-18T00:12:34-08:00"
  },
  "right": {
    "present": true,
    "lastUpdatedAt": "2025-12-18T00:12:34-08:00"
  }
}
```

### POST

- Pushed by the Python biometrics service (`biometric_processor.py`) when its presence state flips. Body shape:

```json
{ "left": { "present": true } }
```

The server merges the incoming side into its in-memory state and publishes a presence event on the WS bus.

---

## `/api/logs`

### GET `/api/logs`

- Lists log files available on the device. Reads from `/persistent/free-sleep-data/logs` and `/var/log`. Newest first.

```json
{ "logs": ["free-sleep-stream.log", "free-sleep.log", "sleep-analyzer.log"] }
```

### GET `/api/logs/:filename`

- Streams the named log file to the client as a `text/event-stream` (SSE), tailing as new lines arrive. Used by the in-app log viewer.

---

## `/api/serverStatus`

### GET

- Retrieves the status of the services that make up free sleep.

#### Response

```json
  {
  "alarmSchedule": {
    "name": "Alarm schedule",
    "status": "healthy",
    "description": "",
    "message": ""
  },
  "database": {
    "name": "Database",
    "status": "healthy",
    "description": "Connection to SQLite DB",
    "message": ""
  },
  "express": {
    "name": "Express",
    "status": "healthy",
    "description": "The back-end server",
    "message": ""
  },
  "franken": {
    "name": "Franken sock",
    "status": "started",
    "description": "Socket service for controlling the hardware",
    "message": ""
  },
  "jobs": {
    "name": "Job scheduler",
    "status": "healthy",
    "description": "Scheduling service for temperature changes, alarms, and maintenance",
    "message": ""
  },
  "logger": {
    "name": "Logger",
    "status": "healthy",
    "description": "Logging service",
    "message": ""
  },
  "powerSchedule": {
    "name": "Power schedule",
    "status": "healthy",
    "description": "Power on/off schedule",
    "message": ""
  },
  "primeSchedule": {
    "name": "Prime schedule",
    "status": "healthy",
    "description": "Daily prime job",
    "message": ""
  },
  "rebootSchedule": {
    "name": "Reboot schedule",
    "status": "healthy",
    "description": "Daily system reboots",
    "message": ""
  },
  "systemDate": {
    "name": "System date",
    "status": "healthy",
    "description": "Whether or not the system date is correct. Scheduling jobs depend on this.",
    "message": ""
  },
  "temperatureSchedule": {
    "name": "Temperature schedule",
    "status": "healthy",
    "description": "Temperature adjustment schedule",
    "message": ""
  },
  "biometricsInstallation": {
    "name": "Biometrics installation",
    "message": "",
    "status": "healthy",
    "description": "Whether or not biometrics was installed successfully",
    "timestamp": ""
  },
  "analyzeSleepLeft": {
    "name": "Analyze sleep - left",
    "message": "IntegrityError('UNIQUE constraint failed: movement.side, movement.timestamp')",
    "status": "failed",
    "description": "Analyzes sleep period",
    "timestamp": "2025-11-01T17:01:27.317609+00:00"
  },
  "analyzeSleepRight": {
    "name": "Analyze sleep - right",
    "message": "",
    "status": "healthy",
    "description": "Analyzes sleep period",
    "timestamp": "2025-10-26T08:04:10.404431+00:00"
  },
  "biometricsCalibrationLeft": {
    "name": "Calibration job - Left",
    "message": "",
    "status": "healthy",
    "description": "Calculates presence thresholds for cap sensor data",
    "timestamp": "2025-10-30T21:01:18.225128+00:00"
  },
  "biometricsCalibrationRight": {
    "name": "Calibration job - Right",
    "message": "",
    "status": "healthy",
    "description": "Calculates presence thresholds for cap sensor data",
    "timestamp": "2025-10-30T21:30:44.018862+00:00"
  },
  "biometricsStream": {
    "name": "Biometrics stream",
    "message": "",
    "status": "healthy",
    "description": "Consumes the sensor data as a stream and calculates biometrics",
    "timestamp": "2025-11-01T17:11:50.430377+00:00"
  }
}
```

---

## WebSocket — `/ws/events`

Real-time push channel. Replaces the React app's prior 5-second deviceStatus polling. Connect with a normal browser `WebSocket` — no auth, no library required.

```
ws://<POD_IP>:3000/ws/events
```

### Frame format

Every frame is a JSON envelope:

```json
{ "channel": "device-status", "payload": { /* ... */ }, "ts": 1745704351342 }
```

### Channels

| Channel | When it fires | Payload |
|---|---|---|
| `device-status`  | `FrankenMonitor` diffs the last DeviceStatus snapshot and emits only when something actually changed (temperature, isOn, water level, etc.) | Full `DeviceStatus` object — same shape as `GET /api/deviceStatus` |
| `service-health` | A check in `/api/serverStatus` flips between `healthy` ↔ `failed` | Partial server-status patch — only the fields that changed |
| `job-event`      | A scheduled job starts / succeeds / fails (alarms, temperature changes, prime, analyze-sleep, calibration) | `{ name, status, message?, timestamp }` |
| `presence`       | Biometrics service pushes a presence flip via `POST /api/metrics/presence` | Same shape as `GET /api/metrics/presence` |

### Heartbeat

The server pings every 15 s and drops sockets that miss two pongs. Clients should not need to do anything — the browser handles pong frames automatically.

### Polling fallback

The React app's `eventStream.ts` reconnects with exponential backoff up to 30 s. While disconnected, the existing React Query hooks fall back to their normal 30–60 s HTTP polling so the UI never goes fully stale.

### Adaptive polling on the server

`FrankenMonitor` runs at 2 s intervals while ≥1 WS client is connected, 10 s when idle. Saves dac.sock churn when no one is looking. (Pod 4+ only — Pod 3's slower path was removed.)


