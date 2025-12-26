import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { correlationMiddleware } from './correlation.js';

describe('correlationMiddleware', () => {
  it('should generate correlation ID if not present', () => {
    const req = {
      headers: {},
    } as Request;

    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    correlationMiddleware(req, res, next);

    expect((req as any).correlationId).toBeDefined();
    expect(typeof (req as any).correlationId).toBe('string');
    expect(res.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      (req as any).correlationId
    );
    expect(next).toHaveBeenCalled();
  });

  it('should use existing x-correlation-id header', () => {
    const existingId = 'existing-correlation-id';
    const req = {
      headers: {
        'x-correlation-id': existingId,
      },
    } as unknown as Request;

    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    correlationMiddleware(req, res, next);

    expect((req as any).correlationId).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', existingId);
    expect(next).toHaveBeenCalled();
  });

  it('should use x-request-id header as fallback', () => {
    const requestId = 'existing-request-id';
    const req = {
      headers: {
        'x-request-id': requestId,
      },
    } as unknown as Request;

    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;

    const next = vi.fn() as NextFunction;

    correlationMiddleware(req, res, next);

    expect((req as any).correlationId).toBe(requestId);
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', requestId);
    expect(next).toHaveBeenCalled();
  });
});
