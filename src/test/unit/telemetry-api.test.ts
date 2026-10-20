import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  handleTelemetry,
  validateTelemetryPayload,
  TELEMETRY_EVENTS,
  type TelemetryEnv,
} from '../../../api/telemetry';
import { TELEMETRY_EVENTS as CLIENT_EVENTS } from '../../utils/telemetry';
import { onRequest, onRequestPost } from '../../../functions/api/telemetry';

const INSTALL = '11111111-1111-4111-8111-111111111111';
const ENV: TelemetryEnv = {
  SUPABASE_URL: 'https://abc.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

const post = (body: string, headers: Record<string, string> = {}): Request =>
  new Request('https://example.test/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });

const validBody = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    install_id: INSTALL,
    event: 'session_start',
    level: 7,
    props: { first_session: true },
    ...overrides,
  });

describe('telemetry API (#1230 part 2)', () => {
  const fetchMock = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the client and server allow-lists identical', () => {
    expect([...TELEMETRY_EVENTS]).toEqual([...CLIENT_EVENTS]);
  });

  it('stores a valid event with the service role key and answers 204', async () => {
    const res = await handleTelemetry(post(validBody()), ENV);

    expect(res.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://abc.supabase.co/rest/v1/telemetry_events');
    const headers = init?.headers as Record<string, string>;
    expect(headers.apikey).toBe('service-key');
    expect(headers.Authorization).toBe('Bearer service-key');
    expect(JSON.parse(String(init?.body))).toEqual({
      install_id: INSTALL,
      event: 'session_start',
      level: 7,
      props: { first_session: true },
    });
  });

  it('rejects non-POST requests', async () => {
    const res = await handleTelemetry(
      new Request('https://example.test/api/telemetry', { method: 'GET' }),
      ENV,
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });

  it('rejects malformed JSON', async () => {
    const res = await handleTelemetry(post('not-json'), ENV);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid json');
  });

  it('rejects an unknown event name', async () => {
    const res = await handleTelemetry(post(validBody({ event: 'character_name' })), ENV);
    expect(res.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID install id', async () => {
    const res = await handleTelemetry(post(validBody({ install_id: 'hello' })), ENV);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid install_id');
  });

  it('rejects nested or non-primitive props', async () => {
    const res = await handleTelemetry(
      post(validBody({ props: { offer: { name: 'sword' } } })),
      ENV,
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid props');
  });

  it('rejects more than eight props', async () => {
    const props = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${i}`, i]));
    const res = await handleTelemetry(post(validBody({ props })), ENV);
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range level', async () => {
    const res = await handleTelemetry(post(validBody({ level: 0 })), ENV);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe('invalid level');
  });

  it('rejects bodies over 2 KB before parsing them', async () => {
    const res = await handleTelemetry(
      post(JSON.stringify({ install_id: INSTALL, event: 'session_start', props: { note: 'x'.repeat(3000) } })),
      ENV,
    );
    expect(res.status).toBe(413);
  });

  it('fails loudly when the server credentials are missing', async () => {
    const res = await handleTelemetry(post(validBody()), {});
    expect(res.status).toBe(503);
    expect((await res.json()) as { error: string; missing: string[] }).toMatchObject({
      error: 'missing_env',
      missing: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts and drops rows while the migration is pending (PGRST205 / 404)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"code":"PGRST205"}', { status: 404 }));
    const res = await handleTelemetry(post(validBody()), ENV);
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ stored: false, reason: 'migration_pending' });
  });

  it('reports a storage failure without leaking the service key', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    const res = await handleTelemetry(post(validBody()), ENV);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string; status: number };
    expect(body.error).toBe('storage_failed');
    expect(JSON.stringify(body)).not.toContain('service-key');
  });

  it('validates payloads without touching the network', () => {
    expect(validateTelemetryPayload({ install_id: INSTALL, event: 'session_start' }).ok).toBe(true);
    expect(validateTelemetryPayload(null).ok).toBe(false);
    expect(validateTelemetryPayload({ install_id: INSTALL }).ok).toBe(false);
  });

  it('is wired as a Web-standard Pages Function', async () => {
    expect(typeof onRequest).toBe('function');
    expect(typeof onRequestPost).toBe('function');
    const res = await onRequest({
      request: new Request('https://example.test/api/telemetry', { method: 'POST', body: validBody() }),
      env: ENV,
    });
    expect(res).toBeInstanceOf(Response);
    expect(res.status).toBe(204);
  });
});
