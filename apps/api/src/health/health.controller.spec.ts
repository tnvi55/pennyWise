import { Test } from '@nestjs/testing';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns status ok with the current time as an ISO string', () => {
    // Freeze the clock so the expected timestamp is exact.
    jest.useFakeTimers({ now: new Date('2026-10-12T09:30:00.000Z') });

    expect(controller.check()).toEqual({ status: 'ok', timestamp: '2026-10-12T09:30:00.000Z' });
  });

  it('delegates to HealthService (dependency injection)', async () => {
    const check = jest
      .fn()
      .mockReturnValue({ status: 'ok', timestamp: '2026-10-12T09:30:00.000Z' });
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { check } }],
    }).compile();

    moduleRef.get(HealthController).check();
    expect(check).toHaveBeenCalledTimes(1);
  });
});
