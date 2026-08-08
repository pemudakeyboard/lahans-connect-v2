import { deriveDailyFields, DerivationInput } from './attendance-derivation';

/**
 * S6 — Pure derivation logic (FR-M2-001..004).
 *
 * The status ladder and minute math are the risky part of attendance; these
 * tests lock the behavior with no DB involved. Policy numbers are deliberately
 * absent — every minute comes from the schedule day.
 */

const WORKDAY = new Date('2026-08-06T00:00:00.000Z');
const SCHED = {
  start_time: '09:00',
  end_time: '17:00',
  break_minutes: 60,
  late_tolerance_minutes: 0,
  is_working_day: true,
};

const base = (over: Partial<DerivationInput> = {}): DerivationInput => ({
  date: WORKDAY,
  scheduleDay: SCHED,
  isHoliday: false,
  firstIn: null,
  lastOut: null,
  hasAnyLog: false,
  isPast: true,
  anomalyCodes: [],
  ...over,
});

describe('deriveDailyFields', () => {
  it('HADIR when on time in+out', () => {
    const r = deriveDailyFields(
      base({
        firstIn: new Date('2026-08-06T09:00:00.000Z'),
        lastOut: new Date('2026-08-06T17:00:00.000Z'),
        hasAnyLog: true,
        isPast: false,
      }),
    );
    expect(r.status).toBe('HADIR');
    expect(r.late_minutes).toBe(0);
    expect(r.early_leave_minutes).toBe(0);
    // 8h - 60min break = 7h = 420 minutes
    expect(r.work_minutes).toBe(420);
    expect(r.overtime_minutes).toBe(0);
  });

  it('TERLAMBAT when in after start (tolerance 0)', () => {
    const r = deriveDailyFields(
      base({
        firstIn: new Date('2026-08-06T09:10:00.000Z'),
        lastOut: new Date('2026-08-06T17:00:00.000Z'),
        hasAnyLog: true,
        isPast: false,
      }),
    );
    expect(r.status).toBe('TERLAMBAT');
    expect(r.late_minutes).toBe(10);
  });

  it('late tolerance reduces late minutes (but a positive remainder still marks TERLAMBAT)', () => {
    const r = deriveDailyFields(
      base({
        scheduleDay: { ...SCHED, late_tolerance_minutes: 5 },
        firstIn: new Date('2026-08-06T09:08:00.000Z'),
        lastOut: new Date('2026-08-06T17:00:00.000Z'),
        hasAnyLog: true,
        isPast: false,
      }),
    );
    // 8 min late - 5 min tolerance = 3 min late → still TERLAMBAT
    expect(r.late_minutes).toBe(3);
    expect(r.status).toBe('TERLAMBAT');
  });

  it('tolerance ≥ lateness → HADIR (no late minutes)', () => {
    const r = deriveDailyFields(
      base({
        scheduleDay: { ...SCHED, late_tolerance_minutes: 10 },
        firstIn: new Date('2026-08-06T09:08:00.000Z'),
        lastOut: new Date('2026-08-06T17:00:00.000Z'),
        hasAnyLog: true,
        isPast: false,
      }),
    );
    expect(r.late_minutes).toBe(0);
    expect(r.status).toBe('HADIR');
  });

  it('PULANG_CEPAT when out before end', () => {
    const r = deriveDailyFields(
      base({
        firstIn: new Date('2026-08-06T09:00:00.000Z'),
        lastOut: new Date('2026-08-06T16:30:00.000Z'),
        hasAnyLog: true,
        isPast: false,
      }),
    );
    expect(r.status).toBe('PULANG_CEPAT');
    expect(r.early_leave_minutes).toBe(30);
  });

  it('TERLAMBAT wins over PULANG_CEPAT when both ≥ threshold', () => {
    const r = deriveDailyFields(
      base({
        firstIn: new Date('2026-08-06T09:10:00.000Z'),
        lastOut: new Date('2026-08-06T16:30:00.000Z'),
        hasAnyLog: true,
        isPast: false,
      }),
    );
    expect(r.status).toBe('TERLAMBAT');
    expect(r.late_minutes).toBe(10);
    expect(r.early_leave_minutes).toBe(30);
  });

  it('INCOMPLETE when only IN (no OUT)', () => {
    const r = deriveDailyFields(
      base({
        firstIn: new Date('2026-08-06T09:00:00.000Z'),
        hasAnyLog: true,
        isPast: false,
      }),
    );
    expect(r.status).toBe('INCOMPLETE');
    expect(r.work_minutes).toBe(0);
  });

  it('ALPHA when no logs and date is past', () => {
    const r = deriveDailyFields(base({})); // no logs, isPast true
    expect(r.status).toBe('ALPHA');
  });

  it('no logs on a future date stays INCOMPLETE (not yet settled)', () => {
    const r = deriveDailyFields(base({ isPast: false }));
    expect(r.status).toBe('INCOMPLETE');
  });

  it('LIBUR on a holiday', () => {
    const r = deriveDailyFields(base({ isHoliday: true, firstIn: null, lastOut: null }));
    expect(r.status).toBe('LIBUR');
    expect(r.work_minutes).toBe(0);
  });

  it('LIBUR on a non-working day', () => {
    const r = deriveDailyFields(base({ scheduleDay: { ...SCHED, is_working_day: false } }));
    expect(r.status).toBe('LIBUR');
  });

  it('no schedule → treated as working day with NO_SCHEDULE anomaly', () => {
    const r = deriveDailyFields(base({ scheduleDay: null }));
    expect(r.status).toBe('ALPHA'); // isPast, no logs
    expect(r.is_anomaly).toBe(true);
    expect(r.anomaly_reasons).toContain('NO_SCHEDULE');
  });

  it('anomaly codes pass through', () => {
    const r = deriveDailyFields(
      base({
        firstIn: new Date('2026-08-06T09:00:00.000Z'),
        lastOut: new Date('2026-08-06T17:00:00.000Z'),
        hasAnyLog: true,
        isPast: false,
        anomalyCodes: ['OUT_OF_ZONE', 'MOCK_LOCATION'],
      }),
    );
    expect(r.is_anomaly).toBe(true);
    expect(r.anomaly_reasons).toEqual(['OUT_OF_ZONE', 'MOCK_LOCATION']);
  });

  it('work minutes subtract the break', () => {
    const r = deriveDailyFields(
      base({
        firstIn: new Date('2026-08-06T09:00:00.000Z'),
        lastOut: new Date('2026-08-06T18:00:00.000Z'),
        hasAnyLog: true,
        isPast: false,
      }),
    );
    // 9h window - 60min break = 8h = 480 minutes
    expect(r.work_minutes).toBe(480);
  });
});
