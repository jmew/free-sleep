import {
  useBaseStatus,
  useSetBasePosition,
  useSetBasePreset,
  useStopBase,
} from '@api/baseControl';
import BedVisualization from '@components/BedVisualization';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useAppStore } from '@state/appStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import PageContainer from '../PageContainer';

interface BasePosition {
  head: number;
  feet: number;
}

const presets = {
  flat: { head: 0, feet: 0 },
  sleep: { head: 1, feet: 5 },
  relax: { head: 30, feet: 15 },
  read: { head: 40, feet: 0 },
};

const presetTimes = {
  flat: '0 • 0',
  sleep: '1 • 5',
  relax: '30 • 15',
  read: '40 • 0',
};

const presetIcons = {
  flat: (isActive: boolean) => (
    <img
      src="/icons/preset-flat-active.svg"
      alt="Flat"
      style={{ width: 24, height: 24, opacity: isActive ? 1 : 0.5 }}
    />
  ),
  sleep: (isActive: boolean) => (
    <img
      src="/icons/preset-sleep-active.svg"
      alt="Sleep"
      style={{ width: 24, height: 24, opacity: isActive ? 1 : 0.5 }}
    />
  ),
  relax: (isActive: boolean) => (
    <img
      src="/icons/preset-relax-active.svg"
      alt="Relax"
      style={{ width: 24, height: 24, opacity: isActive ? 1 : 0.5 }}
    />
  ),
  read: (isActive: boolean) => (
    <img
      src="/icons/preset-read-active.svg"
      alt="Read"
      style={{ width: 24, height: 24, opacity: isActive ? 1 : 0.5 }}
    />
  ),
};

