import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import moment from 'moment-timezone';
import { ServerStatusKey, StatusInfo } from '@api/serverStatusSchema.ts';
import { Box, Button, Typography } from '@mui/material';

import StatusChip from './StatusChip.tsx';
import { postJobs, JobSchema, Jobs } from '@api/jobs.ts';
import { useState } from 'react';
import GlassCard from '@design/GlassCard';
import { palette } from '@design/tokens';


type StatusCardProps = {
  statusInfo: StatusInfo;
  job: ServerStatusKey;
};

export default function StatusCard({ job, statusInfo }: StatusCardProps) {
  const timestamp = statusInfo.timestamp && moment(statusInfo.timestamp).format('MMM D, h:mm a');
  let isRunnable = false;
  // @ts-expect-error
  if (JobSchema.options.includes(job)) {
    isRunnable = true;
  }
  const [disabled, setDisabled] = useState(false);
  const startJob = () => {
    setDisabled(true);
    postJobs([job] as Jobs).catch((error) => {
      console.error(error);
    });
    setTimeout(() => setDisabled(false), 30_000);
  };

  return (
    <GlassCard sx={ { p: 2 } }>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 } }>
        <Typography
          sx={ {
            fontSize: '1rem',
            fontWeight: 600,
            color: palette.text.primary,
            flex: 1,
            minWidth: 0,
          } }
        >
          { statusInfo.name }
        </Typography>
        <StatusChip info={ statusInfo } />
      </Box>

      { statusInfo.description && (
        <Typography sx={ { fontSize: '0.85rem', color: palette.text.tertiary, mt: 0.75, lineHeight: 1.4 } }>
          { statusInfo.description }
        </Typography>
      ) }

      { timestamp && (
        <Typography sx={ { fontSize: '0.75rem', color: palette.text.tertiary, mt: 0.5, opacity: 0.7 } }>
          { timestamp }
        </Typography>
      ) }

      { statusInfo.message && (
        <Typography
          sx={ {
            fontSize: '0.8rem',
            color: palette.accent.red,
            mt: 1,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          } }
        >
          Error: { statusInfo.message }
        </Typography>
      ) }

      { isRunnable && (
        <Box sx={ { display: 'flex', justifyContent: 'flex-end', mt: 1.5 } }>
          <Button
            onClick={ startJob }
            variant="outlined"
            size="small"
            disabled={ disabled || statusInfo.status === 'started' }
            startIcon={ <PlayArrowIcon /> }
          >
            Run
          </Button>
        </Box>
      ) }
    </GlassCard>
  );
}
