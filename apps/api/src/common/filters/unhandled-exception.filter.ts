import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Response } from 'express';

/**
 * Last-resort handler. HttpExceptions (400, 404, 409, ...) keep Nest's normal
 * { statusCode, error, message } body. Anything else - a bug, a lost database
 * connection, an unmapped Prisma error - is logged on the server and answered with
 * a generic 500 in the same shape, so no stack trace or SQL detail reaches the client.
 */
@Catch()
export class UnhandledExceptionFilter extends BaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }

    this.logger.error(
      exception instanceof Error ? (exception.stack ?? exception.message) : exception,
    );
    const response = host.switchToHttp().getResponse<Response>();
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  }
}
