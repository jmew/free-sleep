import { z } from 'zod';
import { TIME_ZONES } from './timeZones.js';
import { TimeSchema } from './schedulesSchema.js';
// 'level' is the -10..+10 scale used by the official Pod app
// (where -10 = coldest, 0 = neutral, +10 = warmest). Maps linearly to F
// internally; display-only.
export const TEMPERATURES = ['level', 'fahrenheit'];
const Temperatures = z.enum(TEMPERATURES);
const TemperatureTapConfig = z.object({
    type: z.literal('temperature'),
    change: z.enum(['increment', 'decrement']),
    amount: z.number().min(0).max(10),
});
const AlarmTapConfig = z.object({
    type: z.literal('alarm'),
    behavior: z.enum(['snooze', 'dismiss']),
    snoozeDuration: z.number().min(60).max(600),
    inactiveAlarmBehavior: z.enum(['power', 'none'])
});
const BaseControlTapConfig = z.object({
    type: z.literal('base_control'),
    behavior: z.literal('toggle_preset'),
});
export const TapConfig = z.discriminatedUnion('type', [
    TemperatureTapConfig,
    AlarmTapConfig,
    BaseControlTapConfig
]);
export const GestureSchema = z.enum(['doubleTap', 'tripleTap', 'quadTap']);
// One-off alarm: fires once at fireAt then disables itself. Independent of
// the recurring per-day-of-week alarm. fireAt is an ISO 8601 datetime
// including offset, e.g. "2026-04-30T07:00:00-07:00".
const OneOffAlarmSchema = z.object({
    enabled: z.boolean(),
    fireAt: z.string(),
    vibrationIntensity: z.number().int().min(1).max(100),
    vibrationPattern: z.enum(['double', 'rise']),
    duration: z.number().int().min(0).max(180),
});
const SideSettingsSchema = z.object({
    name: z.string().min(1).max(20),
    awayMode: z.boolean(),
    scheduleOverrides: z.object({
        temperatureSchedules: z.object({
            disabled: z.boolean(),
            expiresAt: z.string(),
        }),
        alarm: z.object({
            disabled: z.boolean(),
            timeOverride: z.string(),
            expiresAt: z.string(),
        })
    }),
    oneOffAlarm: OneOffAlarmSchema,
    taps: z.object({
        doubleTap: TapConfig,
        tripleTap: TapConfig,
        quadTap: TapConfig,
    })
}).strict();
export const SettingsSchema = z.object({
    id: z.string(),
    timeZone: z.enum(TIME_ZONES),
    left: SideSettingsSchema,
    right: SideSettingsSchema,
    primePodDaily: z.object({
        enabled: z.boolean(),
        time: TimeSchema,
    }),
    temperatureFormat: Temperatures,
    rebootDaily: z.boolean(),
}).strict();
//# sourceMappingURL=settingsSchema.js.map