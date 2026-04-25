import moment from 'moment-timezone';
import { Box, Typography, Card, CardActionArea } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useNavigate } from 'react-router-dom';

import { useSleepRecords } from '@api/sleep.ts';
import { useSleepScore } from '@api/sleepScore.ts';
import { useAppStore } from '@state/appStore.tsx';
import { glassCard, sectionLabel, heroNumber } from './cardStyles';

function scoreColor(s: number): string {
  if (s >= 85) return '#22c55e';
  if (s >= 70) return '#84cc16';
  if (s >= 55) return '#eab308';
  if (s >= 40) return '#f97316';
  return '#ef4444';
}

function scoreLabel(s: number): string {
  if (s >= 85) return 'Excellent';
  if (s >= 70) return 'Good';
  if (s >= 55) return 'Fair';
  if (s >= 40) return 'Poor';
  return 'Very poor';
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={ { textAlign: 'center', flex: 1 } }>
      <Typography
        sx={ {
          fontSize: '1rem',
          fontWeight: 500,
          color: 'rgba(255,255,255,0.85)',
        } }
      >
        { value }
      </Typography>
      <Typography
        sx={ {
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mt: 0.25,
        } }
      >
        { label }
      </Typography>
    </Box>
  );
}

// eslint-disable-next-line react/no-multi-comp
export default function SleepSummaryCard() {
  const { side } = useAppStore();
  const navigate = useNavigate();
  const startTime = moment().subtract(36, 'hours').toISOString();
  const endTime = moment().toISOString();
  const { data: records } = useSleepRecords({ side, startTime, endTime });
  const last = records?.[records.length - 1];
  const { data: score } = useSleepScore(
    {
      side,
      startTime: last?.entered_bed_at,
      endTime: last?.left_bed_at,
    },
    !!last,
  );

  if (!last || !score) return null;

  const color = scoreColor(score.score);

  return (
    <Card sx={ glassCard } elevation={ 0 }>
      <CardActionArea onClick={ () => navigate('/data/sleep') } sx={ { borderRadius: 2, p: 0 } }>
        <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 } }>
          <Typography sx={ sectionLabel }>Last night</Typography>
          <ChevronRightIcon sx={ { fontSize: 18, color: 'rgba(255,255,255,0.35)' } }/>
        </Box>
        <Box sx={ { display: 'flex', alignItems: 'baseline', gap: 1.5, mb: 2 } }>
          <Typography sx={ { ...heroNumber, color, fontSize: '4.5rem' } }>
            { score.score }
          </Typography>
          <Box>
            <Typography
              sx={ {
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.5)',
              } }
            >
              / 100
            </Typography>
            <Typography sx={ { fontSize: '0.95rem', color, fontWeight: 500 } }>
              { scoreLabel(score.score) }
            </Typography>
          </Box>
        </Box>
        <Box sx={ { display: 'flex', borderTop: '1px solid rgba(255,255,255,0.06)', pt: 2, gap: 1 } }>
          <MiniStat label="Duration" value={ score.components.duration.value }/>
          <MiniStat label="HRV" value={ score.components.hrv.value }/>
          <MiniStat label="Resting HR" value={ score.components.restingHr.value }/>
          <MiniStat label="Exits" value={ String(last.times_exited_bed ?? 0) }/>
        </Box>
      </CardActionArea>
    </Card>
  );
}
