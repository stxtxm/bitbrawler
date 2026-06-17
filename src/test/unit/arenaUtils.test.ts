import { describe, it, expect } from 'vitest';
import { formatSettingsLogDate } from '../../utils/arenaUtils';

describe('arenaUtils', () => {
  it('formatSettingsLogDate returns a string', () => {
    const result = formatSettingsLogDate(Date.now());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formatSettingsLogDate contains date separators', () => {
    const result = formatSettingsLogDate(1700000000000);
    expect(result).toContain('/');
  });

  it('formatSettingsLogDate handles timestamps', () => {
    const ts = new Date('2026-06-17T12:00:00').getTime();
    const result = formatSettingsLogDate(ts);
    expect(typeof result).toBe('string');
  });

  it('formatSettingsLogDate handles zero timestamp', () => {
    const result = formatSettingsLogDate(0);
    expect(typeof result).toBe('string');
  });
});
