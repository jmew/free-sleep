import { useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  IconButton,
  Popover,
  Slide,
  Stack,
  Typography,
} from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { palette } from '@design/tokens';
import { DayOfWeek } from '@api/schedulesSchema.ts';

type Props = {
  onSave: () => void;
};

const DAYS: DayOfWeek[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

const DAY_LABELS: Record<DayOfWeek, string> = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Schedule-page save bar. Slides up from above the bottom navigation
 * whenever the user has unsaved schedule edits, with Discard + a split
 * Save button. Tap Save to save the current day; tap the chevron to open
 * a day picker (Weekdays / Weekends / All + per-day checkboxes) and
 * commit the same change to multiple days. The save label live-updates
 * to reflect the day count so the user sees exactly what's about to write.
 */
export default function FloatingSaveBar({ onSave }: Props) {
  const { isUpdating } = useAppStore();
  const {
    changesPresent,
    isValid,
    reloadScheduleData,
    selectedDay,
    selectedDays,
    toggleSelectedDay,
  } = useScheduleStore();
  const valid = isValid();

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const popoverOpen = Boolean(anchorEl);

  const otherDays = DAYS.filter((d) => d !== selectedDay);
  const otherCount = otherDays.filter((d) => selectedDays[d]).length;
  const totalCount = otherCount + 1;

  const setMany = (days: DayOfWeek[]) => {
    days.forEach((d) => {
      if (d === selectedDay) return;
      if (!selectedDays[d]) toggleSelectedDay(d);
    });
  };

  const clearOtherDays = () => {
    otherDays.forEach((d) => {
      if (selectedDays[d]) toggleSelectedDay(d);
    });
  };

  const saveLabel = otherCount === 0 ? 'Save' : `Save ${totalCount} days`;
  const statusLabel =
    otherCount === 0 ? `Unsaved · ${cap(selectedDay)}` : `Unsaved · ${totalCount} days`;

  const handleSaveClick = () => {
    setAnchorEl(null);
    onSave();
  };

  return (
    <Slide direction="up" in={ changesPresent } mountOnEnter unmountOnExit>
      <Box
        sx={ {
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: { xs: 88, md: 72 },
          zIndex: 1100,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          px: 2,
        } }
      >
        <Box
          sx={ {
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pl: 2,
            pr: 0.5,
            py: 0.75,
            borderRadius: 999,
            backgroundColor: 'rgba(28,28,30,0.92)',
            border: `1px solid ${palette.border.medium}`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 12px 30px -12px rgba(0,0,0,0.6)',
            maxWidth: '100%',
          } }
        >
          <Typography
            sx={ {
              fontSize: '0.85rem',
              color: palette.text.secondary,
              whiteSpace: 'nowrap',
            } }
          >
            { statusLabel }
          </Typography>
          <Button
            size="small"
            onClick={ () => {
              setAnchorEl(null);
              reloadScheduleData();
            } }
            disabled={ isUpdating }
            sx={ { color: palette.text.secondary, textTransform: 'none', minWidth: 0 } }
          >
            Discard
          </Button>

          { /* Split button: Save | chevron. Visually a single pill with a thin
               divider — tapping the body saves, tapping the chevron opens the
               day picker without saving. */ }
          <Box
            sx={ {
              display: 'flex',
              alignItems: 'stretch',
              borderRadius: 999,
              overflow: 'hidden',
              opacity: valid && !isUpdating ? 1 : 0.5,
            } }
          >
            <Button
              size="small"
              variant="contained"
              onClick={ handleSaveClick }
              disabled={ isUpdating || !valid }
              sx={ {
                textTransform: 'none',
                borderRadius: 0,
                px: 2,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
                whiteSpace: 'nowrap',
              } }
            >
              { saveLabel }
            </Button>
            <Box
              sx={ {
                width: '1px',
                backgroundColor: 'rgba(255,255,255,0.25)',
              } }
            />
            <IconButton
              size="small"
              onClick={ (e) => setAnchorEl(popoverOpen ? null : e.currentTarget) }
              disabled={ isUpdating || !valid }
              aria-label="Apply to other days"
              sx={ {
                color: 'white',
                width: 32,
                borderRadius: 0,
                backgroundColor: '#1976d2',
                '&:hover': { backgroundColor: '#1565c0' },
                ...(popoverOpen && { backgroundColor: '#1565c0' }),
              } }
            >
              { popoverOpen
                ? <KeyboardArrowDownIcon fontSize="small"/>
                : <KeyboardArrowUpIcon fontSize="small"/> }
            </IconButton>
          </Box>
        </Box>

        <Popover
          open={ popoverOpen }
          anchorEl={ anchorEl }
          onClose={ () => setAnchorEl(null) }
          anchorOrigin={ { vertical: 'top', horizontal: 'right' } }
          transformOrigin={ { vertical: 'bottom', horizontal: 'right' } }
          slotProps={ {
            paper: {
              sx: {
                mb: 1.5,
                backgroundColor: 'rgba(28,28,30,0.96)',
                border: `1px solid ${palette.border.medium}`,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: 2.5,
                minWidth: 260,
                maxWidth: 320,
                p: 2,
                boxShadow: '0 12px 30px -12px rgba(0,0,0,0.6)',
                color: palette.text.primary,
              },
            },
          } }
        >
          <Typography
            sx={ {
              fontSize: '0.78rem',
              color: palette.text.tertiary,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              mb: 1.25,
            } }
          >
            Apply { cap(selectedDay) }&apos;s schedule to
          </Typography>
          <Stack direction="row" spacing={ 0.75 } sx={ { mb: 1.5, flexWrap: 'wrap', gap: 0.75 } }>
            <Button
              size="small"
              variant="outlined"
              onClick={ () => setMany(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) }
              sx={ { textTransform: 'none', borderColor: palette.border.medium, color: palette.text.primary } }
            >
              Weekdays
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={ () => setMany(['saturday', 'sunday']) }
              sx={ { textTransform: 'none', borderColor: palette.border.medium, color: palette.text.primary } }
            >
              Weekends
            </Button>
            <Button
              size="small"
              variant="outlined"
              onClick={ () => setMany(DAYS) }
              sx={ { textTransform: 'none', borderColor: palette.border.medium, color: palette.text.primary } }
            >
              Everyday
            </Button>
          </Stack>
          <FormGroup>
            { otherDays.map((d) => (
              <FormControlLabel
                key={ String(d) }
                control={
                  <Checkbox
                    size="small"
                    checked={ !!selectedDays[d] }
                    onChange={ () => toggleSelectedDay(d) }
                    disabled={ isUpdating }
                    sx={ { color: palette.text.tertiary, '&.Mui-checked': { color: '#0a84ff' } } }
                  />
                }
                label={ DAY_LABELS[d] }
                sx={ { color: palette.text.primary, mr: 0 } }
              />
            )) }
          </FormGroup>
          { otherCount > 0 && (
            <Button
              size="small"
              onClick={ clearOtherDays }
              sx={ { mt: 1, textTransform: 'none', color: palette.text.secondary } }
            >
              Clear
            </Button>
          ) }
        </Popover>
      </Box>
    </Slide>
  );
}
