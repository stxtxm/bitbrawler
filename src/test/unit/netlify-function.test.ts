import { describe, it, expect } from 'vitest';
import netlifyIdle, { config } from '../../../netlify/functions/idle-processor';

interface Captured {
  statusCode: number;
  body: string;
}

function mockRes(): Captured & {
  writeHead: (code: number, headers?: Record<string, string>) => unknown;
  end: (body?: string) => unknown;
} {
  const res = {
    statusCode: 0,
    body: '',
    writeHead(code: number) {
      res.statusCode = code;
      return res;
    },
    end(body?: string) {
      res.body = body ?? '';
      return res;
    },
  };
  return res;
}

const handler = netlifyIdle as unknown as (req: unknown, res: unknown) => Promise<void>;

describe('netlify idle-processor function', () => {
  it('keeps the public path identical to the old Vercel route', () => {
    // cron-job.org and the client both call /api/idle-processor, so moving
    // hosts must not change the path.
    expect(config.path).toBe('/api/idle-processor');
  });

  it('rejects non-POST requests before touching the database', async () => {
    const res = mockRes();
    await handler({ method: 'GET' }, res);
    expect(res.statusCode).toBe(405);
    expect(JSON.parse(res.body).error).toBe('POST required');
  });

  it('fails loudly when the service role env vars are absent', async () => {
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const res = mockRes();
      await handler({ method: 'POST', on: (_event: string, cb: () => void) => cb() }, res);
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).error).toMatch(/SUPABASE/);
    } finally {
      if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
      if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    }
  });
});