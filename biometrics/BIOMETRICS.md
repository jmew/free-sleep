# Biometrics

## Stream Processor - Calculates vitals (`stream/`)

- `stream.py`: Monitors the latest `.RAW` file and continuously processes biometric data.
- `stream_processor.py`: Buffers piezoelectric sensor data for presence detection and biometric calculations.
- `biometric_processor.py`: Processes real-time piezo data to extract heart rate, HRV, and breathing rate.

## Sleep Detection (`sleep_detection/`)

- `calibrate_sensor_thresholds.py`: Establishes a baseline for capacitance sensors.
- `analyze_sleep.py`: Processes raw data and detects sleep intervals.
- `cap_data.py`: Loads and processes capacitance sensor data to detect presence.
- `sleep_detector.py`: Merges piezo and capacitance presence data to determine sleep sessions.

## Vital Signs Calculation (`vitals/`)

- `calculate_vitals.py`: Loads piezo data, estimates heart rate, HRV, and breathing rate.
- `calculations.py`: Implements signal processing, filtering, and biometric estimation.
- `run_data.py`: Manages runtime parameters for sliding window calculations.

## Database Management (`db.py`)

- Handles SQLite database operations for storing sleep records and vitals.
- Uses `sqlite3` with a persistent connection and WAL mode for performance.
- Provides functions for inserting vitals and sleep records while avoiding duplicates.

## Raw Data Handling (`load_raw_files.py`)

- Loads `.RAW` files from the pod, decodes CBOR-encoded data, and extracts piezo and capacitance sensor readings.
- Filters data based on timestamps and sensor types.
- Implements memory optimization techniques such as garbage collection.

## Data Types (`data_types.py`)

- Defines structured data models (`TypedDict`) for various biometric readings.
- Includes schemas for heart rate, HRV, breathing rate, and sensor readings.

## Piezo Data Processing (`piezo_data.py`)

- Loads and processes piezo sensor data for biometric calculations.
- Detects presence using a rolling window method based on sensor range thresholds.
- Identifies baseline periods for calibrating the system.

## Data Sources

- There's 2 main sensors used to measure biometrics, they're both available in /persistent/*.RAW files
- This data is only available if the Pod cannot access the internet. You can block internet access to the pod by setting
  up firewall rules
- The raw files are encoded in cbor & can be loaded with `load_raw_files.py`

### 1. Capacitance sensor data

- This measures pressure in 1 second intervals. There's 3 sensors for each side

- Sample:

```json
{
  "type": "capSense",
  "ts": "2025-01-10 11:00:22",
  "left": {
    "out": 387,
    "cen": 381,
    "in": 505,
    "status": "good"
  },
  "right": {
    "out": 1076,
    "cen": 1075,
    "in": 1074,
    "status": "good"
  },
  "seq": 1610679
}
```

### 2. Piezo sensor data

- Measures pressure ~500× per second.
- Sensor count per side varies by hardware:
  - **Pod 3**: 2 piezos per side (head + foot). Records contain `left1`, `left2`, `right1`, `right2`.
  - **Pod 4 / Pod 5 / Pod 8**: 1 piezo per side. Records contain only `left1` and `right1`.
- `StreamProcessor` auto-detects which case it's in: `sensor_count = 2 if 'left2' in piezo_record else 1`. The dual-piezo presence-detection code (`max(range(signal1), range(signal2))`) is a no-op on single-piezo hardware.

```json
{
  "adc": 1,
  "freq": 500,
  "gain": 400,
  "left1": [
    -163532,
    -161494
    //  ...500 more
  ],
  "left2": [
    -59995,
    -63199
    //  ...500 more
  ],
  "right1": [
    81464,
    80593
    //  ...500 more
  ],
  "right2": [
    722955,
    723792
    //  ...500 more
  ],
  "seq": 1610681,
  "ts": "2025-01-10 11:00:22",
  "type": "piezo-dual"
}
```

---

## Presence detection notes

`biometric_processor.detect_presence()` decides per-second whether someone is on a given side:

1. Compute the percentile-based range (p98 − p2) of each piezo signal, then take the max of available piezos.
2. Cross-side `_PresenceCoordinator` arbitrates between left and right based on a dominance ratio (1.3×) and a noise floor (100,000) so mechanical transmission through the mattress doesn't read as occupancy on the empty side.
3. Hysteresis: 3 consecutive "elevated" readings flip presence to true; **180 seconds** of "not elevated" before flipping back to false. The long timeout exists because piezos are AC-coupled — a perfectly still sleeper produces only tiny breathing-amplitude signal that can fall below threshold for a minute or more.
4. On reset (the 180s timeout firing), all rolling buffers are wiped via `init_tracking()`. After re-detection, vitals only resume once `present_for > heart_rate_window_seconds` again.

Tunable in `biometric_processor.py`:
- `no_presence_tolerance` (line ~179): 180s default.
- noise floor + dominance ratio in `_PresenceCoordinator`.

If a deep sleeper shows up with multi-hour vitals gaps on the chart, the typical cause is repeated sub-threshold stillness re-triggering the timeout. Increase tolerance or lower the noise floor for that user.




