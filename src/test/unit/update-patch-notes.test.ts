import { describe, it, expect } from 'vitest'
import { buildPatchNotes, nextVersion, alreadyRecorded } from '../../../scripts/update-patch-notes'

const NOTES = `export type UpdateNote = {
  version: string;
  date: string;
  title: string;
  changes: string[];
};

export const UPDATE_NOTES: UpdateNote[] = [
  {
    version: '5.9.1',
    date: '2026-11-22',
    title: 'Ancienne version',
    changes: ['Une note'],
  },
];
`

describe('auto patch notes after merge', () => {
  it('bumps patch for fixes and minor for features', () => {
    expect(nextVersion('5.9.1', 'fix: corrige le cron')).toBe('5.9.2')
    expect(nextVersion('5.9.1', 'chore: met à jour les deps')).toBe('5.9.2')
    expect(nextVersion('5.9.1', 'feat: ajoute un biome')).toBe('5.10.0')
    expect(nextVersion('invalide', 'fix: x')).toBe('5.9.2')
  })

  it('inserts a new entry at the top of UPDATE_NOTES', () => {
    const result = buildPatchNotes({
      prNumber: 999,
      title: 'fix: corrige les logs PvP',
      today: '2026-11-23',
      currentNotes: NOTES,
    })

    expect(result.changed).toBe(true)
    expect(result.version).toBe('5.9.2')
    expect(result.content.indexOf("version: '5.9.2'")).toBeLessThan(
      result.content.indexOf("version: '5.9.1'"),
    )
    expect(result.content).toContain("title: 'fix: corrige les logs PvP (PR #999)'")
    expect(result.content).toContain('PR #999')
  })

  it('is idempotent (no duplicate entry on workflow rerun)', () => {
    const once = buildPatchNotes({
      prNumber: 999,
      title: 'fix: corrige les logs PvP',
      today: '2026-11-23',
      currentNotes: NOTES,
    })
    const twice = buildPatchNotes({
      prNumber: 999,
      title: 'fix: corrige les logs PvP',
      today: '2026-11-23',
      currentNotes: once.content,
    })

    expect(alreadyRecorded(once.content, 999)).toBe(true)
    expect(twice.changed).toBe(false)
    expect(twice.content).toBe(once.content)
  })

  it('does not touch notes when the array is missing', () => {
    const result = buildPatchNotes({
      prNumber: 1,
      title: 'fix: x',
      today: '2026-11-23',
      currentNotes: 'const FOO = 1',
    })
    expect(result.changed).toBe(false)
    expect(result.content).toBe('const FOO = 1')
  })
})
