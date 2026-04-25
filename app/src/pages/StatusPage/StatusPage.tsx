import moment from 'moment-timezone';
import { useServerStatus } from '@api/serverStatus.ts';
import { Box, CircularProgress, Typography } from '@mui/material';

import PageContainer from '../PageContainer.tsx';
import StatusCard from './StatusCard.tsx';
import { ServerStatusKey, StatusInfo } from '@api/serverStatusSchema.ts';
import { palette } from '@design/tokens';

export default function StatusPage() {
  const { data, isLoading, dataUpdatedAt } = useServerStatus(5_000);
  const updatedAt = moment(dataUpdatedAt);
  const formatted = updatedAt.format('h:mm:ss a');

  return (
    <PageContainer
      sx={ {
        mb: 15,
        pt: 3,
        gap: 2,
        alignItems: 'stretch',
      } }
    >
      <Box sx={ { px: 0.5, mb: 0.5 } }>
        <Typography
          sx={ {
            fontSize: '2rem',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: palette.text.primary,
            lineHeight: 1.1,
          } }
        >
          System
        </Typography>
        <Typography sx={ { fontSize: '0.85rem', color: palette.text.tertiary, mt: 0.25 } }>
          Updated { formatted }
        </Typography>
      </Box>

      { isLoading && <CircularProgress sx={ { mx: 'auto' } } /> }

      { data && (
        <Box sx={ { display: 'flex', flexDirection: 'column', gap: 1.5 } }>
          {
            // @ts-expect-error
            Object.keys(data).map((job: ServerStatusKey) => (
              <StatusCard
                key={ job }
                job={ job }
                statusInfo={ data[job] as StatusInfo }
              />
            ))
          }
        </Box>
      ) }
    </PageContainer>
  );
}
