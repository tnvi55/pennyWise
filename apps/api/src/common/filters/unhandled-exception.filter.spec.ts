import type { ArgumentsHost } from '@nestjs/common';
import { Logger, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { UnhandledExceptionFilter } from './unhandled-exception.filter';

function httpHost(): { host: ArgumentsHost; status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('UnhandledExceptionFilter', () => {
  const filter = new UnhandledExceptionFilter();

  let logError: jest.SpyInstance;

  beforeEach(() => {
    jest.restoreAllMocks();
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('answers an unexpected error with a generic 500 in the documented shape', () => {
    const { host, status, json } = httpHost();

    filter.catch(new Error('relation "categories" does not exist (SQL detail)'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  });

  it('logs the real error on the server only', () => {
    const { host, json } = httpHost();

    filter.catch(new Error('database connection lost'), host);

    expect(logError).toHaveBeenCalledWith(expect.stringContaining('database connection lost'));
    expect(JSON.stringify(json.mock.calls)).not.toContain('database connection lost');
  });

  it("leaves HttpExceptions to Nest's normal handling", () => {
    const parentCatch = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
    const { host, status } = httpHost();
    const notFound = new NotFoundException('Category x not found');

    filter.catch(notFound, host);

    expect(parentCatch).toHaveBeenCalledWith(notFound, host);
    expect(status).not.toHaveBeenCalled();
  });
});
