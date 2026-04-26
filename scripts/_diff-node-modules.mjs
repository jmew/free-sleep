#!/usr/bin/env node
// Diff two npm package-lock.json files and emit lines describing how to make
// the second match the first. Output is consumed by deploy-dev.sh.
//
// Lines:
//   ADD <relative-path>   — copy local server/<path> to the pod
//   DEL <relative-path>   — rm -rf on the pod
//
// "ADD" covers both new packages and version changes (treated identically —
// re-ship the dir). Paths are relative to server/, e.g. "node_modules/ws"
// or "node_modules/@types/ws".
//
// Usage:
//   node scripts/_diff-node-modules.mjs <local-lock> <pod-lock>

import fs from 'node:fs';

const [localPath, podPath] = process.argv.slice(2);
if (!localPath || !podPath) {
  console.error('Usage: node _diff-node-modules.mjs <local-lock> <pod-lock>');
  process.exit(2);
}

function loadLock(p) {
  if (!fs.existsSync(p)) return { packages: {} };
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw) return { packages: {} };
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Failed to parse ${p}: ${err.message}`);
    process.exit(2);
  }
}

const local = loadLock(localPath);
const pod = loadLock(podPath);

// lockfile v3: `packages` is keyed by path. The empty key "" is the root pkg
// and we ignore it — only `node_modules/...` entries matter for sync.
function pkgEntries(lock) {
  const out = {};
  for (const [k, v] of Object.entries(lock.packages || {})) {
    if (!k.startsWith('node_modules/')) continue;
    // Skip dev-only entries — we only ship runtime deps to the pod.
    if (v?.dev === true || v?.devOptional === true) continue;
    out[k] = v;
  }
  return out;
}

const localPkgs = pkgEntries(local);
const podPkgs = pkgEntries(pod);

const allKeys = new Set([...Object.keys(localPkgs), ...Object.keys(podPkgs)]);
const sorted = [...allKeys].sort();

for (const key of sorted) {
  const l = localPkgs[key];
  const p = podPkgs[key];
  if (l && !p) {
    console.log(`ADD ${key}`);
  } else if (!l && p) {
    console.log(`DEL ${key}`);
  } else if (l?.version !== p?.version) {
    // Version drift — re-ship.
    console.log(`ADD ${key}`);
  }
}