export default function BaseControlPage() {
  const theme = useTheme();
  const { isUpdating } = useAppStore();
  const [position, setPosition] = useState<BasePosition>({ head: 0, feet: 0 });
  const [isOptimisticallyMoving, setIsOptimisticallyMoving] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [optimisticMovementStartTime, setOptimisticMovementStartTime] =
    useState<number | null>(null);
  const [movingToPreset, setMovingToPreset] = useState<string | null>(null);

  const { data: baseStatus, isLoading } = useBaseStatus();
  const setBasePositionMutation = useSetBasePosition();
  const setBasePresetMutation = useSetBasePreset();
  const stopBaseMutation = useStopBase();

  // Update local state when base status changes - always sync with backend
  useEffect(() => {
    if (baseStatus) {
      setPosition((prev) => {
        // Only update if the position has actually changed
        if (prev.head !== baseStatus.head || prev.feet !== baseStatus.feet) {
          return { head: baseStatus.head, feet: baseStatus.feet };
        }
        return prev;
      });
    }
  }, [baseStatus?.head, baseStatus?.feet]);

  // Stop optimistic movement when backend reports movement has stopped
  useEffect(() => {
    if (baseStatus && !baseStatus.isMoving && isOptimisticallyMoving) {
      // Only stop if we've been optimistically moving for at least 2 seconds
      // This prevents stopping too early if the backend hasn't started reporting movement yet
      if (
        optimisticMovementStartTime &&
        Date.now() - optimisticMovementStartTime > 2000
      ) {
        setIsOptimisticallyMoving(false);
        setOptimisticMovementStartTime(null);
        setMovingToPreset(null);
      }
    }
  }, [
    baseStatus?.isMoving,
    isOptimisticallyMoving,
    optimisticMovementStartTime,
  ]);

  const debouncedApplyPosition = useCallback(
    async (newPosition: BasePosition) => {
      setIsOptimisticallyMoving(true);
      setOptimisticMovementStartTime(Date.now());

      try {
        await setBasePositionMutation.mutateAsync({
          ...newPosition,
          feedRate: 50,
        });
      } catch (error) {
        setIsOptimisticallyMoving(false);
        setOptimisticMovementStartTime(null);
        throw error;
      }
    },
    [setBasePositionMutation],
  );

  const updatePosition = useCallback(
    (newPosition: BasePosition) => {
      setPosition(newPosition);

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new debounced timer
      debounceTimerRef.current = setTimeout(() => {
        debouncedApplyPosition(newPosition);
      }, 500);
    },
    [debouncedApplyPosition],
  );

  const pillButtonStyle = {
    color: '#fff',
    fontSize: '18px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    '&:disabled': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      color: 'rgba(255, 255, 255, 0.3)',
    },
  };

  const presetButtonStyle = {
    color: '#fff',
    justifyContent: 'space-between',
    py: 1,
    px: 2.5,
    textTransform: 'none',
    fontSize: '15px',
    fontWeight: 'normal',
    width: '100%',
    minWidth: '320px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    border: 'none',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    '&:disabled': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      color: 'rgba(255, 255, 255, 0.5)',
    },
  };

  const handleHeadIncrement = () =>
    updatePosition({ ...position, head: Math.min(45, position.head + 1) });

  const handleHeadDecrement = () =>
    updatePosition({ ...position, head: Math.max(0, position.head - 1) });

  const handleFeetIncrement = () =>
    updatePosition({ ...position, feet: Math.min(30, position.feet + 1) });

  const handleFeetDecrement = () =>
    updatePosition({ ...position, feet: Math.max(0, position.feet - 1) });

  const handlePresetClick = async (preset: keyof typeof presets) => {
    // If clicking on the preset we're currently moving to, stop movement
    if (movingToPreset === preset && isActuallyMoving) {
      await handleStop();
      return;
    }

    // Start optimistic movement state
    setIsOptimisticallyMoving(true);
    setOptimisticMovementStartTime(Date.now());
    setMovingToPreset(preset);

    try {
      // Don't optimistically update local state - let backend report the changes
      await setBasePresetMutation.mutateAsync(preset);
    } catch (error) {
      // If command fails, stop optimistic movement
      setIsOptimisticallyMoving(false);
      setOptimisticMovementStartTime(null);
      setMovingToPreset(null);
      throw error;
    }
  };

  const handleStop = async () => {
    // Stop optimistic movement immediately when stop is requested
    setIsOptimisticallyMoving(false);
    setOptimisticMovementStartTime(null);
    setMovingToPreset(null);

    await stopBaseMutation.mutateAsync();
  };

  // Determine which preset matches current position
  const getActivePreset = () => {
    return (
      Object.entries(presets).find(
        ([_, preset]) =>
          preset.head === position.head && preset.feet === position.feet,
      )?.[0] || null
    );
  };

  const activePreset = getActivePreset();

  const isMoving = baseStatus?.isMoving || false;
  const isActuallyMoving = isOptimisticallyMoving || isMoving;
  const isMutating =
    setBasePositionMutation.isPending ||
    setBasePresetMutation.isPending ||
    stopBaseMutation.isPending;

  return (
    <PageContainer
      sx={{
        maxWidth: '500px',
        [theme.breakpoints.up('md')]: {
          maxWidth: '400px',
        },
        bgcolor: '#000',
        color: '#fff',
        minHeight: '100vh',
        justifyContent: 'flex-start',
      }}
    >
      <Typography
        component="h1"
        sx={{
          color: '#fff',
          mb: 4,
          fontSize: '2rem',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          alignSelf: 'flex-start',
        }}
      >
        Elevation
      </Typography>

      {/* Bed Visualization */}
      <Box sx={{ mb: 2, mt: -1, display: 'flex', justifyContent: 'center' }}>
        <BedVisualization
          headPosition={position.head}
          feetPosition={position.feet}
        />
      </Box>

      {/* Head and Feet Controls — always side-by-side; the inner row of
          buttons + number is ~120px so two of them fit comfortably even on
          a 390px iPhone. */}
      <Stack
        direction="row"
        spacing={{ xs: 2, sm: 5 }}
        sx={{ mb: 2.5, alignItems: 'center', justifyContent: 'center' }}
      >
        {/* Head Control */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              color: '#888',
              mb: 1,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
            }}
          >
            HEAD
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            spacing={{ xs: 1.5, sm: 2 }}
          >
            <IconButton
              onClick={handleHeadDecrement}
              disabled={position.head <= 0}
              sx={pillButtonStyle}
            >
              <RemoveIcon />
            </IconButton>
            <Typography
              sx={{
                color: '#fff',
                fontWeight: 500,
                minWidth: { xs: 36, sm: 44 },
                fontSize: { xs: '2rem', sm: '2.4rem' },
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {position.head}
            </Typography>
            <IconButton
              onClick={handleHeadIncrement}
              disabled={position.head >= 45}
              sx={pillButtonStyle}
            >
              <AddIcon />
            </IconButton>
          </Stack>
        </Box>

        {/* Feet Control */}
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            sx={{
              color: '#888',
              mb: 1,
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.12em',
            }}
          >
            FEET
          </Typography>
          <Stack
            direction="row"
            alignItems="center"
            spacing={{ xs: 1.5, sm: 2 }}
          >
            <IconButton
              onClick={handleFeetDecrement}
              disabled={position.feet <= 0}
              sx={pillButtonStyle}
            >
              <RemoveIcon />
            </IconButton>
            <Typography
              sx={{
                color: '#fff',
                fontWeight: 500,
                minWidth: { xs: 36, sm: 44 },
                fontSize: { xs: '2rem', sm: '2.4rem' },
                textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {position.feet}
            </Typography>
            <IconButton
              onClick={handleFeetIncrement}
              disabled={position.feet >= 30}
              sx={pillButtonStyle}
            >
              <AddIcon />
            </IconButton>
          </Stack>
        </Box>
      </Stack>

      {/* Loading indicator */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <CircularProgress size={24} sx={{ color: '#fff' }} />
        </Box>
      )}

      {/* Movement status */}
      {isActuallyMoving && !isMutating && (
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="body2" sx={{ color: '#fff' }}>
            Base is moving...
          </Typography>
        </Box>
      )}

      {/* Preset Buttons */}
      <Stack spacing={1} sx={{ mb: 2 }}>
        {Object.entries(presetTimes).map(([preset, time]) => {
          const IconComponent = presetIcons[preset as keyof typeof presetIcons];
          const isActive = activePreset === preset;
          const canStop = movingToPreset === preset && isActuallyMoving;

          return (
            <Button
              key={preset}
              variant="text"
              onClick={() => handlePresetClick(preset as keyof typeof presets)}
              disabled={
                isUpdating || (!canStop && (isActuallyMoving || isMutating))
              }
              sx={{
                ...presetButtonStyle,
                backgroundColor: canStop
                  ? 'rgba(220, 53, 69, 0.2)' // Red background when it's a stop button
                  : isActive
                    ? 'rgba(255, 255, 255, 0.2)'
                    : 'rgba(255, 255, 255, 0.1)',
                color: canStop
                  ? '#dc3545'
                  : isActive
                    ? '#fff'
                    : 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  backgroundColor: canStop
                    ? 'rgba(220, 53, 69, 0.3)'
                    : 'rgba(255, 255, 255, 0.2)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Box sx={{ mr: 2 }}>{IconComponent(isActive || canStop)}</Box>
                {canStop
                  ? 'Stop'
                  : preset.charAt(0).toUpperCase() + preset.slice(1)}
              </Box>
              <Typography
                sx={{ color: canStop ? '#dc3545' : isActive ? '#fff' : '#888' }}
              >
                {canStop ? 'Moving...' : time}
              </Typography>
            </Button>
          );
        })}
      </Stack>

      {/* Floating Stop Button for manual adjustments */}
      {isActuallyMoving && !movingToPreset && (
        <Box
          sx={{
            position: 'fixed',
            bottom: { xs: 100, md: 120 }, // Position above navigation bar
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
          }}
        >
          <Button
            variant="contained"
            color="error"
            onClick={handleStop}
            disabled={stopBaseMutation.isPending}
            size="large"
            sx={{
              borderRadius: '24px',
              px: 4,
              py: 1.5,
              fontSize: '16px',
              fontWeight: 'bold',
              boxShadow: 3,
              '&:disabled': {
                bgcolor: '#666',
                color: '#ccc',
              },
            }}
          >
            {stopBaseMutation.isPending ? 'Stopping...' : 'Stop Movement'}
          </Button>
        </Box>
      )}
    </PageContainer>
  );
}
