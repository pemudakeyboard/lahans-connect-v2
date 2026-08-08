import { BadRequestException } from '@nestjs/common';
import { MasterService } from './master.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Unit tests for MasterService bulk employee actions (Ticket 03 — Nonaktifkan /
 * Hapus massal on the employee list). Locks the batch semantics: only ACTIVE
 * rows are touched, RESIGN carries resign_date, delete is a soft-delete via
 * is_active=false (referential integrity preserved).
 */

const makeService = () => {
  const updateMany = jest.fn();
  const prisma = {
    employees: { updateMany },
  } as unknown as PrismaService;
  const svc = new MasterService(prisma);
  return { svc, updateMany };
};

describe('MasterService bulk employees', () => {
  it('deactivates active employees → RESIGN + resign_date + is_active=false', async () => {
    const { svc, updateMany } = makeService();
    updateMany.mockResolvedValue({ count: 2 });
    const res = await svc.bulkDeactivateEmployees(['a', 'b']);
    expect(res).toEqual({ deactivated: 2 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] }, is_active: true },
      data: expect.objectContaining({
        employment_status: 'RESIGN',
        is_active: false,
        resign_date: expect.any(Date),
      }),
    });
  });

  it('soft-deletes active employees (is_active=false) without touching status', async () => {
    const { svc, updateMany } = makeService();
    updateMany.mockResolvedValue({ count: 1 });
    const res = await svc.bulkDeleteEmployees(['a']);
    expect(res).toEqual({ deleted: 1 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a'] }, is_active: true },
      data: { is_active: false },
    });
  });

  it('rejects an empty id list with BULK_EMPTY', async () => {
    const { svc, updateMany } = makeService();
    await expect(svc.bulkDeactivateEmployees([])).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.bulkDeleteEmployees([])).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('deduplicates ids and ignores non-string entries', async () => {
    const { svc, updateMany } = makeService();
    updateMany.mockResolvedValue({ count: 1 });
    const res = await svc.bulkDeleteEmployees(['x', 'x', '', 42 as unknown as string]);
    expect(res).toEqual({ deleted: 1 });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['x'] }, is_active: true } }),
    );
  });
});
