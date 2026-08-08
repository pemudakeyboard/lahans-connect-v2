import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { RequirePermission } from '../../core/auth/decorators/require-permission.decorator';
import { MasterService } from './master.service';
import { permissionResource } from './master-registry';

/**
 * M1B — Generic Master Data CRUD (BRD §7.1).
 *
 * The controller declares the CI-gate permission `master.read` (deny-by-default
 * satisfied), then enforces the granular per-entity permission inside the handler:
 *   GET /master/{entity}        -> master.<resource>.read
 *   POST/PUT/DELETE /master/{entity} -> master.<resource>.write
 *
 * This is the only way to keep a single generic route while still enforcing
 * per-resource RBAC (BRD 5.3 (1)).
 */
@ApiTags('master')
@ApiBearerAuth()
@Controller('master')
export class MasterController {
  constructor(private readonly master: MasterService) {}

  private assertPermission(
    user: { permissions: string[] },
    resource: string,
    action: 'read' | 'write',
  ) {
    const code = `master.${resource}.${action}`;
    if (!user.permissions.includes(code)) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: `Anda tidak memiliki ${code}.` });
    }
  }

  @Get(':entity')
  @RequirePermission('master.read')
  @ApiOperation({ summary: 'Daftar master (search + paginate)' })
  list(
    @Param('entity') entity: string,
    @Query()
    query: {
      page?: number;
      pageSize?: number;
      search?: string;
      asOf?: string;
      [filter: string]: string | number | undefined;
    },
    @CurrentUser() user: { permissions: string[] },
  ) {
    this.assertPermission(user, permissionResource(entity), 'read');
    return this.master.list(entity, query);
  }

  @Get(':entity/:id')
  @RequirePermission('master.read')
  @ApiOperation({ summary: 'Detail master' })
  getOne(
    @CurrentUser() user: { permissions: string[] },
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Query('asOf') asOf?: string,
  ) {
    this.assertPermission(user, permissionResource(entity), 'read');
    return this.master.getOne(entity, id, asOf);
  }

  @Post(':entity')
  @RequirePermission('master.write')
  @ApiOperation({ summary: 'Buat master' })
  create(
    @Param('entity') entity: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { permissions: string[] },
  ) {
    this.assertPermission(user, permissionResource(entity), 'write');
    return this.master.create(entity, body);
  }

  @Put(':entity/:id')
  @RequirePermission('master.write')
  @ApiOperation({ summary: 'Perbarui master' })
  update(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser() user: { permissions: string[] },
  ) {
    this.assertPermission(user, permissionResource(entity), 'write');
    return this.master.update(entity, id, body);
  }

  @Delete(':entity/:id')
  @RequirePermission('master.write')
  @ApiOperation({ summary: 'Hapus master (soft bila ada is_active)' })
  remove(
    @Param('entity') entity: string,
    @Param('id') id: string,
    @CurrentUser() user: { permissions: string[] },
  ) {
    this.assertPermission(user, permissionResource(entity), 'write');
    return this.master.remove(entity, id);
  }

  // -- bulk actions (Ticket 03 — Nonaktifkan / Hapus) -------------------------
  // Employees use `master.employees.write` like any other write. The generic
  // per-resource permission is enforced explicitly so the two routes stay
  // "employees-only" even though the path is hardcoded.

  @Post('employees/bulk-deactivate')
  @RequirePermission('master.write')
  @ApiOperation({ summary: 'Nonaktifkan massal karyawan (status → RESIGN)' })
  bulkDeactivateEmployees(
    @Body() body: { ids: string[] },
    @CurrentUser() user: { permissions: string[] },
  ) {
    this.assertPermission(user, 'employees', 'write');
    return this.master.bulkDeactivateEmployees(body.ids);
  }

  @Post('employees/bulk-delete')
  @RequirePermission('master.write')
  @ApiOperation({ summary: 'Hapus massal karyawan (soft-delete)' })
  bulkDeleteEmployees(
    @Body() body: { ids: string[] },
    @CurrentUser() user: { permissions: string[] },
  ) {
    this.assertPermission(user, 'employees', 'write');
    return this.master.bulkDeleteEmployees(body.ids);
  }
}
