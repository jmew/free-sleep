import { initSentry } from './sentry.tsx';
initSentry();
import * as Sentry from '@sentry/react';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { Box, CircularProgress, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

import Layout from './components/Layout';
import { AppStoreProvider } from '@state/appStore.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { GlobalStyles } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';

// Pages are lazy-loaded so each route ships only what it needs. The shell
// (Layout, AppStoreProvider, theme, query client) stays in the entry chunk so
// the first paint doesn't wait on a route-specific download.
const ControlTempPage = lazy(() => import('./pages/ControlTempPage/ControlTempPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage/SettingsPage'));
const SchedulePage = lazy(() => import('./pages/SchedulePage/SchedulePage.tsx'));
const SleepPage = lazy(() => import('./pages/DataPage/SleepPage/SleepPage.tsx'));
const VitalsPage = lazy(() => import('./pages/DataPage/VitalsPage/VitalsPage.tsx'));
const LogsPage = lazy(() => import('./pages/DataPage/LogsPage/LogsPage.tsx'));
const StatusPage = lazy(() => import('./pages/StatusPage/StatusPage.tsx'));
const BaseControlPage = lazy(() => import('./pages/BaseControlPage/BaseControlPage.tsx'));

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
    // Geist (free, OFL — Vercel) is loaded via Google Fonts in app/index.html.
    // It's the closest free analog to NeueMontreal (the official Pod app's font);
    // a modern geometric grotesque. System stack is the offline fallback.
    fontFamily:
      '"Geist", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
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
    // Default `background.paper` is translucent (rgba(255,255,255,0.04)) so
    // that GlassCards can sit on the page background. That same translucency
    // makes Select/Menu popovers hard to read because they show whatever's
    // behind them. Pin menu surfaces to an opaque dark grey instead.
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1c1c1e',
          backgroundImage: 'none',
          border: '1px solid rgba(255,255,255,0.08)',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1c1c1e',
          backgroundImage: 'none',
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

// Centred spinner while a route chunk is downloading. Kept tiny on purpose —
// gets shown for sub-second loads on the LAN, so fanfare would feel laggy.
const RouteFallback = () => (
  <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' } }>
    <CircularProgress />
  </Box>
);


const App = () => {
  return (

    <QueryClientProvider client={ queryClient }>
      <ThemeProvider theme={ darkTheme }>
        <LocalizationProvider dateAdapter={ AdapterMoment }>

          <AppStoreProvider>
            <CssBaseline/>
            <GlobalStyles
              styles={ {
                // Split html / body styles deliberately. Applying overflow-y:auto
                // and overscroll-behavior:none to BOTH (the previous setup) made
                // Android Chrome create two nested scroll containers — single-
                // finger drag would scroll one and require two fingers for the
                // other. The fix: html only handles horizontal clipping; body is
                // the single scroll container with overscroll behaviour.
                // After multiple failed attempts, the working combination on
                // Android Chrome (tablet + phone) is:
                //   - viewport meta WITHOUT user-scalable=no/maximum-scale=1
                //   - touch-action: pan-y explicit on body
                //   - NO overscroll-behavior (it intercepts single-finger
                //     touches on some Android builds)
                //   - NO background-attachment: fixed (kills smooth scroll
                //     and can disable touch-scroll altogether on Android)
                //   - html height: 100% so body's height: auto + scroll
                //     reference works predictably
                'html': {
                  height: '100%',
                  overflowX: 'hidden',
                  maxWidth: '100vw',
                },
                'body': {
                  margin: 0,
                  // Pure black base with a barely-perceptible warm tint at the top
                  // — Apple Home / 8 Sleep both use deep black with subtle accent.
                  background: '#000000',
                  backgroundImage:
                    'radial-gradient(ellipse 100% 60% at 50% 0%, rgba(40, 40, 60, 0.35) 0%, transparent 60%)',
                  // Was background-attachment: fixed — removed because Android
                  // Chrome treats fixed-attachment backgrounds as a layout
                  // hint that disables compositor-driven smooth scroll, and
                  // in some builds disables touch-scroll on the body entirely.
                  minHeight: '100vh',
                  fontVariantNumeric: 'tabular-nums',
                  overflowX: 'hidden',
                  overflowY: 'auto',
                  // Explicit pan-y so Android knows single-finger vertical
                  // drag is for scroll, not for any other gesture.
                  touchAction: 'pan-y',
                  // Smooth momentum scroll on iOS WebKit.
                  WebkitOverflowScrolling: 'touch',
                  maxWidth: '100vw',
                },
                // Hide vertical scrollbars but keep scroll functionality, on every
                // scrollable element across the app. (More minimal/sleek look like
                // a native iOS app — momentum scroll still works.)
                '*': {
                  scrollbarWidth: 'none', // Firefox
                  msOverflowStyle: 'none', // IE / old Edge
                },
                '*::-webkit-scrollbar': {
                  display: 'none',         // Chrome / Safari / WebKit
                  width: 0,
                  height: 0,
                },
                '#Layout': {
                  background: 'transparent',
                  width: '100%',
                  maxWidth: '100vw',
                  overflowX: 'hidden',
                },
              } }
            />
            <BrowserRouter basename="/">
              <Suspense fallback={ <RouteFallback /> }>
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
              </Suspense>
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
