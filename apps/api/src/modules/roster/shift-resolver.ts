/**
 * M2B — Shift & schedule resolution (FR-M2B-002/003).
 *
 * Pure, DB-free helpers shared by the attendance + leave modules so a roster
 * change is honored everywhere. The service layer fetches the rows; this file
 * does the *positional* math:
 *
 *   * 5-level priority ordering (individu > jabatan > golongan > cabang > entitas)
 *   * SHIFT rotation: which shift definition applies on a given date
 *     (day_index = position in the cycle, bound only by cycle_length)
 *   * night-shift date math: a MALAM shift belongs to the Indonesian day it
 *     STARTS on; its schedule instants land on the WIB day (UTC+7), and the
 *     end instant rolls to the next day.
 *
 * ZERO HARDCODE: cycle_length comes from the shift_patterns row, never a
 * literal. The work_date convention (UTC midnight of the Indonesian day) is
 * preserved unchanged.
 */

/** Concrete shift window produced by the resolver. */
export interface ShiftWindow {
  scheduleId: string | null;
  /** Shift definition code (NORMAL/PAGI/SIANG/MALAM) or null for FIXED/FLEXIBLE. */
  shiftCode: string | null;
  start_time: string | null; // "09:00" (WIB wall time)
  end_time: string | null; // "17:00" (WIB wall time; next-day if crosses midnight)
  break_minutes: number;
  late_tolerance_minutes: number;
  is_working_day: boolean;
  /** Night shift: end lands on the next Indonesian day. */
  crosses_midnight: boolean;
}

/** A schedule_assignment row (as fetched by the service). */
export interface AssignmentRow {
  /** Effective window (inclusive) — used by isAssignmentEffective. */
  effective_from: Date;
  effective_to?: Date | null;
  priority: number;
  scope_type: string;
  scope_ref_id: string;
  work_schedule: {
    id: string;
    schedule_type: string;
    shift_pattern: {
      cycle_length: number;
      rotations: RotationRow[];
    } | null;
    days?: DayRow[];
  } | null;
}

export interface RotationRow {
  day_index: number;
  is_working_day: boolean;
  shift_definition: {
    code: string;
    start_time: string | null;
    end_time: string | null;
    break_minutes: number;
    late_tolerance_minutes: number;
    crosses_midnight: boolean;
  } | null;
}

export interface DayRow {
  day_of_week: number;
  is_working_day: boolean;
  start_time: string | null;
  end_time: string | null;
  break_minutes: number;
  late_tolerance_minutes: number;
}

/** Axis for the 5-level priority (individu=1 … entitas=5), matching the assignment seeds. */
const SCOPE_PRIORITY: Record<string, number> = {
  EMPLOYEE: 1,
  POSITION: 2,
  GRADE: 3,
  BRANCH: 4,
  COMPANY: 5,
};

/** The 5 scope axes an employee can be scheduled on (FR-M2B-002/003). */
export interface EmployeeScopeRefs {
  employee_id: string;
  job_position_id?: string | null;
  job_grade_id?: string | null;
  branch_id?: string | null;
  /** The employee's company (via branch.company_id). */
  company_id?: string | null;
  /** The company's id when no branch is set (entity-level assignment). */
  entity_company_id?: string | null;
}

/**
 * Build the scope_ref list for an employee so the service can fetch every
 * schedule_assignment that could apply (individu > jabatan > golongan > cabang
 * > entitas). Null org references are skipped — an employee with no branch
 * simply has no BRANCH-level assignment to consider.
 */
export function scopeRefsFor(
  emp: EmployeeScopeRefs,
): { scope_type: string; scope_ref_id: string }[] {
  const refs: { scope_type: string; scope_ref_id: string }[] = [];
  if (emp.employee_id) refs.push({ scope_type: 'EMPLOYEE', scope_ref_id: emp.employee_id });
  if (emp.job_position_id) refs.push({ scope_type: 'POSITION', scope_ref_id: emp.job_position_id });
  if (emp.job_grade_id) refs.push({ scope_type: 'GRADE', scope_ref_id: emp.job_grade_id });
  if (emp.branch_id) refs.push({ scope_type: 'BRANCH', scope_ref_id: emp.branch_id });
  if (emp.company_id) refs.push({ scope_type: 'COMPANY', scope_ref_id: emp.company_id });
  if (emp.entity_company_id)
    refs.push({ scope_type: 'COMPANY', scope_ref_id: emp.entity_company_id });
  return refs;
}

/** Is a schedule_assignment effective on `date`? (effective window is inclusive.) */
export function isAssignmentEffective(
  a: { effective_from: Date; effective_to?: Date | null },
  date: Date,
): boolean {
  return (
    a.effective_from.getTime() <= date.getTime() &&
    (a.effective_to == null || a.effective_to.getTime() >= date.getTime())
  );
}

/**
 * Order assignments by the FR-M2B-003 priority axis. The effective-dated
 * window is already filtered by the service; this merely ranks the winner.
 * Ties break by stored `priority` then effective_from (earliest wins).
 */
