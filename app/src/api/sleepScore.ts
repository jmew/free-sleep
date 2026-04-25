import axios from './api';
import { useQuery } from '@tanstack/react-query';

export type SleepScoreComponent = {
  score: number;
  weight: number;
  value: string;
  available: boolean;
};

export type SleepScore = {
  score: number;
  components: {
    duration: SleepScoreComponent;
    continuity: SleepScoreComponent;
    hrv: SleepScoreComponent;
    restingHr: SleepScoreComponent;
  };
};

type Args = {
  side: 'left' | 'right';
  startTime?: string;
  endTime?: string;
};

export const useSleepScore = ({ side, startTime, endTime }: Args, enabled = true) => {
  return useQuery<SleepScore>({
    queryKey: ['useSleepScore', side, startTime, endTime],
    queryFn: async () => {
      const response = await axios.get<SleepScore>('/metrics/sleep-score', {
        params: { side, startTime, endTime },
      });
      return response.data;
    },
    enabled: enabled && !!startTime && !!endTime,
  });
};
