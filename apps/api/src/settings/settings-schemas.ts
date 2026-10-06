// Validation for the desk's business-hours settings.
import { z } from 'zod';

/** A zone Intl accepts, but not a bare UTC offset such as +05:00. */
export function isIanaTimeZone(value: string): boolean {
  if (/^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const hour = z.number().int().min(0).max(24);

export const businessHoursSchema = z
  .object({
    openHour: hour,
    closeHour: hour,
    timeZone: z.string().refine(isIanaTimeZone, 'Time zone must be a valid IANA zone'),
    slaHours: z.number().int().min(1),
  })
  .refine((settings) => settings.openHour < settings.closeHour, {
    path: ['openHour'],
    message: 'Opening hour must be before the closing hour',
  });
