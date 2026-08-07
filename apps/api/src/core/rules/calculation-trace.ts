/**
 * CalculationTrace — the provability backbone (BRD §13 rule 5, FR-M6-009).
 *
 * Every financial number in the feeder / payroll MUST carry a trace JSONB
 * recording: formula used, rule id, parameter version, input values, and
 * intermediate steps. The UI renders this as drill-down so Tintin (Persona 2)
 * can prove every Rupiah to her manager.
 *
 * A calculation without a trace must not be merged.
 */

export interface CalculationTraceStep {
  /** Human-readable step label, e.g. "jam_lembur × multiplier" */
  label: string;
  /** Expression fragment, e.g. "3.0 × 2" */
  expression: string;
  /** Value at this step (keep as string to avoid float drift in display) */
  value: string;
}

export interface CalculationTrace {
  /** Formula identifier, e.g. "OT_NON_STAFF_HOLIDAY" or formula_expression from payroll_components */
  formula: string;
  /** ID of the rule row that produced this result (e.g. overtime_rate_rules.id) */
  ruleId?: string;
  /** Rule version / effective_from of the parameters used */
  paramVersion?: string;
  /** Input variables consumed by the formula — key → value-as-string */
  inputs: Record<string, string>;
  /** Ordered intermediate steps */
  steps: CalculationTraceStep[];
  /** Final numeric result (string to avoid float drift) */
  result: string;
  /** ISO timestamp of when the calculation ran */
  computedAt: string;
}

export class CalculationTraceBuilder {
  private readonly steps: CalculationTraceStep[] = [];
  private readonly inputs: Record<string, string> = {};
  private formula = 'UNKNOWN';
  private ruleId?: string;
  private paramVersion?: string;

  constructor(private readonly computedAt: Date = new Date()) {}

  formulaName(name: string): this {
    this.formula = name;
    return this;
  }

  rule(ruleId: string | undefined, paramVersion?: string): this {
    this.ruleId = ruleId;
    this.paramVersion = paramVersion;
    return this;
  }

  input(name: string, value: string | number | null | undefined): this {
    this.inputs[name] = value === null || value === undefined ? '' : String(value);
    return this;
  }

  step(label: string, expression: string, value: string | number): this {
    this.steps.push({ label, expression, value: String(value) });
    return this;
  }

  build(result: string | number): CalculationTrace {
    return {
      formula: this.formula,
      ruleId: this.ruleId,
      paramVersion: this.paramVersion,
      inputs: { ...this.inputs },
      steps: [...this.steps],
      result: String(result),
      computedAt: this.computedAt.toISOString(),
    };
  }
}