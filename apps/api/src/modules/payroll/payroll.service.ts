import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { PayrollScopeService } from './payroll-scope.service';
import { PayrollAggregator } from './payroll.aggregator';
import { CreatePayrollPeriodDto } from './dto/create-payroll-period.dto';
import { OverrideFeederLineDto } from './dto/override-feeder-line.dto';

export interface PeriodBlocker {
  code: string;
  type: string;
  detail: string;
  docNumber?: string;
  employee?: string;
}

/**
 * M6 — Payroll period lifecycle + feeder operations (BRD §11.4).
 *
 * State machine: OPEN → LOCKED → CLOSED.
 *   - open:    reject overlapping cutoff + duplicate code.
 *   - validate: return blockers (pending leave = UAT-M6-03, missing attendance,
 *               INCOMPLETE days, missing BASIC_SALARY).
 *   - lock:    validate → 409 on blockers; else aggregate the caller's scoped
 *              slice; only an ALL-scope caller flips the global status.
 *   - close:   validate → CLOSED + closed_by/at.
 *
 * Every feeder read is scoped by PayrollScopeService — a Comben user bound to
 * the SALES division sees (and can process) only the sales employees; the
 * PABRIK-bound user only the operators. Enforcement, not a UI filter.
 */
@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: PayrollScopeService,
    private readonly aggregator: PayrollAggregator,
  ) {}

  // -------------------------------------------------------------------------
  // PERIODS — list / open
  // -------------------------------------------------------------------------

  async listPeriods(user: CurrentUser, query: { page?: number; pageSize?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payroll_periods.count(),
      this.prisma.payroll_periods.findMany({
        orderBy: { cutoff_start: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { company: { select: { code: true, legal_name: true } } },
      }),
    ]);
    // Scope the period list too: a scoped user still sees the periods, but the
    // feeder contents are what's scoped. Periods are company-scoped by schema.
    return {
      total,
      page,
      pageSize,
      rows,
      scope: this.scope.isCompanyScope(user, 'payroll.period.read'),
    };
  }

  async openPeriod(user: CurrentUser, dto: CreatePayrollPeriodDto) {
    // Only company-wide (or super) payroll processors may open periods.
    if (!this.scope.isCompanyScope(user, 'payroll.period.write')) {
      throw new ForbiddenException({
        code: 'PAYROLL_SCOPE_PERIOD',
        message: 'Hanya pengelola payroll dengan cakupan perusahaan yang dapat membuka periode.',
      });
    }
    const start = new Date(dto.cutoff_start);
    const end = new Date(dto.cutoff_end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new BadRequestException('Tanggal cutoff tidak valid (start harus sebelum end).');
    }

    const company = await this.prisma.companies.findFirst({ where: { is_active: true } });
    if (!company) throw new NotFoundException('Tidak ada perusahaan aktif.');

    const dup = await this.prisma.payroll_periods.findUnique({ where: { code: dto.code } });
    if (dup) {
      throw new ConflictException({
        code: 'PERIOD_CODE_EXISTS',
        message: `Periode ${dto.code} sudah ada.`,
      });
    }
    const overlap = await this.prisma.payroll_periods.findFirst({
      where: { cutoff_start: { lte: end }, cutoff_end: { gte: start } },
    });
    if (overlap) {
      throw new ConflictException({
        code: 'PERIOD_OVERLAP',
        message: `Periode tumpang tindih dengan ${overlap.code} (${overlap.cutoff_start.toISOString().slice(0, 10)}–${overlap.cutoff_end.toISOString().slice(0, 10)}).`,
      });
    }

    return this.prisma.payroll_periods.create({
      data: {
        company_id: company.id,
        code: dto.code,
        cutoff_start: start,
        cutoff_end: end,
        payment_date: dto.payment_date ? new Date(dto.payment_date) : null,
        status: 'OPEN',
      },
    });
  }

  // -------------------------------------------------------------------------
  // VALIDATE — blockers (UAT-M6-03)
  // -------------------------------------------------------------------------

  async validatePeriod(
    user: CurrentUser,
    periodId: string,
  ): Promise<{ ok: boolean; blockers: PeriodBlocker[] }> {
    const period = await this.requirePeriod(periodId);
    const empWhere = await this.scope.employeeWhere(user, 'payroll.period.close');
    const blockers = await this.collectBlockers(period, empWhere);
    return { ok: blockers.length === 0, blockers };
  }

  private async collectBlockers(
    period: { id: string; cutoff_start: Date; cutoff_end: Date },
    empWhere: Prisma.employeesWhereInput,
  ): Promise<PeriodBlocker[]> {
    const blockers: PeriodBlocker[] = [];
    const start = period.cutoff_start;
    const end = period.cutoff_end;

    // 1. PENDING_LEAVE — pending cuti/izin overlapping the period (UAT-M6-03).
    const pendingLeaves = await this.prisma.leave_requests.findMany({
      where: {
        status: { in: ['PENDING', 'RETURNED'] },
        days: { some: { leave_date: { gte: start, lte: end } } },
        employee: empWhere,
      },
      select: { doc_number: true, employee: { select: { full_name: true, nik: true } } },
    });
    for (const l of pendingLeaves) {
      blockers.push({
        code: 'PENDING_LEAVE',
        type: 'LEAVE',
        docNumber: l.doc_number,
        employee: `${l.employee.nik} ${l.employee.full_name}`,
        detail: 'Masih ada pengajuan cuti/izin yang belum diputuskan pada periode ini.',
      });
    }

    // 2. NO_ATTENDANCE — active employees in scope with zero attendance rows.
    const scopedEmployees = await this.prisma.employees.findMany({
      where: { ...empWhere, is_active: true },
      select: { id: true, full_name: true, nik: true },
    });
    if (scopedEmployees.length > 0) {
      const withAttendance = await this.prisma.attendance_daily.findMany({
        where: {
          employee_id: { in: scopedEmployees.map((e) => e.id) },
          work_date: { gte: start, lte: end },
        },
        select: { employee_id: true },
        distinct: ['employee_id'],
      });
      const withSet = new Set(withAttendance.map((a) => a.employee_id));
      for (const e of scopedEmployees) {
        if (!withSet.has(e.id)) {
          blockers.push({
            code: 'NO_ATTENDANCE',
            type: 'ATTENDANCE',
            employee: `${e.nik} ${e.full_name}`,
            detail: 'Belum ada rekap kehadiran pada periode ini.',
          });
        }
      }

      // 3. INCOMPLETE_DAYS
      const incomplete = await this.prisma.attendance_daily.findMany({
        where: {
          employee_id: { in: scopedEmployees.map((e) => e.id) },
          work_date: { gte: start, lte: end },
          status: 'INCOMPLETE',
        },
        select: { employee_id: true, work_date: true },
      });
      for (const i of incomplete) {
        const emp = scopedEmployees.find((e) => e.id === i.employee_id);
        blockers.push({
          code: 'INCOMPLETE_DAYS',
          type: 'ATTENDANCE',
          employee: `${emp?.nik ?? ''} ${emp?.full_name ?? ''}`,
          detail: `Tanggal ${i.work_date.toISOString().slice(0, 10)} berstatus INCOMPLETE.`,
        });
      }

      // 4. NO_BASIC_SALARY
      const basic = await this.prisma.payroll_components.findUnique({
        where: { code: 'BASIC_SALARY' },
      });
      if (basic) {
        const assign = await this.prisma.employee_component_assignments.findMany({
          where: {
            employee_id: { in: scopedEmployees.map((e) => e.id) },
            payroll_component_id: basic.id,
            effective_from: { lte: end },
            OR: [{ effective_to: null }, { effective_to: { gte: end } }],
          },
          select: { employee_id: true },
          distinct: ['employee_id'],
        });
        const assignSet = new Set(assign.map((a) => a.employee_id));
        for (const e of scopedEmployees) {
          if (!assignSet.has(e.id)) {
            blockers.push({
              code: 'NO_BASIC_SALARY',
              type: 'COMPONENT',
              employee: `${e.nik} ${e.full_name}`,
              detail: 'Gaji pokok belum dikonfigurasi pada tanggal cutoff.',
            });
          }
        }
      }
    }

    return blockers;
  }

  // -------------------------------------------------------------------------
  // LOCK / CLOSE
  // -------------------------------------------------------------------------

  async lockPeriod(user: CurrentUser, periodId: string) {
    const period = await this.requirePeriod(periodId);
    if (period.status !== 'OPEN') {
      throw new ConflictException({
        code: 'PERIOD_NOT_OPEN',
        message: 'Hanya periode OPEN yang dapat dikunci.',
      });
    }

    const empWhere = await this.scope.employeeWhere(user, 'payroll.period.close');
    const blockers = await this.collectBlockers(period, empWhere);
    if (blockers.length > 0) {
      throw new ConflictException({
        code: 'PERIOD_BLOCKED',
        message: 'Periode memiliki blocker.',
        details: blockers,
      });
    }

    const scopedIds = await this.scope.scopedEmployeeIds(user, 'payroll.period.close');
    const isCompany = this.scope.isCompanyScope(user, 'payroll.period.close');

    const result = await this.prisma.$transaction(async (tx) => {
      const agg = await this.aggregator.aggregate(tx, period, scopedIds);
      if (isCompany) {
        await tx.payroll_periods.update({ where: { id: period.id }, data: { status: 'LOCKED' } });
      }
      return agg;
    });

    return {
      id: period.id,
      status: isCompany ? 'LOCKED' : period.status,
      aggregatedEmployees: result.employeeCount,
      aggregatedLines: result.lineCount,
      companyScope: isCompany,
    };
  }

  async closePeriod(user: CurrentUser, periodId: string) {
    const period = await this.requirePeriod(periodId);
    if (!['OPEN', 'LOCKED'].includes(period.status)) {
      throw new ConflictException({
        code: 'PERIOD_NOT_CLOSEABLE',
        message: 'Periode sudah ditutup atau tidak dapat ditutup.',
      });
    }

    const empWhere = await this.scope.employeeWhere(user, 'payroll.period.close');
    const blockers = await this.collectBlockers(period, empWhere);
    if (blockers.length > 0) {
      throw new ConflictException({
        code: 'PERIOD_BLOCKED',
        message: 'Periode memiliki blocker.',
        details: blockers,
      });
    }

    // Only a company-scoped processor finalizes the whole period (decision 4:
    // "ALL-scope flips global status"). A DIVISION/BRAACH-scoped Comben user may
    // validate their own slice but must NOT flip the global status.
    if (!this.scope.isCompanyScope(user, 'payroll.period.close')) {
      return { ...period, status: period.status, companyScope: false };
    }

    return this.prisma.payroll_periods.update({
      where: { id: period.id },
      data: { status: 'CLOSED', closed_by: user.userId, closed_at: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // FEEDER reads / export / override
  // -------------------------------------------------------------------------

  async listFeeder(
    user: CurrentUser,
    periodId: string,
    query: { page?: number; pageSize?: number },
  ) {
    const period = await this.requirePeriod(periodId);
    const empWhere = await this.scope.employeeWhere(user, 'payroll.feeder.read');
    const scopedIds = await this.scope.scopedEmployeeIds(user, 'payroll.feeder.read');

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.payroll_feeder_lines.count({
        where: { payroll_period_id: period.id, employee_id: { in: scopedIds } },
      }),
      this.prisma.payroll_feeder_lines.findMany({
        where: { payroll_period_id: period.id, employee_id: { in: scopedIds } },
        orderBy: [{ employee: { nik: 'asc' } }, { component_code: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { employee: { select: { nik: true, full_name: true } } },
      }),
    ]);
    void empWhere;
    return { total, page, pageSize, rows, periodStatus: period.status };
  }

  async getFeederTrace(user: CurrentUser, lineId: string) {
    // Scope check: the line's employee must be inside the user's scope.
    const line = await this.prisma.payroll_feeder_lines.findUnique({
      where: { id: lineId },
      select: {
        id: true,
        employee_id: true,
        component_code: true,
        amount: true,
        calculation_trace: true,
        is_manual_override: true,
      },
    });
    if (!line) throw new NotFoundException('Baris feeder tidak ditemukan.');
    const scope = await this.scope.employeeWhere(user, 'payroll.feeder.read');
    const inScope = await this.prisma.employees.findFirst({
      where: { id: line.employee_id, ...scope },
      select: { id: true },
    });
    if (!inScope) {
      throw new ForbiddenException({
        code: 'PAYROLL_SCOPE',
        message: 'Baris feeder di luar cakupan Anda.',
      });
    }
    return line;
  }

  async overrideFeederLine(user: CurrentUser, lineId: string, dto: OverrideFeederLineDto) {
    const line = await this.getFeederLineScoped(user, lineId);
    if (line.is_manual_override) {
      throw new ConflictException({
        code: 'ALREADY_OVERRIDDEN',
        message: 'Baris ini sudah dikoreksi manual.',
      });
    }
    return this.prisma.payroll_feeder_lines.update({
      where: { id: line.id },
      data: {
        amount: new Prisma.Decimal(dto.amount),
        is_manual_override: true,
        override_reason: dto.reason ?? null,
        overridden_by: user.userId,
      },
    });
  }

  async exportFeeder(user: CurrentUser, periodId: string): Promise<string> {
    const period = await this.requirePeriod(periodId);
    const scopedIds = await this.scope.scopedEmployeeIds(user, 'payroll.feeder.export');
    const rows = await this.prisma.payroll_feeder_lines.findMany({
      where: { payroll_period_id: period.id, employee_id: { in: scopedIds } },
      orderBy: [{ employee: { nik: 'asc' } }, { component_code: 'asc' }],
      include: { employee: { select: { nik: true, full_name: true } } },
    });
    // CSV with UTF-8 BOM so Excel renders Rupiah correctly (BRD export).
    const header = 'NIK,Nama,Komponen,Kuantitas,Amount,Manual,Trace';
    const esc = (s: string | null | undefined) => `"${(s ?? '').replaceAll('"', '""')}"`;
    const body = rows
      .map((r) =>
        [
          esc(r.employee.nik),
          esc(r.employee.full_name),
          esc(r.component_code),
          r.quantity?.toString() ?? '',
          r.amount?.toString() ?? '',
          r.is_manual_override ? 'Y' : 'N',
          esc(r.calculation_trace ? JSON.stringify(r.calculation_trace) : ''),
        ].join(','),
      )
      .join('\n');
    // UTF-8 BOM (U+FEFF) so Excel detects UTF-8 and renders Rupiah correctly.
    return '\uFEFF' + header + '\n' + body;
  }

  // -------------------------------------------------------------------------
  // INTERNAL
  // -------------------------------------------------------------------------

  private async requirePeriod(periodId: string) {
    const period = await this.prisma.payroll_periods.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException('Periode penggajian tidak ditemukan.');
    return period;
  }

  private async getFeederLineScoped(user: CurrentUser, lineId: string) {
    const line = await this.prisma.payroll_feeder_lines.findUnique({ where: { id: lineId } });
    if (!line) throw new NotFoundException('Baris feeder tidak ditemukan.');
    const scope = await this.scope.employeeWhere(user, 'payroll.feeder.override');
    const inScope = await this.prisma.employees.findFirst({
      where: { id: line.employee_id, ...scope },
      select: { id: true },
    });
    if (!inScope) {
      throw new ForbiddenException({
        code: 'PAYROLL_SCOPE',
        message: 'Baris feeder di luar cakupan Anda.',
      });
    }
    return line;
  }
}
