import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollScopeService } from './payroll-scope.service';
import { PayrollAggregator } from './payroll.aggregator';

/**
 * M6 — Payroll feeder (BRD §11.4).
 *
 * Providers:
 *  - PayrollService      period lifecycle + feeder ops (data-scoped)
 *  - PayrollScopeService division/branch/company binding resolution
 *  - PayrollAggregator   6-component engine (delete-then-recreate)
 *
 * ParameterService / TemporalResolver come from the @Global CoreRulesModule.
 */
@Module({
  imports: [],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollScopeService, PayrollAggregator],
  exports: [PayrollService],
})
export class PayrollModule {}
