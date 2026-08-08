/**
 * S6 — Attendance daily derivation (BRD §6.4, FR-M2-001..004).
 *
 * Pure, DB-free computation of the derived `attendance_daily` fields from a
 * resolved schedule day + the day's clock logs. Kept free of Prisma so it is
 * trivially unit-testable.
 *
 * ZERO HARDCODE: no policy numbers appear here — the schedule (start/end/break/
 * tolerance) drives every minute, and geofence radius is resolved by the service
 * from system_parameters. `overtime_minutes` is always 0 in Phase 6: overtime is
 * computed from APPROVED overtime_requests by the overtime module, not derived.
 */

/** A single resolved schedule day (or null when no schedule could be resolved). */
export interface DerivationScheduleDay {
  start_time: string | null; // "09:00"
  end_time: string | null; // "17:00"
  break_minutes: number;
  late_tolerance_minutes: number;
  is_working_day: boolean;
}

export interface DerivationInput {
  /** work_date (UTC midnight). */
  date: Date;
  scheduleDay: DerivationScheduleDay | null;
  isHoliday: boolean;
  firstIn: Date | null;
  lastOut: Date | null;
  hasAnyLog: boolean;
  /** Whether the date is in the past (so a no-show settles as ALPHA). */
  isPast: boolean;
  /** Presence/anomaly codes (OUT_OF_ZONE, MOCK_LOCATION, NO_GEOFENCE_DATA, …). */
  anomalyCodes: string[];
}

export interface DerivationResult {
  status: string;
  late_minutes: number;
  early_leave_minutes: number;
  work_minutes: number;
  overtime_minutes: number;
  is_anomaly: boolean;
  anomaly_reasons: string[] | null;
}

/** Parse "09:00" into a UTC Date on the given work_date. */
function ms(hhmm: string, date: Date): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), h || 0, m || 0),
  );
}

const asMinutes = (a: Date, b: Date) => {
  const diff = (a.getTime() - b.getTime()) / 60000;
  return Math.round(diff);
};

export function deriveDailyFields(input: DerivationInput): DerivationResult {
  const { date, scheduleDay, isHoliday, firstIn, lastOut, hasAnyLog, isPast, anomalyCodes } = input;
  const anomalies = [...anomalyCodes];

  // No schedule resolved → treat the day as a working day (so ALPHA can still
  // fire) but flag it for Comben to verify (FR-M2-011).
  const isWorking = scheduleDay?.is_working_day ?? scheduleDay === null;
  if (scheduleDay === null) anomalies.push('NO_SCHEDULE');

  const isLibur = !isWorking || isHoliday;
  if (isLibur) {
    return {
      status: 'LIBUR',
      late_minutes: 0,
      early_leave_minutes: 0,
      work_minutes: 0,
      overtime_minutes: 0,
      is_anomaly: anomalies.length > 0,
      anomaly_reasons: anomalies.length > 0 ? anomalies : null,
    };
  }

  const start = scheduleDay?.start_time ? ms(scheduleDay.start_time, date) : null;
  const end = scheduleDay?.end_time ? ms(scheduleDay.end_time, date) : null;
  const breakMinutes = scheduleDay?.break_minutes ?? 0;
  const tolerance = scheduleDay?.late_tolerance_minutes ?? 0;

  const late = firstIn && start ? Math.max(0, asMinutes(firstIn, start) - tolerance) : 0;
  const early = lastOut && end ? Math.max(0, asMinutes(end, lastOut)) : 0;
  const work = firstIn && lastOut ? Math.max(0, asMinutes(lastOut, firstIn) - breakMinutes) : 0;

  let status: string;
  if (!hasAnyLog && isPast) {
    status = 'ALPHA';
  } else if (!firstIn || !lastOut) {
    status = 'INCOMPLETE';
  } else if (late > 0) {
    status = 'TERLAMBAT';
  } else if (early > 0) {
    status = 'PULANG_CEPAT';
  } else {
    status = 'HADIR';
  }

  return {
    status,
    late_minutes: late,
    early_leave_minutes: early,
    work_minutes: work,
    overtime_minutes: 0,
    is_anomaly: anomalies.length > 0,
    anomaly_reasons: anomalies.length > 0 ? anomalies : null,
  };
}
