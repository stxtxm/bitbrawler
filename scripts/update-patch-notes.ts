#!/usr/bin/env tsx
/**
 * Auto patch notes after a PR is merged on master.
 *
 * Called by .github/workflows/patch-notes.yml. It only rewrites
 * src/data/updateNotes.ts (plain TS data, no DB write). Idempotent: a PR that
 * was already recorded is skipped, so a rerun of the workflow is a no-op.
 */
import { readFileSync, writeFileSync } from 'node:fs'

export const NOTES_FILE = 'src/data/updateNotes.ts'

export type PatchNoteInput = {
  prNumber: number
  title: string
  today: string
  currentNotes: string
}

export type PatchNoteResult = {
  changed: boolean
  version?: string
  reason?: string
  content: string
}

const escapeTpl = (value: string): string => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

export function nextVersion(currentVersion: string, title: string): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion.trim())
  if (!match) return '5.9.2'
  const [, major, minor, patch] = match.map(Number)
  if (/^feat(\([^)]*\))?:/i.test(title)) return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

export function alreadyRecorded(notes: string, prNumber: number): boolean {
  return notes.includes(`PR #${prNumber}`) || notes.includes(`PR-${prNumber}`)
}

/**
 * Insert a new entry at the head of UPDATE_NOTES. Keeps the existing data
 * shape untouched (same quotes / indentation as the file).
 */
export function buildPatchNotes(input: PatchNoteInput): PatchNoteResult {
  const { prNumber, title, today, currentNotes } = input
  if (alreadyRecorded(currentNotes, prNumber)) {
    return { changed: false, reason: 'PR deja present dans les patch notes', content: currentNotes }
  }

  const versionMatch = /version:\s*'([\d.]+)'/.exec(currentNotes)
  if (!versionMatch) {
    return { changed: false, reason: 'Version courante introuvable', content: currentNotes }
  }

  const version = nextVersion(versionMatch[1], title)
  const safeTitle = escapeTpl(title.replace(/\s+/g, ' ').trim() || `PR #${prNumber}`)
  const entry = [
    '  {',
    `    version: '${version}',`,
    `    date: '${today}',`,
    `    title: '${safeTitle} (PR #${prNumber})',`,
    '    changes: [',
    `      '✅ ${safeTitle} — livré automatiquement apres le merge de la PR #${prNumber}.',`,
    '    ],',
    '  },',
  ].join('\n')

  const arrayMatch = /(export const \w+\s*(?::[^=]+)?=\s*\[)\n/.exec(currentNotes)
  if (!arrayMatch) {
    return { changed: false, reason: 'Tableau UPDATE_NOTES introuvable', content: currentNotes }
  }

  const content = currentNotes.replace(arrayMatch[0], `${arrayMatch[0]}${entry}\n`)
  return { changed: true, version, content }
}

function main(): void {
  const prNumber = Number(process.env.PR_NUMBER ?? '')
  if (!Number.isFinite(prNumber) || prNumber <= 0) {
    console.error('PR_NUMBER manquant ou invalide')
    process.exitCode = 1
    return
  }

  const currentNotes = readFileSync(NOTES_FILE, 'utf8')
  const result = buildPatchNotes({
    prNumber,
    title: process.env.PR_TITLE ?? `PR #${prNumber}`,
    today: new Date().toISOString().slice(0, 10),
    currentNotes,
  })

  if (!result.changed) {
    console.log(`Patch notes inchangées : ${result.reason ?? 'aucune modification'}`)
    return
  }

  writeFileSync(NOTES_FILE, result.content, 'utf8')
  console.log(`Patch notes mises à jour : ${result.version} (PR #${prNumber})`)
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main()
}
