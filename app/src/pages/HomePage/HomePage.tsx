import { Box } from '@mui/material';

import ErrorBoundary from '@components/ErrorBoundary.tsx';
import PageContainer from '../PageContainer.tsx';
import Greeting from './Greeting';
import PodHeroCard from './PodHeroCard';
import SleepSummaryCard from './SleepSummaryCard';
import TonightCard from './TonightCard';
import QuickActionsCard from './QuickActionsCard';
import StatusFooter from './StatusFooter';

export default function HomePage() {
  return (
    <ErrorBoundary componentName="Home page">
      <PageContainer
        sx={ {
          alignItems: 'stretch',
          justifyContent: 'flex-start',
          gap: 1.5,
          pt: { xs: 3, sm: 6 },
        } }
      >
        <Greeting/>
        <ErrorBoundary componentName="Pod hero card">
          <PodHeroCard/>
        </ErrorBoundary>
        <ErrorBoundary componentName="Sleep summary card">
          <SleepSummaryCard/>
        </ErrorBoundary>
        <ErrorBoundary componentName="Tonight card">
          <TonightCard/>
        </ErrorBoundary>
        <ErrorBoundary componentName="Quick actions card">
          <QuickActionsCard/>
        </ErrorBoundary>
        <Box sx={ { mt: 1 } }>
          <ErrorBoundary componentName="Status footer">
            <StatusFooter/>
          </ErrorBoundary>
        </Box>
      </PageContainer>
    </ErrorBoundary>
  );
}
