// All temperatures are stored internally in Fahrenheit. This module is
// the display layer — it formats an F value into the user's chosen format
// ('fahrenheit' or 'level').
//
// 'level' is the -10..+10 scale used by the official Pod app: -10 is the
// coldest setting (55°F), 0 is neutral (~82.5°F), +10 is the warmest
// setting (110°F). The mapping is linear.

export type TemperatureFormat = 'fahrenheit' | 'level';

export const MIN_TEMP_F = 55;
export const MAX_TEMP_F = 110;
const NEUTRAL_F = 82.5;            // F at level 0
const F_PER_LEVEL = 27.5 / 10;     // 2.75°F per level step

// Level-format bounds (Pod-app -10..+10 scale)
export const MIN_TEMP_LEVEL = -10;
export const MAX_TEMP_LEVEL = 10;

// Legacy C bounds — kept so existing ScheduleChart code still imports cleanly,
// but the values now mirror the level scale since Celsius display is gone.
export const MIN_TEMP_C = MIN_TEMP_LEVEL;
export const MAX_TEMP_C = MAX_TEMP_LEVEL;

export function fahrenheitToLevel(f: number): number {
  return Math.round((f - NEUTRAL_F) / F_PER_LEVEL);
}

export function levelToFahrenheit(level: number): number {
  return Math.round(level * F_PER_LEVEL + NEUTRAL_F);
}

// Kept for backwards compat; nothing in the UI uses Celsius anymore.
export function farenheitToCelcius(farenheit: number): number {
  const celcius = (farenheit - 32) * 5 / 9;
  return Math.round(celcius * 2) / 2;
}

/**
 * Format a Fahrenheit value for display.
 *
 * @param temperature  Internal Fahrenheit value
 * @param format       User's chosen display format
 */
export function formatTemperature(
  temperature: number,
  format: TemperatureFormat | boolean,
): string {
  // Backwards compat: previous signature was (f, isCelsius: boolean).
  // True/false maps to 'level'/'fahrenheit' so old callers still work
  // until they're migrated. The 'true' branch used to mean Celsius;
  // now treats it as 'level' — Celsius is gone from the UI.
  const fmt: TemperatureFormat =
    typeof format === 'boolean' ? (format ? 'level' : 'fahrenheit') : format;

  if (fmt === 'level') {
    const level = fahrenheitToLevel(temperature);
    const sign = level > 0 ? '+' : '';
    return `${sign}${level}`;
  }
  return `${Math.round(temperature)}°F`;
}

export function getTemperatureColor(tempF: number | undefined): string {
  if (tempF === undefined) return '#262626';
  if (tempF <= 70) return '#2196f3';
  if (tempF <= 82) return '#5393ff';
  if (tempF <= 95) return '#db5858';
  return '#d32f2f';
}

