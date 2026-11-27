import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import type { RequestOptions } from 'node:https';

const request = vi.fn();
vi.mock('node:https', () => ({ default: { request: (...args: unknown[]) => request(...args) } }));

import { githubFetch } from '@/lib/github/client';

describe('githubFetch', () => {
  it('always sends the request to api.github.com, whatever the path holds', async () => {
    request.mockImplementation((_options: RequestOptions, onResponse: (res: EventEmitter) => void) => {
      const res = Object.assign(new EventEmitter(), { statusCode: 200, statusMessage: 'OK', headers: {} });
      queueMicrotask(() => {
        onResponse(res);
        res.emit('data', Buffer.from('{}'));
        res.emit('end');
      });
      return Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn() });
    });

    const res = await githubFetch('@attacker.example/steal', { token: 'secret' });

    expect(res.status).toBe(200);
    const options = request.mock.calls[0][0] as RequestOptions;
    expect(options.hostname).toBe('api.github.com');
    expect(options.path).toBe('@attacker.example/steal');
    expect(options.headers).toMatchObject({ Authorization: 'Bearer secret' });
  });
});
