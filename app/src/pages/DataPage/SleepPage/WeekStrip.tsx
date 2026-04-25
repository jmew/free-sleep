import { Box, Typography } from '@mui/material';
import moment from 'moment-timezone';

import { useAppStore } from '@state/appStore.tsx';
import { useSleepRecords } from '@api/sleep.ts';
import { useSleepScore } from '@api/sleepScore.ts';
import { SleepRecord } from '../../../../../server/src/db/sleepRecordsSchema.ts';

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // Mon-first like the official app

function scoreColor(score?: number): string {
  if (score === undefined) return 'rgba(255,255,255,0.18)'; // grey for no data
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#84cc16';
  if (score >= 55) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function findRecordForDay(
  records: SleepRecord[] | undefined,
  day: moment.Moment,
): SleepRecord | undefined {
  if (!records) return undefined;
  // A "night" belongs to the day it ENDED on (e.g., night of Mon→Tue counts as Tuesday).
  // Match by left_bed_at falling within that day.
  return records.find((r) => moment(r.left_bed_at).isSame(day, 'day'));
}

type DayDotProps = {
  day: moment.Moment;
  letter: string;
  isActive: boolean;
  isFuture: boolean;
  record?: SleepRecord;
  onClick: () => void;
};

function DayDot({ day, letter, isActive, isFuture, record, onClick }: DayDotProps) {
  const { side } = useAppStore();
  const { data: score } = useSleepScore(
    {
      side,
      startTime: record?.entered_bed_at,
      endTime: record?.left_bed_at,
    },
    !!record,
  );
  const color = scoreColor(score?.score);
  const hasData = !!record && !!score;
  const isToday = day.isSame(moment(), 'day');

  return (
    <Box
      onClick={ isFuture ? undefined : onClick }
      sx={ {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
        cursor: isFuture ? 'default' : 'pointer',
        py: 0.75,
        borderRadius: 4,
        backgroundColor: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
        opacity: isFuture ? 0.35 : 1,
        transition: 'background-color 0.2s ease',
      } }
    >
      <Typography
        sx={ {
          fontSize: '0.85rem',
          fontWeight: isToday ? 600 : 400,
          color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
        } }
      >
        { letter }
      </Typography>
      { hasData ? (
        <Box
          sx={ {
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}80`,
          } }
        />
      ) : (
        <Typography sx={ { fontSize: '0.85rem', color: 'rgba(255,255,255,0.25)', lineHeight: '8px' } }>
          —
        </Typography>
      ) }
    </Box>
  );
}

type WeekStripProps = {
  selectedDate: moment.Moment;     // anchor of the week to show (any day in the week)
  selectedRecord?: SleepRecord;    // currently-selected sleep record for highlighting
  onSelectDay: (day: moment.Moment, record: SleepRecord | undefined) => void;
};

// eslint-disable-next-line react/no-multi-comp
export default function WeekStrip({ selectedDate, selectedRecord, onSelectDay }: WeekStripProps) {
  const { side } = useAppStore();

  // Mon-first week containing selectedDate.
  const weekStart = selectedDate.clone().startOf('isoWeek');
  const weekEnd = weekStart.clone().add(7, 'days');

  const { data: weekRecords } = useSleepRecords({
    side,
    startTime: weekStart.toISOString(),
    endTime: weekEnd.toISOString(),
  });

  const today = moment();
  const days = Array.from({ length: 7 }).map((_, i) => weekStart.clone().add(i, 'day'));
  const activeDay = selectedRecord
    ? moment(selectedRecord.left_bed_at)
    : selectedDate;

  return (
    <Box sx={ { width: '100%', display: 'flex', gap: 0.5, px: 0.5 } }>
      { days.map((day, i) => {
        const record = findRecordForDay(weekRecords, day);
        const isActive = day.isSame(activeDay, 'day');
        const isFuture = day.isAfter(today, 'day');
        return (
          <DayDot
            key={ i }
            day={ day }
            letter={ DAY_LETTERS[i] }
            isActive={ isActive }
            isFuture={ isFuture }
            record={ record }
            onClick={ () => onSelectDay(day, record) }
          />
        );
      }) }
    </Box>
  );
}
