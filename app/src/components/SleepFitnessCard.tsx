import { useEffect, useMemo, useState } from 'react';
import moment from 'moment-timezone';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { SleepRecord } from '../../../server/src/db/sleepRecordsSchema.ts';
import { useAppStore } from '@state/appStore.tsx';
import { useSleepScore } from '@api/sleepScore.ts';
import { useSleepStages } from '@api/sleepStages.ts';
import { deleteSleepRecord, updateSleepRecord } from '@api/sleep.ts';
import GlassCard from '@design/GlassCard';
import { palette, typography } from '@design/tokens';

type Props = {
  sleepRecord: SleepRecord;
  refetch?: () => void;
};

function scoreColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#84cc16';
  if (score >= 55) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function formatTime(iso: string): string {
  return moment(iso).local().format('h:mma').toLowerCase();
}

function formatDuration(start: string, end: string): string {
  const d = moment.duration(moment(end).diff(moment(start)));
  return `${Math.floor(d.asHours())}h ${d.minutes()}m`;
}

function formatHM(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

// Half-circle gauge built from many thin radial ticks, mimicking the 8 Sleep
// "Sleep fitness score" dial. The arc itself is decorative — every tick is
// drawn uniformly in the score color, and the numeric score sits cleanly
// inside the half-disc.
function ArcGauge({ score, color }: { score: number; color: string }) {
  const TICKS = 90;
  // Geometric semicircle (NOT a squashed ellipse): arc height equals its
  // radius. The SVG is sized by an explicit pixel height so the card stays
  // ~the same total height as before; the natural 2:1 semicircle aspect
  // ratio is preserved by allowing the SVG width to scale with that height.
  const outerR = 80;
  const innerR = 70;
  const PAD_X = 16;
  const PAD_TOP = 6;
  const PAD_BOT = 6;
  const VB_W = outerR * 2 + PAD_X * 2;
  const VB_H = outerR + PAD_TOP + PAD_BOT;
  const cx = VB_W / 2;
  const cy = VB_H - PAD_BOT; // bottom-center of the semicircle
  // Score text uses the default alphabetic baseline; for digits with no
  // descenders the baseline IS the visible bottom, so setting y = cy makes
  // the text bottom align flush with the arc's leg endpoints.

  return (
    <Box sx={ { display: 'flex', justifyContent: 'center', width: '100%' } }>
      <svg
        viewBox={ `0 0 ${VB_W} ${VB_H}` }
        // height capped so the rendered card stays compact; width follows
        // the viewBox aspect (so the arc remains a true circle, not stretched).
        style={ { display: 'block', height: 160, width: 'auto', maxWidth: '100%' } }
      >
        { Array.from({ length: TICKS }).map((_, i) => {
          const angle = 180 - (i / (TICKS - 1)) * 180;
          const rad = (angle * Math.PI) / 180;
          const x1 = cx + innerR * Math.cos(rad);
          const y1 = cy - innerR * Math.sin(rad);
          const x2 = cx + outerR * Math.cos(rad);
          const y2 = cy - outerR * Math.sin(rad);
          return (
            <line
              key={ i }
              x1={ x1 } y1={ y1 } x2={ x2 } y2={ y2 }
              stroke={ color }
              strokeOpacity={ 0.85 }
              strokeWidth={ 0.9 }
              strokeLinecap="round"
            />
          );
        }) }
        <text
          x={ cx } y={ cy }
          fill={ palette.text.primary }
          fontSize={ 44 }
          fontWeight={ 300 }
          textAnchor="middle"
          fontFamily="inherit"
          style={ { letterSpacing: '-0.03em' } }
        >
          { score }
        </text>
      </svg>
    </Box>
  );
}

function StatCol({ label, value, dotColor }: { label: string; value: string; dotColor?: string }) {
  return (
    <Box sx={ { minWidth: 0, textAlign: 'center' } }>
      <Typography
        sx={ { fontSize: '0.85rem', color: palette.text.secondary, mb: 0.5 } }
      >
        { label }
      </Typography>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 } }>
        <Typography
          sx={ {
            fontSize: '0.95rem',
            fontWeight: 500,
            color: palette.text.primary,
            fontVariantNumeric: 'tabular-nums',
          } }
        >
          { value }
        </Typography>
        { dotColor && (
          <Box sx={ { width: 5, height: 5, borderRadius: '50%', backgroundColor: dotColor } }/>
        ) }
      </Box>
    </Box>
  );
}

