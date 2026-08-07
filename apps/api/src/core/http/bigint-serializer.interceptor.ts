import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Serializes BigInt values to strings in every JSON response.
 *
 * Prisma maps DB BIGINT columns (e.g. number_sequences.current_number,
 * audit_logs.id, loan_installments) to the JS `bigint` type, which JSON.stringify
 * cannot handle. Sequence counters can exceed Number.MAX_SAFE_INTEGER, so they
 * are exposed as strings rather than numbers (BRD §7.4 — no lossy coercion).
 */
@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => this.serialize(data)));
  }

  private serialize(value: unknown): unknown {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.serialize(v));
    }
    if (value !== null && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.serialize(v);
      }
      return out;
    }
    return value;
  }
}