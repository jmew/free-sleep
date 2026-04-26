import { Box, Button, Slide, Typography } from '@mui/material';
import { useAppStore } from '@state/appStore.tsx';
import { useScheduleStore } from './scheduleStore.tsx';
import { palette } from '@design/tokens';

type Props = {
  onSave: () => void;
};

/**
 * Schedule-page save bar. Slides up from above the bottom navigation
 * whenever the user has unsaved changes, with separate Discard and Save
 * actions. Sits at fixed position so it's always reachable as the user
 * scrolls; padded so the nav-bar at bottom: 0 isn't covered.
 */
export default function FloatingSaveBar({ onSave }: Props) {
  const { isUpdating } = useAppStore();
  const { changesPresent, isValid, reloadScheduleData } = useScheduleStore();
  const valid = isValid();
  // Slide unmounts the inner content when `in` is false, but the wrapping
  // Box keeps space free below the nav bar. The bar is purely informative
  // when the user has nothing to save, so just render nothing then.
  return (
    <Slide direction="up" in={ changesPresent } mountOnEnter unmountOnExit>
      <Box
        sx={ {
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: { xs: 88, md: 72 }, // clear of the bottom nav (~80px)
          zIndex: 1100,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none', // let scroll pass through outside the chip
          px: 2,
        } }
      >
        <Box
          sx={ {
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            py: 1.25,
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
              pl: 0.5,
            } }
          >
            Unsaved changes
          </Typography>
          <Button
            size="small"
            onClick={ () => reloadScheduleData() }
            disabled={ isUpdating }
            sx={ { color: palette.text.secondary, textTransform: 'none' } }
          >
            Discard
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={ onSave }
            disabled={ isUpdating || !valid }
            sx={ { textTransform: 'none', borderRadius: 999, px: 2 } }
          >
            Save
          </Button>
        </Box>
      </Box>
    </Slide>
  );
}
