import React from 'react';
import AppBar from '@mui/material/AppBar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '@state/appStore.tsx';
import { useTheme } from '@mui/material/styles';
import { useServerStatus } from '@api/serverStatus.ts';
import { Status } from '@api/serverStatusSchema.ts';
import { useEventStreamStore } from '@api/eventStream.ts';
import { PAGES } from './pages';

// A "check" is unhealthy when its status indicates an active failure or
// recovery, not merely "running" / "idle". This matches the chips on the
// Status page (warning + error variants).
const UNHEALTHY_STATUSES: ReadonlySet<Status> = new Set(['failed', 'restarting', 'retrying']);
// Files in app/public/ are served at the URL root by Vite — reference by URL,
// don't import. (Vite errors on direct imports from /public.)
const freeSleepIcon = '/free-sleep-icon_192.png';

export default function Navbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isUpdating } = useAppStore();
  const theme = useTheme(); // Access the Material-UI theme
  // Show a subtle "Reconnecting…" tag only when the WS is down. When it's
  // 'open' or freshly mounted ('connecting' for a fraction of a second), we
  // show nothing — the app is silent when everything is working.
  const wsState = useEventStreamStore((s) => s.state);
  const showReconnecting = wsState === 'reconnecting';
  const [mobileNavValue, setMobileNavValue] = React.useState(
    PAGES.findIndex((page) => page.route === pathname)
  );

  // Poll server status so the Status tab can show a red dot when any check
  // is unhealthy. 30s is plenty for a passive indicator.
  const { data: serverStatus } = useServerStatus(30_000);
  const hasUnhealthyStatus = React.useMemo(() => {
    if (!serverStatus) return false;
    return Object.values(serverStatus).some(
      (info) => info && UNHEALTHY_STATUSES.has(info.status),
    );
  }, [serverStatus]);

  // Handle navigation for both desktop and mobile
  const handleNavigation = (route: string) => {
    navigate(route);
  };

  const handleMobileNavChange = (
    _event: React.SyntheticEvent,
    newValue: number
  ) => {
    setMobileNavValue(newValue);
    handleNavigation(PAGES[newValue].route);
  };

  const gradient = `linear-gradient(
  90deg,
  transparent,
  ${theme.palette.primary.dark},
  transparent,
  ${theme.palette.primary.dark},
  transparent
)`;
  return (
    <>
      { /* Loading Bar */ }
      <Box
        sx={ {
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '4px',
          background: isUpdating ? gradient : 'transparent',
          backgroundSize: '200% 100%',
          animation: isUpdating
            ? 'slide-gradient 10s linear infinite reverse'
            : 'none',
          zIndex: 1201,
        } }
      />
      { /* Reconnecting indicator — only visible when the live event stream
           is down. Sits below the iOS status bar via env(safe-area-inset-top). */ }
      { showReconnecting && (
        <Box
          aria-live="polite"
          sx={ {
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top, 0px) + 6px)',
            right: 12,
            zIndex: 1202,
            px: 1,
            py: 0.25,
            borderRadius: 1,
            fontSize: '0.7rem',
            color: theme.palette.warning.light,
            backgroundColor: 'rgba(0,0,0,0.6)',
            border: `1px solid ${theme.palette.warning.dark}`,
          } }
        >
          Reconnecting…
        </Box>
      ) }
      { /* Desktop Navigation */ }
      <AppBar
        position="fixed"
        color="transparent"
        sx={ {
          display: { xs: 'none', md: 'flex' },
          borderTop: `1px solid ${theme.palette.grey[700]}`,
          backgroundColor: theme.palette.background.default,
          boxShadow: 'none',
          top: 'auto', // Push it to the bottom
          bottom: 0, // Stick it to the bottom
          left: 0,
          right: 0,
        } }
      >
        <Toolbar>
          <div style={ { flexGrow: 1 } }>
            <img src={ freeSleepIcon } alt="App" width={ 45 } height={ 45 } />
          </div>
          <Box sx={ { display: 'flex', gap: 2 } }>
            { PAGES.map(({ title, route }) => {
              const showStatusDot = route === '/status' && hasUnhealthyStatus;
              return (
                <Button
                  key={ route }
                  onClick={ () => handleNavigation(route) }
                  sx={ { color: 'white' } }
                  variant={ pathname === route ? 'outlined' : 'text' }
                >
                  <Badge
                    color="error"
                    variant="dot"
                    invisible={ !showStatusDot }
                    overlap="rectangular"
                    sx={ { '& .MuiBadge-badge': { right: -6, top: 4 } } }
                  >
                    { title }
                  </Badge>
                </Button>
              );
            }) }
          </Box>
        </Toolbar>
      </AppBar>

      { /* Mobile Bottom Navigation */ }
      <Box
        sx={ {
          display: { xs: 'flex', md: 'none' },
          width: '100%',
          position: 'fixed',
          bottom: 0,
          height: '80px',
          justifyContent: 'space-between',
          borderTop: `1px solid ${theme.palette.grey[700]}`,
          backgroundColor: theme.palette.background.default,
          zIndex: 10,
        } }
      >
        <BottomNavigation
          value={ mobileNavValue }
          onChange={ handleMobileNavChange }
          sx={ {
            width: '100%',
            backgroundColor: theme.palette.background.default,
            '& .Mui-selected': {
              color: theme.palette.grey[100],
            },
            '& .MuiBottomNavigationAction-root': {
              color: theme.palette.grey[500],
            },
          } }
        >
          { PAGES.map(({ title, icon, route }, index) => {
            const showStatusDot = route === '/status' && hasUnhealthyStatus;
            const decoratedIcon = showStatusDot ? (
              <Badge
                color="error"
                variant="dot"
                overlap="circular"
                anchorOrigin={ { vertical: 'top', horizontal: 'right' } }
              >
                { icon }
              </Badge>
            ) : (
              icon
            );
            return (
              <BottomNavigationAction
                key={ index }
                icon={ decoratedIcon }
                aria-label={ title }
                sx={ {
                  minWidth: 0,
                  padding: '6px 0',
                  '&.Mui-selected': {
                    color: theme.palette.grey[100],
                  },
                } }
              />
            );
          }) }
        </BottomNavigation>
      </Box>
      <style>
        { `
@keyframes slide-gradient {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}
        ` }
      </style>
    </>
  );
}
