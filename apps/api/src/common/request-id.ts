import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';

const als = new AsyncLocalStorage<{ requestId: string }>();

/**
 * Generate a short, unique request ID for tracing.
 * Format: req_<timestamp_base36>_<6 random hex chars>
 */
export function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = randomBytes(3).toString('hex');
  return `req_${ts}_${rand}`;
}

/**
 * Get the current request ID from async context.
 * Returns 'no-req' when called outside of a request scope (e.g. startup, scheduled jobs).
 */
export function getRequestId(): string {
  const ctx = als.getStore();
  return ctx?.requestId ?? 'no-req';
}

/**
 * NestJS interceptor that assigns a unique request ID to every incoming HTTP request.
 * The ID is set on `request.requestId` and is available in async context
 * via `getRequestId()` throughout the request lifecycle.
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const requestId = generateRequestId();
    const request = context.switchToHttp().getRequest();
    request.requestId = requestId;

    return new Observable<unknown>((subscriber) => {
      als.run({ requestId }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
