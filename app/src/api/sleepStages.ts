import axios from './api';
import { useQuery } from '@tanstack/react-query';

export type SleepStage = 'awake' | 'rem' | 'light' | 'deep';

export type StageEpoch = {
  startUnix: number;
  endUnix: number;
  stage: SleepStage;
};

export type SleepStagesResponse = {
  epochs: StageEpoch[];
  totals: Record<SleepStage, number>;       // seconds per stage
  percentages: Record<SleepStage, number>;  // 0..100
  totalSeconds: number;
};

type Args = {
  side: 'left' | 'right';
  startTime?: string;
  endTime?: string;
};

export const useSleepStages = ({ side, startTime, endTime }: Args, enabled = true) => {
  return useQuery<SleepStagesResponse>({
    queryKey: ['useSleepStages', side, startTime, endTime],
    queryFn: async () => {
      const response = await axios.get<SleepStagesResponse>('/metrics/sleep-stages', {
        params: { side, startTime, endTime },
      });
      return response.data;
    },
    enabled: enabled && !!startTime && !!endTime,
  });
};
