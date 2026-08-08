import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';

/**
 * M6 — Payroll data-scope enforcement (FR-M0-031 applied to the feeder).
 *
 * The BRD/PRD mandate: payroll is processed by DIFFERENT users over DIFFERENT
 * data scopes — a Comben staffer bound to the sales division processes only the
 * sales/non-staff employees; a Comben staffer bound to the pabrik/manufaktur
 * division processes only the operator-grade employees. This is ENFORCED at the
 * query level, never a UI filter.
 *
 * Resolution order (finest granularity present wins):
 *   ALL / ENTITY / COMPANY  -> whole company (no filter)
 *   CUSTOM                  -> fail closed (scope_config unimplemented)
 *   otherwise read user_scope_bindings:
 *     COMPANY binding  -> employees whose branch belongs to the company
 *     DIVISION binding -> employees whose position's department is in the division
 *     BRANCH binding   -> employees directly on the branch
 *   a DIVISION/BRANCH-granted user with NO binding rows sees NOTHING
 *   SELF -> only their own employee row
 *
 * `user_scope_bindings` (schema.prisma) is the sanctioned-but-dead table that
 * this service revives — it was never seeded nor read before M6.
 */
@Injectable()
export class PayrollScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a Prisma `employeesWhereInput` that restricts the query to the rows
   * the user may process for `permissionCode`. `permissionCode` is the
   * permission whose data_scope is being honored (e.g. 'payroll.feeder.read').
   */
  async employeeWhere(
    user: CurrentUser,
    permissionCode: string,
  ): Promise<Prisma.employeesWhereInput> {
    const dataScope = user.scopes?.[permissionCode] ?? 'SELF';

    const selfOnly = (): Prisma.employeesWhereInput => {
      if (!user.employeeId) return { id: '__denied__' }; // no employee -> no rows
      return { id: user.employeeId };
    };

    if (dataScope === 'ALL' || dataScope === 'ENTITY' || dataScope === 'COMPANY') {
      // Company-scoped payroll: the whole company is visible to the processor.
      return {};
    }
    if (dataScope === 'CUSTOM') {
      // scope_config JSON is not enforced anywhere yet — fail closed.
      return selfOnly();
    }

    const bindings = await this.prisma.user_scope_bindings.findMany({
      where: { user_id: user.userId },
      select: { scope_type: true, scope_ref_id: true },
    });
    const byType = (t: string) =>
      bindings.filter((b) => b.scope_type === t).map((b) => b.scope_ref_id);

    // Finest granularity present wins; COMPANY ⊃ DIVISION ⊃ BRANCH.
    const companies = byType('COMPANY');
    if (companies.length) return { branch: { company_id: { in: companies } } };
    const divisions = byType('DIVISION');
    if (divisions.length) {
      return { job_position: { department: { division_id: { in: divisions } } } };
    }
    const branches = byType('BRANCH');
    if (branches.length) return { branch_id: { in: branches } };

    // A DIVISION/BRANCH-granted user with NO binding rows sees nothing.
    if (dataScope === 'DIVISION' || dataScope === 'BRANCH' || dataScope === 'TEAM_TREE') {
      return selfOnly();
    }

    return selfOnly();
  }

  /** The employee ids the user may process — used to batch the aggregation. */
  async scopedEmployeeIds(user: CurrentUser, permissionCode: string): Promise<string[]> {
    const where = await this.employeeWhere(user, permissionCode);
    const rows = await this.prisma.employees.findMany({
      where,
      select: { id: true },
      orderBy: { nik: 'asc' },
    });
    return rows.map((r) => r.id);
  }

  /** Whether the user holds a company-wide payroll scope for the permission. */
  isCompanyScope(user: CurrentUser, permissionCode: string): boolean {
    const dataScope = user.scopes?.[permissionCode] ?? 'SELF';
    return dataScope === 'ALL' || dataScope === 'ENTITY' || dataScope === 'COMPANY';
  }
}
