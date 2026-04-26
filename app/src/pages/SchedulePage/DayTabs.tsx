import { Box, Tab, Tabs } from '@mui/material';
import { useScheduleStore } from './scheduleStore.tsx';
import { useAppStore } from '@state/appStore.tsx';
import { LOWERCASE_DAYS } from './days.ts';
import { palette, sx as designSx } from '@design/tokens';

export default function DayTabs() {
  const { selectDay, selectedDayIndex } = useScheduleStore();
  const { isUpdating } = useAppStore();

  return (
    <Box
      sx={ {
        ...designSx.glassCard,
        p: 0,
        overflow: 'hidden',
      } }
    >
      <Tabs
        value={ selectedDayIndex || 0 }
        onChange={ (_, index) => selectDay(index) }
        aria-label="Days of the week"
        variant="fullWidth"
        textColor="inherit"
        sx={ {
          minHeight: 44,
          '& .MuiTab-root': {
            minHeight: 44,
            color: palette.text.tertiary,
            fontSize: '0.85rem',
            fontWeight: 500,
            letterSpacing: '0.04em',
            textTransform: 'none',
          },
          '& .Mui-selected': {
            color: palette.text.primary,
            fontWeight: 600,
          },
          '& .MuiTabs-indicator': {
            backgroundColor: palette.text.primary,
            height: 2,
          },
        } }
      >
        { LOWERCASE_DAYS.map((day, index) => {
          // DayOfWeek is `keyof SideSchedule`, which TS widens to
          // string|number|symbol — narrow back to string for label use.
          const d = String(day);
          return (
            <Tab
              key={ index }
              disabled={ isUpdating }
              label={
                <>
                  <Box sx={ { display: { xs: 'block', sm: 'none' } } }>
                    { d.substring(0, 3).toUpperCase() }
                  </Box>
                  <Box sx={ { display: { xs: 'none', sm: 'block' } } }>
                    { d.charAt(0).toUpperCase() + d.slice(1) }
                  </Box>
                </>
              }
              sx={ { flex: 1, minWidth: 0, px: 1 } }
            />
          );
        }) }
      </Tabs>
    </Box>
  );
}
