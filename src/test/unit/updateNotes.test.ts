import { describe, it, expect } from 'vitest';
import { UPDATE_NOTES } from '../../data/updateNotes';

describe('Update notes', () => {
  it('has at least 10 entries', () => {
    expect(UPDATE_NOTES.length).toBeGreaterThanOrEqual(10);
  });

  it('each entry has required fields', () => {
    UPDATE_NOTES.forEach(note => {
      expect(note.version).toBeTruthy();
      expect(note.date).toBeTruthy();
      expect(note.title).toBeTruthy();
      expect(Array.isArray(note.changes)).toBe(true);
      expect(note.changes.length).toBeGreaterThan(0);
    });
  });

  it('versions are in descending order', () => {
    for (let i = 1; i < UPDATE_NOTES.length; i++) {
      const prev = parseFloat(UPDATE_NOTES[i - 1].version);
      const curr = parseFloat(UPDATE_NOTES[i].version);
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it('most recent entry is the latest version', () => {
    const versions = UPDATE_NOTES.map(n => n.version);
    const sorted = [...versions].sort((a, b) => parseFloat(b) - parseFloat(a));
    expect(versions[0]).toBe(sorted[0]);
  });

  it('all dates are valid YYYY-MM-DD', () => {
    UPDATE_NOTES.forEach(note => {
      expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('each change entry is a non-empty string', () => {
    UPDATE_NOTES.forEach(note => {
      note.changes.forEach(change => {
        expect(typeof change).toBe('string');
        expect(change.length).toBeGreaterThan(0);
      });
    });
  });
});
