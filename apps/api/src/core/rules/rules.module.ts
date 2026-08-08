import { Module, Global } from '@nestjs/common';
import { ParameterService } from '../config/parameter.service';
import { TemporalResolver } from '../temporal/temporal-resolver';

/**
 * CoreRulesModule — wires the domain-rule infrastructure into DI.
 *
 * These two services back the repo's hard rules (BRD §13):
 *   - ParameterService: every policy number read from system_parameters with an
 *     asOf date (zero hardcode).
 *   - TemporalResolver: every Class A/B effective-dated read with an asOf date.
 *
 * They were previously defined but provided by NO module — a domain module could
 * not inject them. This @Global module makes them injectable anywhere.
 *
 * CalculationTraceBuilder is intentionally NOT a provider: it is a stateful
 * builder meant to be instantiated fresh per calculation (`new
 * CalculationTraceBuilder().formulaName(...)...build(result)`), so domain code
 * creates it directly rather than injecting a shared singleton.
 */
@Global()
@Module({
  providers: [ParameterService, TemporalResolver],
  exports: [ParameterService, TemporalResolver],
})
export class CoreRulesModule {}
