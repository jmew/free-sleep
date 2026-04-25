import CircularProgress from '@mui/material/CircularProgress';
import { useAppStore } from '@state/appStore.tsx';
import { useVitalsSummary } from '@api/vitals.ts';
import { Box, Typography } from '@mui/material';
import GlassCard from '@design/GlassCard';
import { palette, typography } from '@design/tokens';

type BiometricsSummaryCardProps = {
  startTime: string;
  endTime: string;
};

type TileProps = {
  title: string;
  value: number;
  unit: string;
};

function Tile({ title, value, unit }: TileProps) {
  return (
    <Box
      sx={ {
        flex: 1,
        minWidth: 0,
        py: 1,
      } }
    >
      <Typography
        sx={ {
          ...typography.sectionLabel,
          color: palette.text.tertiary,
          mb: 0.75,
          fontSize: '0.65rem',
        } }
      >
        { title }
      </Typography>
      <Box sx={ { display: 'flex', alignItems: 'baseline', gap: 0.5 } }>
        <Typography
          sx={ {
            fontSize: '1.5rem',
            fontWeight: 500,
            color: palette.text.primary,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          } }
        >
          { value || '—' }
        </Typography>
        { value > 0 && (
          <Typography sx={ { fontSize: '0.8rem', color: palette.text.tertiary } }>
            { unit }
          </Typography>
        ) }
      </Box>
    </Box>
  );
}

// eslint-disable-next-line react/no-multi-comp
export default function VitalsSummaryCard({ startTime, endTime }: BiometricsSummaryCardProps) {
  const { side } = useAppStore();
  const { data: vitalsSummary, isFetching } = useVitalsSummary({ startTime, endTime, side });

  return (
    <GlassCard label="HEALTH METRICS">
      { isFetching && <CircularProgress sx={ { display: 'block', mx: 'auto', my: 2 } } /> }
      { !isFetching && vitalsSummary !== undefined && (
        <Box
          sx={ {
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(5, 1fr)' },
            gap: 1.5,
            mt: 0.5,
          } }
        >
          <Tile title="Avg HR"     value={ vitalsSummary.avgHeartRate } unit="bpm" />
          <Tile title="Min HR"     value={ vitalsSummary.minHeartRate } unit="bpm" />
          <Tile title="Max HR"     value={ vitalsSummary.maxHeartRate } unit="bpm" />
          <Tile title="HRV"        value={ vitalsSummary.avgHRV }       unit="ms" />
          <Tile title="Breath"     value={ vitalsSummary.avgBreathingRate } unit="brpm" />
        </Box>
      ) }
    </GlassCard>
  );
}
