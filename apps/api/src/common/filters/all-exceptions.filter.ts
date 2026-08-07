import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { AppError } from "@cpaas/common";
import { Response } from "express";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof AppError) {
      return res.status(exception.statusCode).json({
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details ?? null,
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      return res.status(status).json({
        error: {
          code: "http_error",
          message: typeof body === "string" ? body : (body as { message?: string }).message ?? exception.message,
          details: typeof body === "object" ? body : null,
        },
      });
    }

    console.error(exception);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: "internal_error",
        message: "An unexpected error occurred",
        details: null,
      },
    });
  }
}