export default function SleepFitnessCard({ sleepRecord, refetch }: Props) {
  const { side } = useAppStore();
  const { data: sleepScore, isFetching } = useSleepScore({
    side,
    startTime: sleepRecord.entered_bed_at,
    endTime: sleepRecord.left_bed_at,
  });
  // Pull stages so we can show the actual sleep window (onset → offset),
  // not the bed-entry / bed-exit window. The previous version showed
  // "Bedtime 9:46pm / Wake time 9:50am / Duration 12h 4m" for a night
  // where the user was actually asleep from 11:32pm → 8:47am — the
  // SleepConsistencyCard right below it shows the correct window, so
  // the two cards visibly disagreed.
  const { data: stagesData } = useSleepStages({
    side,
    startTime: sleepRecord.entered_bed_at,
    endTime: sleepRecord.left_bed_at,
  });

  const detectedSleepWindow = useMemo(() => {
    if (!stagesData || stagesData.epochs.length === 0) return null;
    const firstSleep = stagesData.epochs.find((e) => e.stage !== 'awake');
    let lastSleep: typeof stagesData.epochs[number] | undefined;
    for (let i = stagesData.epochs.length - 1; i >= 0; i--) {
      if (stagesData.epochs[i].stage !== 'awake') {
        lastSleep = stagesData.epochs[i];
        break;
      }
    }
    if (!firstSleep || !lastSleep) return null;
    const sleptSeconds = Math.max(0, stagesData.totalSeconds - (stagesData.totals.awake || 0));
    return {
      onsetIso: moment.unix(firstSleep.startUnix).toISOString(),
      offsetIso: moment.unix(lastSleep.endUnix).toISOString(),
      sleptSeconds,
    };
  }, [stagesData]);

  const [editOpen, setEditOpen] = useState(false);
  const [enteredBedAt, setEnteredBedAt] = useState(moment(sleepRecord.entered_bed_at));
  const [leftBedAt, setLeftBedAt] = useState(moment(sleepRecord.left_bed_at));

  useEffect(() => {
    setEnteredBedAt(moment(sleepRecord.entered_bed_at));
    setLeftBedAt(moment(sleepRecord.left_bed_at));
  }, [sleepRecord]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this sleep record?')) {
      try {
        await deleteSleepRecord(sleepRecord.id);
        refetch?.();
      } catch (error) {
        console.error('Error deleting sleep record:', error);
        alert('Failed to delete the sleep record.');
      }
    }
  };

  const handleSave = async () => {
    try {
      await updateSleepRecord(sleepRecord.id, {
        entered_bed_at: enteredBedAt.toISOString(),
        left_bed_at: leftBedAt.toISOString(),
      });
      setEditOpen(false);
      refetch?.();
    } catch (error) {
      console.error('Error updating sleep record:', error);
      alert('Failed to update the sleep record.');
    }
  };

  const score = sleepScore?.score ?? 0;
  const color = scoreColor(score);
  const continuity = sleepScore?.components.continuity;
  const duration = sleepScore?.components.duration;

  return (
    <GlassCard sx={ { position: 'relative', pt: 3, pb: 2.5 } }>
      <Box sx={ { position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.25 } }>
        <IconButton size="small" onClick={ () => setEditOpen(true) } aria-label="edit">
          <EditIcon fontSize="small" sx={ { color: palette.text.tertiary } } />
        </IconButton>
        <IconButton size="small" onClick={ handleDelete } aria-label="delete">
          <DeleteIcon fontSize="small" sx={ { color: palette.text.tertiary } } />
        </IconButton>
      </Box>

      <Typography
        sx={ {
          ...typography.sectionLabel,
          color: palette.text.tertiary,
          textAlign: 'center',
          mb: 1,
        } }
      >
        SLEEP FITNESS SCORE
      </Typography>

      { isFetching && <CircularProgress sx={ { display: 'block', mx: 'auto', my: 4 } } /> }

      { !isFetching && sleepScore && (
        <>
          <ArcGauge score={ score } color={ color }/>

          <Box
            sx={ {
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 1,
              mt: 1,
              borderTop: `1px solid ${palette.border.subtle}`,
              pt: 2,
            } }
          >
            <StatCol
              label="Continuity"
              value={ continuity?.available ? `${continuity.score}%` : '—' }
              dotColor={ continuity?.available ? scoreColor(continuity.score) : undefined }
            />
            <StatCol
              label="Duration"
              value={
                detectedSleepWindow
                  ? formatHM(detectedSleepWindow.sleptSeconds)
                  : formatDuration(sleepRecord.entered_bed_at, sleepRecord.left_bed_at)
              }
              dotColor={ duration?.available ? scoreColor(duration.score) : undefined }
            />
            <StatCol
              label="Bedtime"
              value={ formatTime(detectedSleepWindow?.onsetIso ?? sleepRecord.entered_bed_at) }
            />
            <StatCol
              label="Wake time"
              value={ formatTime(detectedSleepWindow?.offsetIso ?? sleepRecord.left_bed_at) }
            />
          </Box>
        </>
      ) }

      <Dialog open={ editOpen } onClose={ () => setEditOpen(false) } fullWidth>
        <DialogTitle>Edit Sleep Record</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={ 2 } mt={ 1 }>
            <DateTimePicker
              label="Entered Bed At"
              value={ enteredBedAt }
              onChange={ (newValue) => newValue && setEnteredBedAt(newValue) }
              ampm
            />
            <DateTimePicker
              label="Left Bed At"
              value={ leftBedAt }
              onChange={ (newValue) => newValue && setLeftBedAt(newValue) }
              ampm
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={ () => setEditOpen(false) } color="secondary">Cancel</Button>
          <Button onClick={ handleSave } variant="contained" color="primary">Save</Button>
        </DialogActions>
      </Dialog>
    </GlassCard>
  );
}
