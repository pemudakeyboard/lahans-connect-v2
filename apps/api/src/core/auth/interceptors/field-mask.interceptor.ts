import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { CurrentUser } from '../decorators/current-user.decorator';

const MASK = '***';

/**
 * Field masking based on the user's effective masked_fields (FR-M0-040/041).
 *
 * Any property in the response whose key matches a masked field is replaced
 * with "***" at the API boundary — the value is NEVER sent to the client and
 * then hidden with CSS (that is not a security control, BRD §13 rule 7).
 *
 * Exports (Excel/PDF) must apply the same masking (FR-M0-042) — handled by
 * the export renderers, not this interceptor.
 */
@Injectable()
export class FieldMaskInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as CurrentUser | undefined;
    const masked = user?.maskedFields ?? [];
    if (masked.length === 0) return next.handle();

    return next.handle().pipe(
      map((data) => this.maskDeep(data, new Set(masked))),
    );
  }

  private maskDeep(value: unknown, masked: Set<string>, depth = 0): unknown {
    if (depth > 8) return value;
    if (Array.isArray(value)) {
      return value.map((item) => this.maskDeep(item, masked, depth + 1));
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (masked.has(k)) {
          out[k] = MASK;
        } else {
          out[k] = this.maskDeep(v, masked, depth + 1);
        }
      }
      return out;
    }
    return value;
  }
}