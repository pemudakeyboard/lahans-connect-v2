import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

/**
 * M0 — Approval delegation (FR-M0-060/061).
 *
 * `approval_delegations` lets a user hand their approval duties to a delegate
 * (e.g. a Comben on leave). Every approval resolution goes through here:
 *
 *   * `resolveStepAssignee` — the DIRECT_SUPERVISOR / DIVISION_HEAD /
 *     SPECIFIC_GROUP assignee is found from org structure, then checked for an
 *     active delegation; if present, the DELEGATE becomes the task's assignee
 *     and `delegated_from_user_id` records the delegator (audit trail).
 *   * `activeDelegators` — the set of users currently delegating to me, so
 *     inbox queries surface both my own tasks and the ones handed to me.
 *
 * `module_codes` is a JSON array of module codes (["ATTENDANCE"]) — empty or
 * `["*"]` covers every module. Date window is inclusive (start ≤ now ≤ end).
 *
 * ZERO HARDCODE: no policy numbers here — the delegation window is data.
 */
@Injectable()
export class DelegationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Is there an active delegation from `delegator` → `delegate` (today)? */
  async isActive(
    delegateUserId: string,
    delegatorUserId: string,
    moduleCode?: string,
  ): Promise<boolean> {
    const del = await this.prisma.approval_delegations.findFirst({
      where: {
        delegator_user_id: delegatorUserId,
        delegate_user_id: delegateUserId,
        is_active: true,
        start_date: { lte: new Date() },
        end_date: { gte: new Date() },
      },
    });
    if (!del) return false;
    return this.coversModule(del.module_codes, moduleCode);
  }

  /** All user ids currently delegating their approvals to `delegateUserId`. */
  async activeDelegators(delegateUserId: string, moduleCode?: string): Promise<string[]> {
    const rows = await this.prisma.approval_delegations.findMany({
      where: {
        delegate_user_id: delegateUserId,
        is_active: true,
        start_date: { lte: new Date() },
        end_date: { gte: new Date() },
      },
      select: { delegator_user_id: true, module_codes: true },
    });
    return rows
      .filter((r) => this.coversModule(r.module_codes, moduleCode))
      .map((r) => r.delegator_user_id);
  }

  /**
   * Delegation-aware step assignee. Returns the effective assignee plus the
   * delegate origin so the created task can record `delegated_from_user_id`.
   * Returns null when no org-structure assignee exists.
   */
  async resolveStepAssignee(
    tx: Tx,
    employeeId: string,
    step: { approver_type: string; approver_ref?: string | null },
    moduleCode?: string,
  ): Promise<{ assignee_user_id: string; delegated_from_user_id: string | null } | null> {
    const direct = await this.resolveDirect(tx, employeeId, step);
    if (!direct) return null;

    const delegation = await this.prisma.approval_delegations.findFirst({
      where: {
        delegator_user_id: direct,
        is_active: true,
        start_date: { lte: new Date() },
        end_date: { gte: new Date() },
      },
      orderBy: { created_at: 'desc' },
    });
    if (delegation && this.coversModule(delegation.module_codes, moduleCode)) {
      return {
        assignee_user_id: delegation.delegate_user_id,
        delegated_from_user_id: direct,
      };
    }
    return { assignee_user_id: direct, delegated_from_user_id: null };
  }

  /** Directive v1: shift-configuration approval is itself delegatable. */
  private coversModule(moduleCodes: Prisma.JsonValue, moduleCode?: string): boolean {
    if (!moduleCode) return true;
    if (moduleCodes == null) return true;
    const codes = Array.isArray(moduleCodes) ? (moduleCodes as string[]) : [];
    return codes.length === 0 || codes.includes('*') || codes.includes(moduleCode);
  }

  /** Org-structure assignee (the pre-delegation direct resolver). */
  private async resolveDirect(
    tx: Tx,
    employeeId: string,
    step: { approver_type: string; approver_ref?: string | null },
  ): Promise<string | null> {
    switch (step.approver_type) {
      case 'DIRECT_SUPERVISOR': {
        const line = await tx.reporting_lines.findFirst({
          where: { employee_id: employeeId, line_type: 'DIRECT', effective_to: null },
          orderBy: { effective_from: 'desc' },
        });
        if (!line) return null;
        const user = await tx.users.findFirst({
          where: { employee_id: line.supervisor_id, status: 'ACTIVE' },
        });
        return user?.id ?? null;
      }
      case 'DIVISION_HEAD': {
        const employee = await tx.employees.findUnique({
          where: { id: employeeId },
          include: {
            job_position: { include: { department: { include: { division: true } } } },
          },
        });
        const divisionId = employee?.job_position?.department?.division?.id;
        if (!divisionId) return null;
        const head = await tx.employees.findFirst({
          where: {
            job_position: { department: { division_id: divisionId } },
            is_active: true,
          },
          include: { user: true },
        });
        return head?.user?.id ?? null;
      }
      case 'SPECIFIC_GROUP': {
        if (!step.approver_ref) return null;
        const member = await tx.users.findFirst({
          where: {
            group_memberships: { some: { group: { code: step.approver_ref, is_active: true } } },
            status: 'ACTIVE',
          },
        });
        return member?.id ?? null;
      }
      default:
        return null;
    }
  }
}
