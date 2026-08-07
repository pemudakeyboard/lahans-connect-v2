import { CalculationTraceBuilder } from './calculation-trace';

/**
 * Calculation trace — every financial number must be provable (BRD §13 rule 5).
 * The builder keeps inputs/steps/results as strings to avoid float drift.
 */
describe('CalculationTraceBuilder', () => {
  it('records formula, inputs, steps, and result', () => {
    const trace = new CalculationTraceBuilder(new Date('2026-08-01T00:00:00Z'))
      .formulaName('OT_NON_STAFF_HOLIDAY')
      .rule('rule-1', '2026-01-01')
      .input('jamLembur', 3)
      .input('multiplier', 2)
      .step('jam_lembur × multiplier', '3.0 × 2', '6')
      .build(6);

    expect(trace.formula).toBe('OT_NON_STAFF_HOLIDAY');
    expect(trace.ruleId).toBe('rule-1');
    expect(trace.paramVersion).toBe('2026-01-01');
    expect(trace.inputs).toEqual({ jamLembur: '3', multiplier: '2' });
    expect(trace.steps[0]).toEqual({
      label: 'jam_lembur × multiplier',
      expression: '3.0 × 2',
      value: '6',
    });
    expect(trace.result).toBe('6');
    expect(trace.computedAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('series the computedAt timestamp at build time', () => {
    const trace = new CalculationTraceBuilder(new Date('2026-08-07T10:00:00Z')).build(0);
    expect(trace.computedAt).toBe('2026-08-07T10:00:00.000Z');
  });
});
