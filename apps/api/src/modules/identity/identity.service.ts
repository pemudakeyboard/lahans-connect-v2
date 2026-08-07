import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * M0 — Identity administration (FR-M0-001..010).
 *
 * Manages users, groups, and group memberships. Employee records themselves are
 * managed via M1B master CRUD (employees entity).
 */
@Injectable()
export class IdentityService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: { page?: number; pageSize?: number; search?: string }) {
    const { page = 1, pageSize = 20, search } = query;
    const where: Prisma.usersWhereInput = search
      ? {
          OR: [
            { login_nik: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.users.count({ where }),
      this.prisma.users.findMany({
        where,
        select: {
          id: true,
          employee_id: true,
          login_nik: true,
          email: true,
          status: true,
          must_change_password: true,
          two_factor_enabled: true,
          last_login_at: true,
          created_at: true,
          group_memberships: { select: { group: { select: { code: true, name: true } } } },
        },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { total, page, pageSize, rows };
  }

  async getUser(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        employee_id: true,
        login_nik: true,
        email: true,
        status: true,
        must_change_password: true,
        two_factor_enabled: true,
        failed_attempts: true,
        locked_until: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
        group_memberships: { select: { group: { select: { id: true, code: true, name: true } } } },
      },
    });
    if (!user) throw new NotFoundException(`User ${userId} tidak ditemukan.`);
    return user;
  }

  async listGroups() {
    return this.prisma.user_groups.findMany({
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        is_system: true,
        requires_2fa: true,
        is_active: true,
        _count: { select: { memberships: true } },
      },
    });
  }

  /** Assign a user to a group (FR-M0-021). */
  async assignGroup(userId: string, groupId: string, actorId: string) {
    return this.prisma.user_group_members.upsert({
      where: { user_id_group_id: { user_id: userId, group_id: groupId } },
      create: { user_id: userId, group_id: groupId, assigned_by: actorId },
      update: {},
    });
  }

  async removeGroup(userId: string, groupId: string) {
    await this.prisma.user_group_members.deleteMany({
      where: { user_id: userId, group_id: groupId },
    });
    return { ok: true };
  }
}