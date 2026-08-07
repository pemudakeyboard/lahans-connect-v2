import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../../generated/prisma';

/**
 * Normalizes every error into the BRD 7.4 envelope:
 *   { "error": { "code": "...", "message": "...", "details": {...} } }
 *
 * Prisma known errors are mapped to stable app codes.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Terjadi kesalahan internal.';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const obj = body as { message?: string | string[]; error?: string };
        message = Array.isArray(obj.message)
          ? obj.message.join('; ')
          : (obj.message ?? obj.error ?? message);
        code = obj.error ?? `HTTP_${status}`;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      code = mapped.code;
      message = mapped.message;
      details = mapped.details;
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Data tidak valid.';
      details = exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `[${code}] ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      error: { code, message, details },
    });
  }

  private mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    // https://www.prisma.io/docs/orm/reference/error-reference
    switch (err.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: 'DUPLICATE_ENTITY',
          message: 'Data sudah ada dengan nilai yang harus unik.',
          details: { target: err.meta?.target },
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          code: 'REFERENCE_VIOLATION',
          message: 'Data masih dirujuk dan tidak dapat diubah/dihapus.',
          details: { target: err.meta?.field_name },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'ENTITY_NOT_FOUND',
          message: 'Data tidak ditemukan.',
          details: { cause: err.meta?.cause },
        };
      case 'P2014':
        return {
          status: HttpStatus.CONFLICT,
          code: 'RELATION_VIOLATION',
          message: 'Perubahan ini melanggar relasi antar data.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: 'DATABASE_ERROR',
          message: 'Gangguan basis data.',
          details: { prismaCode: err.code },
        };
    }
  }
}
