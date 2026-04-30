import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { getRequestId } from './request-id';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const requestId = getRequestId() ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : ((exceptionResponse as any).message ?? exception.message);
      code = (exceptionResponse as any).code ?? this.statusToCode(status);
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    this.logger.error(
      {
        requestId,
        statusCode: status,
        code,
        error: message,
        stack: exception instanceof Error ? exception.stack : undefined,
      },
      exception instanceof Error ? exception.message : 'Unhandled exception',
    );

    response.status(status).json({
      success: false,
      error: { code, message },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
    };
    return map[status] ?? 'ERROR';
  }
}