export function rankAssignments(assignments: AssignmentRow[], _asOf: Date): AssignmentRow | null {
  if (assignments.length === 0) return null;
  return [...assignments].sort((a, b) => {
    const scopeA = SCOPE_PRIORITY[a.scope_type] ?? 99;
    const scopeB = SCOPE_PRIORITY[b.scope_type] ?? 99;
    if (scopeA !== scopeB) return scopeA - scopeB;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (a.work_schedule?.id ?? '').localeCompare(b.work_schedule?.id ?? '');
  })[0];
}

/**
 * Resolve the concrete shift window for a date from the winning assignment's
 * schedule. FIXED/FLEXIBLE schedules resolve via day-of-week rows; SHIFT
 * schedules resolve via the rotation cycle position.
 */
export function resolveShiftWindow(
  assignment: AssignmentRow | null,
  date: Date,
): ShiftWindow | null {
  const schedule = assignment?.work_schedule ?? null;
  if (!schedule) return null;

  // SHIFT rotation: position in the cycle.
  if (schedule.schedule_type === 'SHIFT' && schedule.shift_pattern) {
    const pattern = schedule.shift_pattern;
    const idx = dayIndexInCycle(date, pattern.cycle_length);
    const rotation = pattern.rotations.find((r) => r.day_index === idx) ?? null;
    if (!rotation) return null;
    const sd = rotation.shift_definition;
    return {
      scheduleId: schedule.id,
      shiftCode: sd?.code ?? null,
      start_time: sd?.start_time ?? null,
      end_time: sd?.end_time ?? null,
      break_minutes: sd?.break_minutes ?? 0,
      late_tolerance_minutes: sd?.late_tolerance_minutes ?? 0,
      is_working_day: sd != null && rotation.is_working_day,
      crosses_midnight: sd?.crosses_midnight ?? false,
    };
  }

  // FIXED / FLEXIBLE: day-of-week rows.
  const day = (schedule.days ?? []).find((d) => d.day_of_week === date.getUTCDay()) ?? null;
  return {
    scheduleId: schedule.id,
    shiftCode: null,
    start_time: day?.start_time ?? null,
    end_time: day?.end_time ?? null,
    break_minutes: day?.break_minutes ?? 0,
    late_tolerance_minutes: day?.late_tolerance_minutes ?? 0,
    is_working_day: day?.is_working_day ?? true,
    crosses_midnight: false,
  };
}

/**
 * Position of `date` within a rotation cycle. The cycle is anchored to a
 * fixed epoch so the sequence is deterministic across the calendar. `cycle`
 * must be ≥ 1 (column default 7).
 */
export function dayIndexInCycle(date: Date, cycle: number): number {
  const daysSinceEpoch = Math.floor(date.getTime() / 86_400_000);
  return ((daysSinceEpoch % cycle) + cycle) % cycle;
}

/**
 * Build the schedule instants (WIB wall clock) for a work date.
 *
 * The app's canonical timezone is Asia/Jakarta (UTC+7). A shift window's
 * start/end are WIB wall times; the *comparison instants* the derivation
 * needs are the real UTC instants those wall times occur on. For a night
 * shift the end belonging to the next Indonesian day is expressed as the
 * equivalent WIB wall time on the same work_date (i.e. 22:00–06:00 →
 * 22:00–30:00), so late/early minute math stays correct.
 *
 * Returns instants on the work_date's UTC scale (matching the existing
 * `ms()` helper), plus the raw wall-clock fields for display.
 */
export function shiftWindowInstants(
  window: ShiftWindow,
  workDate: Date,
): {
  startInstant: Date | null;
  endInstant: Date | null;
  /** WIB wall end time, rolled to the next day's count when crossing midnight. */
  endWallLabel: string | null;
} {
  const start = window.start_time ? wallTimeToUtc(window.start_time, workDate) : null;
  let end = window.end_time ? wallTimeToUtc(window.end_time, workDate) : null;
  let endWallLabel = window.end_time;
  if (end && window.crosses_midnight) {
    // 06:00 WIB on the next day = wall-hour 30 on today's scale.
    end = advanceWallClock(end, window.end_time!, workDate);
    endWallLabel = `${window.end_time} (esok)`;
  }
  return { startInstant: start, endInstant: end, endWallLabel };
}

/** "09:00" → 09:00 WIB on `day` as a UTC instant. */
export function wallTimeToUtc(hhmm: string, day: Date): Date {
  const [h, m] = hhmm.split(':').map(Number);
  // 09:00 WIB = 02:00 UTC. Applying the WIB offset (UTC+7, the app's canonical
  // timezone) onto the day's UTC clock. The offset is a timezone constant, not
  // a policy number.
  // eslint-disable-next-line lahans/no-magic-policy-numbers
  return new Date(day.getTime() + ((h - 7) * 60 + m) * 60_000);
}

/** Roll an end instant for a midnight-crossing shift: end wall time + 24h. */
function advanceWallClock(endInstant: Date, endWall: string, day: Date): Date {
  const base = wallTimeToUtc(endWall, day);
  return new Date(base.getTime() + 24 * 60 * 60_000);
}
