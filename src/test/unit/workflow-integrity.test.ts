/**
 * Workflow Integrity Tests
 *
 * Source-assertion guards on the CI/CD automation contracts:
 * - opencode.yml must always re-dispatch CI explicitly when a bot PR head
 *   commit is a skip-ci marker ([skip ci]) — otherwise GitHub suppresses the
 *   pull_request CI trigger and the CI → reviewer chain never fires.
 * - reviewer.yml must never merge a PR that carries no CI checks without
 *   running the full validation gate (lint, tsc, tests, build) itself.
 *
 * These tests read the workflow files from disk (same pattern as
 * qa-analysis.test.ts) so a regression in the merge reliability fix is caught.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const readWorkflow = (name: string): string =>
  readFileSync(join(process.cwd(), '.github', 'workflows', name), 'utf8')

describe('Workflow contracts: auto bot-merge reliability ([skip ci] head)', () => {
  const opencode = readWorkflow('opencode.yml')
  const reviewer = readWorkflow('reviewer.yml')
  const ci = readWorkflow('ci.yml')

  it('opencode.yml dispatches CI explicitly for skip-ci bot PRs', () => {
    expect(opencode).toContain('gh workflow run ci.yml')
    expect(opencode).toContain('--ref "$BRANCH"')
    expect(opencode).toContain('-f pr_number="$PR_NUMBER"')
    expect(opencode).toMatch(/\[skip ci\]|\[ci skip\]|\[skip actions\]/)
  })

  it('opencode.yml keeps the reviewer as the only merge authority', () => {
    expect(opencode).toMatch(/gh pr merge --auto --squash/)
    expect(opencode).not.toContain('--merge --admin')
    expect(opencode).toContain('mode != \'supervisor\'')
  })

  it('ci.yml exposes the pr_number workflow_dispatch input', () => {
    expect(ci).toMatch(/workflow_dispatch:\s*\n\s*inputs:/)
    expect(ci).toContain('pr_number')
  })

  it('ci.yml still dispatches the reviewer on CI pass', () => {
    expect(ci).toContain('gh workflow run')
    expect(ci).toMatch(/reviewer/i)
  })

  it('reviewer.yml runs the full validation gate when the PR has no CI checks', () => {
    expect(reviewer).toContain('statusCheckRollup')
    expect(reviewer).toContain('CHECK_COUNT')
    expect(reviewer).toContain('npm run lint')
    expect(reviewer).toContain('npx tsc --noEmit')
    expect(reviewer).toContain('npm test')
    expect(reviewer).toContain('npm run build')
    expect(reviewer).toContain('request-changes')
  })
})
