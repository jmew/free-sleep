import CircularProgress from '@mui/material/CircularProgress';
import { useAppStore } from '@state/appStore.tsx';
import { useSleepScore, SleepScoreComponent } from '@api/sleepScore.ts';
import {
  Box,
  Card,
  Typography,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

type SleepScoreCardProps = {
  startTime: string;
  endTime: string;
};

function scoreColor(score: number): string {
  if (score >= 85) return '#22c55e'; // green
  if (score >= 70) return '#84cc16'; // lime
  if (score >= 55) return '#eab308'; // yellow
  if (score >= 40) return '#f97316'; // orange
  return '#ef4444';                  // red
}

function scoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Very poor';
}

const COMPONENT_LABELS: Record<string, string> = {
  duration: 'Duration',
  continuity: 'Continuity',
  hrv: 'HRV',
  restingHr: 'Resting HR',
};

function ComponentRow({ label, c }: { label: string; c: SleepScoreComponent }) {
  const theme = useTheme();
  const color = c.available ? scoreColor(c.score) : theme.palette.grey[600];
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" sx={ { py: 0.5 } }>
      <Typography variant="body2" color={ theme.palette.grey[300] }>
        { label }
      </Typography>
      <Box display="flex" alignItems="center" gap={ 1.5 }>
        <Typography variant="body2" color={ theme.palette.grey[400] }>
          { c.value }
        </Typography>
        <Tooltip title={ c.available ? `${c.score}/100 (weight ${Math.round(c.weight * 100)}%)` : 'No data' }>
          <Box
            sx={ {
              minWidth: 36,
              textAlign: 'right',
              fontWeight: 'bold',
              color,
            } }
          >
            { c.available ? c.score : '—' }
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
}

// eslint-disable-next-line react/no-multi-comp
export default function SleepScoreCard({ startTime, endTime }: SleepScoreCardProps) {
  const { side } = useAppStore();
  const { data: sleepScore, isFetching } = useSleepScore({ side, startTime, endTime });

  return (
    <Card sx={ { p: 2, backgroundColor: 'background.paper', position: 'relative', mt: 2 } }>
      <Typography variant="h6" gutterBottom>
        Sleep score
      </Typography>
      { isFetching && <CircularProgress sx={ { display: 'block', mx: 'auto', my: 2 } } /> }
      { !isFetching && sleepScore !== undefined && (
        <>
          <Box display="flex" alignItems="center" justifyContent="center" gap={ 2 } sx={ { mb: 2 } }>
            <Typography
              sx={ {
                fontSize: 56,
                fontWeight: 'bold',
                color: scoreColor(sleepScore.score),
                lineHeight: 1,
              } }
            >
              { sleepScore.score }
            </Typography>
            <Typography variant="body1" color={ scoreColor(sleepScore.score) }>
              { scoreLabel(sleepScore.score) }
            </Typography>
          </Box>
          <Box>
            { Object.entries(sleepScore.components).map(([key, c]) => (
              <ComponentRow key={ key } label={ COMPONENT_LABELS[key] || key } c={ c }/>
            )) }
          </Box>
        </>
      ) }
    </Card>
  );
}
