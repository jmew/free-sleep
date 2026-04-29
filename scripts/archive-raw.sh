#!/usr/bin/env bash
# Hardlink RAW piezo files from /persistent/ into a local archive so they
# survive frankenfirmware's rolling-buffer truncation (~75 min).
#
# Background: frankenfirmware (Eight Sleep's proprietary firmware) writes
# one ~6.7 MB RAW file every ~15 min and maintains a fixed-size rolling
# buffer of the most recent N files. After uploading to Eight Sleep's
# cloud (or attempting to — sometimes uploads time out), the firmware
# truncates files older than the buffer window. Net effect: by ~midday,
# the previous night's data is GONE from /persistent/ and the daily
# analyze_sleep job finds nothing.
#
# Hardlinks share inodes — frank's `rm` removes ITS filesystem entry,
# but our entry in the archive folder keeps the inode (the actual data
# bytes) alive until WE delete it. Doesn't break Eight Sleep's cloud
# sync, doesn't double the disk usage (until frank actually deletes,
# the two paths share the same data blocks).
#
# Run this from a systemd timer every minute. With ~15 min between
# new RAW files, a 1-min cadence has plenty of margin.

set -e

ARCHIVE=/persistent/free-sleep-data/raw-archive
RETENTION_HOURS=36

mkdir -p "$ARCHIVE"

linked=0
for src in /persistent/*.RAW; do
  [ -f "$src" ] || continue
  base=$(basename "$src")
  # Skip the firmware's sequencer state file
  [ "$base" = "SEQNO.RAW" ] && continue
  dst="$ARCHIVE/$base"
  [ -e "$dst" ] && continue
  if ln "$src" "$dst" 2>/dev/null; then
    linked=$((linked + 1))
  fi
done

# Prune the archive to keep only the last RETENTION_HOURS of files.
# 36 h × 4 files/h × 6.7 MB ≈ 1 GB max footprint — well under the
# 14 GB free we have on /persistent.
pruned=$(find "$ARCHIVE" -type f -name '*.RAW' -mmin "+$((RETENTION_HOURS * 60))" -print -delete 2>/dev/null | wc -l)

# Quiet on idle, single-line summary on activity (avoids journald spam
# but keeps the timer's output meaningful when something happens).
if [ "$linked" -gt 0 ] || [ "$pruned" -gt 0 ]; then
  echo "archive-raw: linked=$linked pruned=$pruned (retention=${RETENTION_HOURS}h)"
fi
