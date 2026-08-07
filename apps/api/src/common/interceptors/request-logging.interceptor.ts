import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { createLogger } from "@cpaas/logger";

const logger = createLogger("http");

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      ip?: string;
      headers: Record<string, string | undefined>;
    }>();
    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse<{ statusCode: number }>();
          logger.info("request", {
            method: req.method,
            path: req.url,
            status: res.statusCode,
            latencyMs: Date.now() - started,
            ip: req.ip,
            requestId: req.headers["x-request-id"],
          });
        },
        error: (err: Error) => {
          logger.error("request_error", {
            method: req.method,
            path: req.url,
            latencyMs: Date.now() - started,
            error: err.message,
          });
        },
      })
    );
  }
}
