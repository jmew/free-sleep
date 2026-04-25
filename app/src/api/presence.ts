import axios from './api';
import { useQuery } from '@tanstack/react-query';

export type PresenceSide = {
  present: boolean;
  lastUpdatedAt?: string;
};

export type PresenceData = {
  left: PresenceSide;
  right: PresenceSide;
};

export const usePresence = (refetchInterval: number = 10_000) => {
  return useQuery<PresenceData>({
    queryKey: ['usePresence'],
    queryFn: async () => {
      const response = await axios.get<PresenceData>('/metrics/presence');
      return response.data;
    },
    refetchInterval,
  });
};
