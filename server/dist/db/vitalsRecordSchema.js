import { z } from 'zod';
import { SideSchema } from './schedulesSchema.js';
export const vitalsRecordSchema = z.object({
    side: SideSchema,
    timestamp: z.number().int(), // Epoch timestamp
    heart_rate: z.number().positive().nullable(),
    hrv: z.number().nonnegative().nullable(),
    rmssd: z.number().nonnegative().nullable().optional(),
    breathing_rate: z.number().positive().nullable(), // Normal breathing rate range
});
//# sourceMappingURL=vitalsRecordSchema.js.map