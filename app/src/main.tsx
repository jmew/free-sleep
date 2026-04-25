import { initSentry } from './sentry.tsx';
initSentry();
import * as Sentry from '@sentry/react';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import ControlTempPage from './pages/ControlTempPage/ControlTempPage';
import SettingsPage from './pages/SettingsPage/SettingsPage';
import Layout from './components/Layout';
import { AppStoreProvider } from '@state/appStore.tsx';
import SchedulePage from './pages/SchedulePage/SchedulePage.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { GlobalStyles } from '@mui/material';
import SleepPage from './pages/DataPage/SleepPage/SleepPage.tsx';
import VitalsPage from './pages/DataPage/VitalsPage/VitalsPage.tsx';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import LogsPage from './pages/DataPage/LogsPage/LogsPage.tsx';
import StatusPage from './pages/StatusPage/StatusPage.tsx';
import BaseControlPage from './pages/BaseControlPage/BaseControlPage.tsx';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0a84ff',  // Apple system blue
    },
    background: {
      default: '#000000',
      paper: 'rgba(255,255,255,0.04)',
    },
    text: {
      primary: 'rgba(255,255,255,0.95)',
      secondary: 'rgba(255,255,255,0.65)',
    },
    grey: {
      100: '#e8eaed',
      300: '#a6adbe',
      400: '#88878c',
      500: '#606060',
      700: '#272727',
      800: '#262626',
      900: '#242424',
    }
  },
  typography: {
    // System font stack — gives us SF Pro on Apple devices, native sans elsewhere.
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',  // disable MUI's default surface tint
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',  // Apple-style — no SHOUTING buttons
          fontWeight: 500,
        },
      },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
    },
  },
});

const SentryRoutes = Sentry.withSentryReactRouterV7Routing(Routes);


const App = () => {
  return (

    <QueryClientProvider client={ queryClient }>
      <ThemeProvider theme={ darkTheme }>
        <LocalizationProvider dateAdapter={ AdapterMoment }>

          <AppStoreProvider>
            <CssBaseline/>
            <GlobalStyles
              styles={ {
                'html, body': {
                  overscrollBehavior: 'none', // Prevent rubber-banding
                  // Pure black base with a barely-perceptible warm tint at the top
                  // — Apple Home / 8 Sleep both use deep black with subtle accent.
                  background: '#000000',
                  backgroundImage:
                    'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(40, 40, 60, 0.35) 0%, transparent 60%)',
                  backgroundAttachment: 'fixed',
                  minHeight: '100vh',
                  // Tabular numerals for cleaner number alignment.
                  fontVariantNumeric: 'tabular-nums',
                },
                '#Layout': {
                  background: 'transparent',
                },
              } }
            />
            <BrowserRouter basename="/">
              <SentryRoutes>
                <Route path="/" element={ <Layout/> }>
                  <Route index element={ <ControlTempPage/> }/>
                  <Route path="temperature" element={ <ControlTempPage/> }/>
                  <Route path="left" element={ <ControlTempPage/> }/>
                  <Route path="right" element={ <ControlTempPage/> }/>
                  <Route path="elevation" element={ <BaseControlPage/> }/>
                  <Route path="status" element={ <StatusPage /> } />

                  { /* Sleep tab: directly renders SleepPage. The DataPage menu wrapper
                       is gone; "Logs" is now reachable from Settings. /data still
                       redirects to /sleep for old links. */ }
                  <Route path="sleep" element={ <SleepPage/> }/>
                  <Route path="data" element={ <SleepPage/> }/>
                  <Route path="data/sleep" element={ <SleepPage/> }/>
                  <Route path="data/logs" element={ <LogsPage/> }/>
                  <Route path="data/vitals" element={ <VitalsPage/> }/>
                  <Route path="logs" element={ <LogsPage/> }/>

                  <Route path="settings" element={ <SettingsPage/> }/>
                  <Route path="schedules" element={ <SchedulePage/> }/>
                </Route>
              </SentryRoutes>
            </BrowserRouter>
          </AppStoreProvider>
        </LocalizationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};


async function enableMocking() {
  if (import.meta.env.VITE_ENV !== 'demo') {
    return;
  }
  // eslint-disable-next-line no-console
  console.info('Enabling MSW worker!');

  const { worker } = await import('./mocks/browser');

  // `worker.start()` returns a Promise that resolves
  // once the Service Worker is up and ready to intercept requests.
  return worker.start();
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary componentName='App'>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
});
