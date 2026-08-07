import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Prisma } from '../../generated/prisma';

/**
 * Append-only audit trail (BRD 6.1, G5, FR-M0-062).
 *
 * Captures a mutating request (POST/PATCH/PUT/DELETE) into audit_logs with
 * actor, action, entity, before/after JSON, IP, user-agent. audit_logs is
 * APPEND-ONLY at the DB level (REVOKE UPDATE/DELETE) — row-level before/after
 * diffs for large entities should be handled by domain services; this
 * interceptor records the request-level fact.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method: string = request?.method ?? 'GET';

    const isMutating = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
    if (!isMutating) return next.handle();

    const user = request.user as CurrentUser | undefined;
    const entityName = request.route?.path ?? context.getClass()?.name ?? 'unknown';

    return next.handle().pipe(
      tap({
        next: async () => {
          try {
            await this.prisma.audit_logs.create({
              data: {
                actor_user_id: user?.userId ?? null,
                action: `${method}_${entityName}`,
                entity_name: entityName,
                ip_address: request.ip,
                user_agent: request.headers?.['user-agent'],
                request_id: request.headers?.['x-request-id'],
                after_data: this.sanitize(request.body),
              },
            });
          } catch (err) {
            // Audit must never break the business request.
            console.error('[audit] failed to write audit_log', err);
          }
        },
      }),
    );
  }

  private sanitize(body: unknown): Prisma.InputJsonValue | undefined {
    if (!body || typeof body !== 'object') return undefined;
    const obj = body as Record<string, unknown>;
    const clone: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.toLowerCase().includes('password') || k.toLowerCase().includes('secret')) continue;
      clone[k] = v;
    }
    return clone as Prisma.InputJsonValue;
  }
}
