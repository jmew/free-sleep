import moment from 'moment-timezone';
import { Chip, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import BedIcon from '@mui/icons-material/Bed';

import { useAppStore } from '@state/appStore.tsx';
import { useSleepRecords } from '@api/sleep.ts';
import { useSleepScore } from '@api/sleepScore.ts';

function scoreColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#84cc16';
  if (score >= 55) return '#eab308';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

export default function LastNightChip() {
  const { side } = useAppStore();
  const navigate = useNavigate();

  // Fetch the most recent sleep record from the last 36 hours.
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

  return (
    <Box display="flex" justifyContent="center" sx={ { width: '100%' } }>
      <Chip
        icon={ <BedIcon sx={ { color: `${scoreColor(score.score)} !important`, fontSize: 18 } }/> }
        label={ `Last night · ${score.score}` }
        clickable
        onClick={ () => navigate('/data/sleep') }
        sx={ {
          backgroundColor: 'rgba(255,255,255,0.04)',
          border: `1px solid ${scoreColor(score.score)}40`,
          color: scoreColor(score.score),
          fontWeight: 600,
          '& .MuiChip-icon': { color: scoreColor(score.score) },
        } }
      />
    </Box>
  );
}
