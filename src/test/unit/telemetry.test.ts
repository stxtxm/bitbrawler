import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initTelemetry,
  trackEvent,
  trackFightOutcome,
  setTelemetryEnabled,
  isTelemetryEnabled,
  getTelemetryPreference,
  setTelemetryLevel,
  getTelemetryInstallId,
  __setTelemetryAvailableForTests,
  __setTelemetryTransport,
  __resetTelemetrySessionForTests,
  TELEMETRY_STORAGE_KEY,
  WALL_LOSS_STREAK,
  type TelemetryTransport,
} from '../../utils/telemetry';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Captured {
  url: string;
  body: {
    install_id: string;
    event: string;
    level?: number;
    props: Record<string, string | number | boolean>;
  };
  beacon: boolean;
}

const capture = (): Captured[] => {
  const sent: Captured[] = [];
  const transport: TelemetryTransport = (url, body, beacon) => {
    sent.push({ url, body: JSON.parse(body) as Captured['body'], beacon });
  };
  __setTelemetryTransport(transport);
  return sent;
};

const events = (sent: Captured[], name: string): Captured[] =>
  sent.filter((entry) => entry.body.event === name);

describe('telemetry client (#1230 part 2)', () => {
  beforeEach(() => {
    __resetTelemetrySessionForTests();
    localStorage.clear();
    __setTelemetryAvailableForTests(true);
  });

  afterEach(() => {
    __resetTelemetrySessionForTests();
    localStorage.clear();
  });

  it('is inert outside production builds (no dev noise in the dataset)', () => {
    const sent = capture();
    __setTelemetryAvailableForTests(null);
    initTelemetry();
    trackEvent('level_up', { from: 1, to: 2 });
    expect(sent).toHaveLength(0);
    expect(isTelemetryEnabled()).toBe(false);
  });

  it('sends exactly one session_start per page load and persists the install id', () => {
    const sent = capture();
    initTelemetry();
    initTelemetry();

    expect(sent).toHaveLength(1);
    expect(sent[0].body.event).toBe('session_start');
    expect(sent[0].body.props.first_session).toBe(true);
    expect(sent[0].url).toBe('/api/telemetry');

    const installId = getTelemetryInstallId();
    expect(installId).toMatch(UUID_RE);
    expect(sent[0].body.install_id).toBe(installId);

    const stored = JSON.parse(localStorage.getItem(TELEMETRY_STORAGE_KEY) ?? '{}') as { installId?: string };
    expect(stored.installId).toBe(installId);
  });

  it('reports the hours since the previous session', () => {
    const now = Date.now();
    localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify({
      enabled: true,
      installId: '11111111-1111-4111-8111-111111111111',
      firstSeen: now - 2 * 86_400_000,
      lastSeen: now - 5 * 3_600_000,
      walls: [],
    }));

    const sent = capture();
    initTelemetry();

    expect(sent[0].body.props.first_session).toBe(false);
    expect(sent[0].body.props.return_after_hours).toBeCloseTo(5, 0);
  });

  it('attaches the current level to every event', () => {
    const sent = capture();
    setTelemetryLevel(12);
    initTelemetry({ level: 12 });
    trackEvent('purchase', { offer: 'Bronze Axe', price: 27 });

    const purchase = events(sent, 'purchase')[0];
    expect(purchase.body.level).toBe(12);
    expect(purchase.body.props).toEqual({ offer: 'Bronze Axe', price: 27 });
  });

  it('drops unsafe props and truncates long strings', () => {
    const sent = capture();
    initTelemetry();
    trackEvent('purchase', {
      offer: 'x'.repeat(80),
      price: 27,
      'Bad Key': 'nope',
    });

    const props = events(sent, 'purchase')[0].body.props;
    expect(props.offer).toHaveLength(48);
    expect(props.price).toBe(27);
    expect(props).not.toHaveProperty('Bad Key');
  });

  it('opting out deletes the install id and stops every event', () => {
    const sent = capture();
    initTelemetry();
    expect(getTelemetryInstallId()).not.toBeNull();

    setTelemetryEnabled(false);
    expect(getTelemetryPreference()).toBe(false);
    expect(isTelemetryEnabled()).toBe(false);
    expect(getTelemetryInstallId()).toBeNull();

    trackEvent('level_up', { from: 3, to: 4 });
    expect(sent).toHaveLength(1);

    const stored = JSON.parse(localStorage.getItem(TELEMETRY_STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    expect(stored.installId).toBeNull();
    expect(stored.walls).toEqual([]);
  });

  it('opting back in starts a brand-new anonymous install', () => {
    const sent = capture();
    initTelemetry();
    const firstInstall = getTelemetryInstallId();

    setTelemetryEnabled(false);
    setTelemetryEnabled(true);
    trackEvent('level_up', { from: 1, to: 2 });

    const starts = events(sent, 'session_start');
    expect(starts).toHaveLength(2);
    expect(starts[1].body.install_id).not.toBe(firstInstall);
    expect(starts[1].body.install_id).toMatch(UUID_RE);
  });

  it('reports a wall on the third consecutive loss, once per level', () => {
    const sent = capture();
    initTelemetry();

    trackFightOutcome(false, 31, WALL_LOSS_STREAK - 1);
    expect(events(sent, 'wall_reached')).toHaveLength(0);

    trackFightOutcome(false, 31, WALL_LOSS_STREAK);
    trackFightOutcome(false, 31, WALL_LOSS_STREAK);
    expect(events(sent, 'wall_reached')).toHaveLength(1);

    trackFightOutcome(false, 32, WALL_LOSS_STREAK);
    expect(events(sent, 'wall_reached')).toHaveLength(2);
    expect(events(sent, 'wall_reached')[1].body.props.losses).toBe(WALL_LOSS_STREAK);
    expect(events(sent, 'wall_reached')[1].body.props.level).toBe(32);

    trackFightOutcome(true, 33, WALL_LOSS_STREAK);
    expect(events(sent, 'wall_reached')).toHaveLength(2);
  });

  it('keeps the level when an event starts the session before initTelemetry', () => {
    const sent = capture();
    setTelemetryLevel(9);
    trackEvent('purchase', { offer: 'Bronze Axe', price: 27 });

    expect(events(sent, 'session_start')[0].body.level).toBe(9);
    expect(events(sent, 'purchase')[0].body.level).toBe(9);
  });

  it('never reports from automation (QA bot runs must not inflate D1/D7)', () => {
    const sent = capture();
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    try {
      initTelemetry();
      trackEvent('level_up', { from: 1, to: 2 });
      expect(sent).toHaveLength(0);
    } finally {
      Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true });
    }
  });

  it('sends session_end with the beacon transport on pagehide', () => {
    const sent = capture();
    initTelemetry();

    window.dispatchEvent(new Event('pagehide'));

    const end = events(sent, 'session_end')[0];
    expect(end).toBeDefined();
    expect(end.beacon).toBe(true);
    expect(typeof end.body.props.duration_s).toBe('number');
  });
});
