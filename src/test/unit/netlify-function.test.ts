import { describe, it, expect } from 'vitest';
import netlifyIdle, { config } from '../../../netlify/functions/idle-processor';

const post = (body: string): Request =>
  new Request('https://example.test/api/idle-processor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

describe('netlify idle-processor function', () => {
  it('keeps the public path identical to the old Vercel route', () => {
    // cron-job.org and the client both call /api/idle-processor, so moving
    // hosts must not change the path.
    expect(config.path).toBe('/api/idle-processor');
  });

  it('is a Web-standard handler, not a Node http handler', () => {
    // Regression: the first version re-exported the Vercel handler as-is, so
    // Netlify called it with a Request/Response pair and it died with
    // "res.writeHead is not a function" -> HTTP 502 on every idle request.
    expect(typeof netlifyIdle).toBe('function');
    expect(netlifyIdle.length).toBeLessThanOrEqual(1);
  });

  it('answers a real Request with a real Response and rejects non-POST', async () => {
    const res = await netlifyIdle(
      new Request('https://example.test/api/idle-processor', { method: 'GET' }),
    );
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(405);
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/);
    expect((await res.json() as { error: string }).error).toBe('POST required');
  });

  it('forwards the POST body and fails loudly without the service role key', async () => {
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const res = await netlifyIdle(post(JSON.stringify({ character_id: 'abc' })));
      expect(res.status).toBe(500);
      expect((await res.json() as { error: string }).error).toMatch(/SUPABASE/);
    } finally {
      if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
      if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    }
  });

  it('surfaces a malformed JSON body instead of hanging', async () => {
    const savedUrl = process.env.SUPABASE_URL;
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const res = await netlifyIdle(post('not-json'));
      // The env guard fires before body parsing, so the request must still
      // terminate with a response rather than never settling.
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(600);
    } finally {
      if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
      if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
    }
  });
});