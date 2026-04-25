import { useEffect, useState } from 'react';
import { Alert, Button, Typography, Box } from '@mui/material';
import moment from 'moment-timezone';
import { useQueryClient } from '@tanstack/react-query';

import { useSettings, postSettings } from '@api/settings.ts';
import { useAppStore } from '@state/appStore.tsx';

function formatRemaining(expiresAt: string): string {
  const diffMs = moment(expiresAt).diff(moment());
  if (diffMs <= 0) return 'expired';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function ScheduleOverrideBanner() {
  const { side } = useAppStore();
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();
  const [isResuming, setIsResuming] = useState(false);
  // Re-render every 30s so the countdown stays roughly current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const override = settings?.[side]?.scheduleOverrides?.temperatureSchedules;
  const isOverridden =
    !!override?.disabled && !!override.expiresAt && moment(override.expiresAt).isAfter(moment());

  if (!isOverridden) return null;

  const handleResume = async () => {
    setIsResuming(true);
    try {
      await postSettings({
        [side]: {
          scheduleOverrides: {
            temperatureSchedules: {
              disabled: false,
              expiresAt: '',
            },
          },
        },
      });
      await queryClient.invalidateQueries({ queryKey: ['useSettings'] });
    } catch (err) {
      console.error(err);
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <Alert
      severity="info"
      icon={ false }
      sx={ {
        width: '100%',
        backgroundColor: 'rgba(33, 150, 243, 0.08)',
        border: '1px solid rgba(33, 150, 243, 0.25)',
        '& .MuiAlert-message': { width: '100%' },
      } }
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={ 2 }>
        <Box>
          <Typography variant="body2" fontWeight={ 600 }>
            Schedule paused
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Resumes in { formatRemaining(override!.expiresAt!) }
          </Typography>
        </Box>
        <Button
          variant="text"
          size="small"
          onClick={ handleResume }
          disabled={ isResuming }
        >
          Resume
        </Button>
      </Box>
    </Alert>
  );
}
