import moment from 'moment-timezone';
import { Box, Typography, Card } from '@mui/material';

import { useAppStore } from '@state/appStore.tsx';
import { useSleepRecords } from '@api/sleep.ts';

const TARGET_HOURS_PER_NIGHT = 8;
const WINDOW_DAYS = 7;

const SURPLUS_COLOR = '#22c55e';   // green
const DEBT_COLOR    = '#ec4899';   // pink — matches the screenshot

const sectionLabel = {
  fontSize: '0.7rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.45)',
  mb: 1,
};

const glassCard = {
  width: '100%',
  borderRadius: 4,
  p: 2.5,
  background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
  border: '1px solid rgba(255,255,255,0.06)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 24px -12px rgba(0,0,0,0.5)',
};

function formatHM(seconds: number): string {
  const sign = seconds < 0 ? '-' : '';
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return `${sign}${h}h ${m}m`;
}

export default function SleepBalanceCard() {
  const { side } = useAppStore();
  const startTime = moment().subtract(WINDOW_DAYS, 'days').toISOString();
  const endTime = moment().toISOString();
  const { data: records } = useSleepRecords({ side, startTime, endTime });

  if (!records || records.length === 0) return null;

  const targetSeconds = TARGET_HOURS_PER_NIGHT * 3600 * WINDOW_DAYS;
  const actualSeconds = records.reduce((acc, r) => acc + (r.sleep_period_seconds ?? 0), 0);
  const balanceSeconds = actualSeconds - targetSeconds;
  const isSurplus = balanceSeconds >= 0;
  const color = isSurplus ? SURPLUS_COLOR : DEBT_COLOR;

  // Slider position: -100% (max debt) ↔ +100% (max surplus). Cap at ±15h for the visual.
  const visualMaxSec = 15 * 3600;
  const ratio = Math.max(-1, Math.min(1, balanceSeconds / visualMaxSec));
  const positionPct = 50 + ratio * 50; // 0..100, with 50 = balanced

  return (
    <Card sx={ glassCard } elevation={ 0 }>
      <Typography sx={ sectionLabel }>Sleep balance</Typography>
      <Box sx={ { display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 0.5 } }>
        <Typography
          sx={ {
            fontSize: '2.5rem',
            fontWeight: 200,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: 'rgba(255,255,255,0.95)',
          } }
        >
          { formatHM(balanceSeconds) }
        </Typography>
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5 } }>
          <Typography sx={ { fontSize: '0.95rem', color } }>
            { isSurplus ? 'In surplus' : 'In debt' }
          </Typography>
          <Box sx={ { width: 6, height: 6, borderRadius: '50%', backgroundColor: color } }/>
        </Box>
      </Box>

      { /* Horizontal balance bar */ }
      <Box
        sx={ {
          mt: 2,
          position: 'relative',
          height: 6,
          borderRadius: 3,
          backgroundColor: 'rgba(255,255,255,0.08)',
          overflow: 'visible',
        } }
      >
        { /* Center marker */ }
        <Box
          sx={ {
            position: 'absolute',
            left: '50%',
            top: -2,
            bottom: -2,
            width: 1.5,
            backgroundColor: 'rgba(255,255,255,0.25)',
            transform: 'translateX(-50%)',
          } }
        />
        { /* Filled segment from 50% to position */ }
        <Box
          sx={ {
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: isSurplus ? '50%' : `${positionPct}%`,
            width: isSurplus ? `${positionPct - 50}%` : `${50 - positionPct}%`,
            backgroundColor: color,
            borderRadius: 3,
          } }
        />
      </Box>

      <Box sx={ { display: 'flex', justifyContent: 'space-between', mt: 1 } }>
        <Typography sx={ { fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' } }>Less sleep</Typography>
        <Typography sx={ { fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' } }>More sleep</Typography>
      </Box>

      <Box sx={ { display: 'flex', justifyContent: 'center', gap: 2, mt: 1.5 } }>
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5 } }>
          <Box sx={ { width: 8, height: 8, borderRadius: 1, backgroundColor: DEBT_COLOR } }/>
          <Typography sx={ { fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' } }>Debt</Typography>
        </Box>
        <Box sx={ { display: 'flex', alignItems: 'center', gap: 0.5 } }>
          <Box sx={ { width: 8, height: 8, borderRadius: 1, backgroundColor: SURPLUS_COLOR } }/>
          <Typography sx={ { fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' } }>Surplus</Typography>
        </Box>
      </Box>
    </Card>
  );
}
