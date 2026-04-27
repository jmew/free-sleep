# Free Sleep — Local Control for 8 Sleep Pods

## 👀 [Demo App](https://free-sleep.vercel.app/)

## 💬 [Discord Server](https://discord.gg/JpArXnBgEj)
- Support
- Feature requests
- Updates
- Contributing

## [🤖 Custom ChatGPT Support Bot](https://chatgpt.com/g/g-68fb217791dc8191b82d2d0ae7b29940-free-sleep-bot)

- A custom ChatGPT with Free Sleep documentation and related resources. It can help troubleshoot installations, answer setup questions, and guide you through common issues.

---

## 🛠️ [Installation Instructions](./INSTALLATION.md) 🛠

--- 

## Overview
Free Sleep is an open-source project that lets you control your Eight Sleep Pod locally — without relying on the cloud or the official app.
Each Pod actually runs a small Linux computer inside it. Free Sleep installs a lightweight server on that computer, giving you full local control.
- **Server**: Runs directly on the Pod and talks to its hardware using custom APIs.
- **App**: A simple, user-friendly web interface for changing temperatures, schedules, alarms, and settings. See [app demo here](https://free-sleep.vercel.app/)

## Compatability
- Pod 1 - ❌ **NOT COMPATIBLE**
- Pod 2 - ❌ **NOT COMPATIBLE**
- Pod 3 - **(With SD card)** - ✅
- Pod 3 - **(No SD card)** - ✅ FCC ID: 2AYXT61100001 (The FCC ID is located in the back of the pod where you plug in the water tubes)
- Pod 4 ✅
- Pod 5 ✅

---  
![App](docs/app.gif)

---
## FAQ
### Is it reversible?
Yes, you can easily firmware reset the pod and go back to the official 8 Sleep App

### Will I brick my pod?
Pod 3 **without** the SD card, Pod 4, and Pod 5 are impossible to brick - _as long as you follow the directions_ 

### Will it void my warranty?
Free Sleep is not officially supported by 8 Sleep, so there’s always a chance it could affect your warranty.
That said, you can fully reset the firmware and return the Pod to its original state at any time, and there’s no permanent modification made to the hardware.


## Features
- Allows complete control of device WITHOUT requiring internet access. If you lose internet, your pod WILL NOT turn off, it will continue working! You can completely block WAN internet access if you'd like too. (I blocked all internet access from my pod on my router...)
- WARNING: This will bypass blocked devices, please use responsibly
- Dynamic temperature control with real-time updates
- Schedule management: 
  - Set power on/off times 
  - Schedule temperature adjustments
  - Schedule daily time to prime the pod
  - Alarms - If you turn off the Pod prior to the alarm running, then the alarm will not run
- Settings customization: Configure timezones, away mode, brightness of LED on pod
- Website works on desktop and mobile
- Optional remote access from outside your home network via [Tailscale](https://tailscale.com) — encrypted, no public exposure of the pod, free for personal use. See [INSTALLATION.md step 20](INSTALLATION.md) for setup.


### Biometrics 📈
- **The only biometrics data that has been validated is heart rate**, HRV & breathing rates have not been validated & may be inaccurate.
Heart rates were validated over 33 sleep periods from 3 males & 3 females against mostly Apple Watches. 
**Heart rate calculations tend to be slightly less accurate for females**
- Summary statistics for all 33 periods:
  - RMSE - 2.88 average, 1.45 min, 7.63 max 
  - Correlation - 80.8% average, 27% min, 95% max
  - MAE - 1.83 average, 1 min, 5.77 max
- How to enable:
  - `sh /home/dac/free-sleep/scripts/enable_biometrics.sh`
- How to disable:
  - `sh /home/dac/free-sleep/scripts/disable_biometrics.sh`

#### Biometrics Overview

All biometric and sleep data is inserted into SQLite @ `/persistent/free-sleep-data/free-sleep.db`.

1. Vitals (Heart rate, breath rate, HRV) `biometrics/stream/stream.py` - This runs 24/7 and calculates vitals when it detects presence.
Vitals are inserted once every 60 seconds & you can access the raw data @ <POD_IP>/api/metrics/vitals


---
## Technical details

### **Server**
- REST API for managing device settings, schedules, and status.
- Modular design with routes for `deviceStatus`, `settings`, `schedules`, and `execute`.
- Uses Node.js and Express for lightweight, fast operations.
- WebSocket push at `/ws/events` for real-time UI updates — temperature
  changes, scheduled jobs, and service-health flips arrive instantly without
  the app polling. Falls back to polling automatically if the socket drops.
- Per-command timeouts on the dac.sock pipe so a hung pod doesn't stall
  the rest of the server (5s default; tunable via `FRANKEN_COMMAND_TIMEOUT_MS`).
- `/api/metrics/server` exposes Franken queue depth, p50/p95 command latency,
  timeout counts, and WS client count for debugging.

---

## Tech Stack
- **Server**: Node.js, Express, TypeScript.
- **App**: React, Material-UI, Zustand, React Query.
- **Database**: LowDB for simple JSON-based storage.

## Contributing
- Read [contributing docs](CONTRIBUTING.md) 

### Developing
- [front-end](app/README_APP.md)
- [back-end](server/README_SERVER.md)

### Deploying changes to a Pod (`scripts/deploy-dev.sh`)

For iterating on this fork against a real Pod over SSH. Builds locally, then scp's only the build artifacts whose source actually changed.

**Setup (one-time):**
- The Pod's address is hardcoded as `root@192.168.4.181:8822`. Override per-shell with env vars: `POD_HOST=…  POD_PORT=… POD_USER=… ./scripts/deploy-dev.sh`.
- SSH key auth must work from your shell (the script uses `IdentitiesOnly=yes`). If you get a password prompt, set up `~/.ssh/config` for the Pod.

**Usage:**

```bash
./scripts/deploy-dev.sh             # build (both) + scp changed files + restart
./scripts/deploy-dev.sh --frontend  # only the React app
./scripts/deploy-dev.sh --backend   # only the Express server
./scripts/deploy-dev.sh --full      # ignore the change marker; push every file in dist/public
./scripts/deploy-dev.sh --no-build  # skip build (use the dist/public you already have)
./scripts/deploy-dev.sh --logs      # tail journalctl -u free-sleep on the Pod
```

**How it figures out what to send:**

1. Builds locally first (`vite build` → `server/public/`, `tsc` → `server/dist/`). If a build fails, the Pod is never touched.
2. Looks at `.deploy-state/last-sha` (the git SHA of the last successful deploy) and runs `git diff $LAST_SHA HEAD` + `git status --porcelain` to find changed source files.
3. Maps source → built artifact:
   - `server/src/X.ts` → `server/dist/X.js`
   - Any change under `app/src/`, `app/public/`, or `app/index.html` → re-pushes the Vite bundle (`index.{html,js,css}`, `manifest.json`)
4. scp's each file individually, retrying once on failure.
5. `systemctl restart free-sleep` and confirms it's `active`.
6. Updates the marker only if everything succeeded — so a failed deploy will re-attempt the same files next run.

**Gotchas:**
- **Sourcemaps (`*.js.map`) are intentionally skipped** — Google `gnubby-scp` chokes on the larger ones (`server/public/index.js.map` is 8MB+) and they're only used for stack-trace decoding, not runtime.
- **First run pushes everything** (no marker yet) — ~225 files. After that, deploys are tiny.
- **File deletions aren't propagated.** If you delete a `server/src/foo.ts`, the corresponding `server/dist/foo.js` stays on the Pod. Run `--full` (or SSH and clean up) when this matters.
- **Backend changes require a service restart**; frontend changes technically just need a browser reload, but the script restarts on both for consistency.
- **Marker is per-checkout** (`.deploy-state/` is gitignored). Switching machines or worktrees → the next deploy will be a full push.

**Releasing to other users:** this script is for *your* iteration loop. To publish a release that everyone else's `fs-update` will pull, commit `server/dist/` and `server/public/` and push to the GitHub branch that `scripts/install.sh` and `scripts/update.sh` reference.


---

## Support

If you find this project helpful and would like to support its continued development, you can send a tip to my Bitcoin address or PayPal

- [PayPal](https://paypal.me/realfreesleep)
- BTC Address: `bc1qjapkufh65gs68v2mkvrzq2ney3vnvv87jdxxg6`

Thank you for your support!


---
## Supporters

### Sentry.io 
Sentry
has generously sponsored error monitoring for the Free Sleep open-source project.
Their support helps us maintain a more reliable experience for users by 
enabling real-time visibility into issues and performance data — thank you, Sentry, 
for supporting open-source innovation!

---

## License
This project is licensed under the MIT License. See the `LICENSE.md` file for details.

---

## Acknowledgments
- Huge thanks to [@bobobo1618](https://github.com/bobobo1618) & their research on how the device is controlled via dac.sock


---

## App screenshots
![Device on](docs/on.PNG)
![Device off](docs/off.PNG)
![Scheduled temperature adjustments](docs/schedules.PNG)
![Alarms](docs/alarm.PNG)
![Health status](docs/health_status.PNG)
![Settings](docs/settings.PNG)
![Biometrics - 1](docs/sleep_data.PNG)
![Biometrics - 2](docs/metrics.PNG)
![Biometrics - 3](docs/movement.PNG)
![Settings](docs/settings.PNG)
![Settings](docs/settings_2.PNG)
![Support](docs/support.PNG)


