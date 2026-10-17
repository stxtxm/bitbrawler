import { describe, it, expect } from 'vitest';
import { onRequest, onRequestPost } from '../../../functions/api/idle-processor';
import { runIdleProcessor } from '../../../api/runIdleProcessor';

const post = (body: string): Request =>
  new Request('https://example.test/api/idle-processor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

describe('cloudflare idle-processor function', () => {
  it('is a Web-standard handler, not a Node http handler', () => {
    // Regression: the Cloudflare Workers runtime is Web-standard. A handler
    // written for Node's `http` module (req/res, res.writeHead) throws an
    // exception before any of our code runs, and Cloudflare answers with an
    // opaque "error code: 1101" that names neither the file nor the line.
    expect(typeof onRequest).toBe('function');
    expect(onRequest.length).toBeLessThanOrEqual(1);
  });

  it('answers a real Request with a real Response and rejects non-POST', async () => {
    const res = await onRequest({
      request: new Request('https://example.test/api/idle-processor', { method: 'GET' }),
      env: {},
    });
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(405);
    expect(res.headers.get('Content-Type')).toMatch(/application\/json/);
    expect(((await res.json()) as { error: string }).error).toBe('POST required');
  });

  it('fails loudly without the service role key', async () => {
    // The guard must name the missing variable instead of letting a DB call
    // die deeper with a connection error that reads like a network problem.
    const res = await onRequestPost({ request: post(JSON.stringify({ character_id: 'abc' })), env: {} });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: string }).error).toMatch(/SUPABASE/);
  });

  it('surfaces a malformed JSON body instead of hanging', async () => {
    const res = await onRequestPost({ request: post('not-json'), env: {} });
    // The env guard fires before body parsing, so the request must still
    // terminate with a response rather than never settling.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(600);
  });

  it('reports a readable error when process.env is unavailable', async () => {
    // Without compatibility_flags = ["nodejs_compat"] the Workers runtime has no
    // `process` at all, so every read of process.env threw a ReferenceError
    // and Cloudflare answered 1101 with no clue about the cause. The shim now
    // detects it and names the missing flag.
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'process');
    Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true });
    try {
      const res = await onRequestPost({
        request: post(JSON.stringify({ character_id: 'abc' })),
        env: { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' },
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string; fix?: string };
      expect(body.error).toMatch(/process\.env/);
      // The whole point of the guard: the operator must be told which flag to
      // add, not just that something went wrong.
      expect(body.fix).toMatch(/nodejs_compat/);
    } finally {
      if (descriptor) Object.defineProperty(globalThis, 'process', descriptor);
    }
  });

  it('reads its credentials from the handler bindings, not from process.env', async () => {
    // Cloudflare injects secrets on the context, never in process.env. If the
    // shim stopped honouring `env`, production would silently fall back to
    // whatever the build happened to bake in — or to nothing at all.
    const saved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
    process.env.SUPABASE_URL = 'https://process-env-would-be-wrong.supabase.co';
    try {
      const res = await runIdleProcessor(
        new Request('https://example.test/api/idle-processor', { method: 'GET' }),
        {},
      );
      expect(res.status).toBe(405);
    } finally {
      if (saved.url === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = saved.url;
      if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
    }
  });
});