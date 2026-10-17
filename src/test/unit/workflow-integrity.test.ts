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
import { readFileSync, readdirSync } from 'fs'
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

describe('Workflow files declare unique job names', () => {
  // Regression: inserting the `preflight` job ahead of `review` left the
  // `review:` key declared twice at the job level. Every local check passed —
  // PyYAML silently keeps the last duplicate — but GitHub rejects the file
  // with "'review' is already defined" and the entire reviewer dispatch dies
  // on HTTP 422. The CI step then reported a bare "exit code 1", which points
  // at the job that failed rather than at the malformed workflow behind it.
  //
  // Parsed line-by-line on purpose: a real YAML parser would need types for
  // js-yaml, and job-level keys are exactly what GitHub complains about.
  const jobNames = (source: string): string[] => {
    const lines = source.split('\n')
    const start = lines.findIndex(l => /^jobs:\s*$/.test(l))
    if (start === -1) return []
    const names: string[] = []
    for (const line of lines.slice(start + 1)) {
      // A top-level key ends the `jobs:` block.
      if (/^[^\s#]/.test(line) && line.trim() !== '') break
      const m = /^  ([A-Za-z0-9_-]+):\s*$/.exec(line)
      if (m) names.push(m[1])
    }
    return names
  }

  const workflowDir = join(process.cwd(), '.github', 'workflows')
  const workflowFiles = readdirSync(workflowDir).filter(f => f.endsWith('.yml'))

  it('finds job names in a known-good workflow', () => {
    // Guards the parser itself: if this returns nothing, the duplicate check
    // below would pass vacuously for every file.
    expect(jobNames(readWorkflow('reviewer.yml'))).toContain('review')
  })

  it.each(workflowFiles)('%s has no duplicated job key', file => {
    const names = jobNames(readWorkflow(file))
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i)
    expect(duplicates).toEqual([])
  })
})

describe('Agent workflows send no OpenCode credential', () => {
  // Incident 2026-10-17: the repo secret OPENCODE_API_KEY had expired (last
  // rotated 2026-05-24). Every agent step exported it, so the provider answered
  // "This API key has expired" and the whole model chain died in ~3s per model.
  // The dev-agent implemented nothing and no PR could be reviewed — the runs
  // looked like instant model failures, not like an expired secret.
  //
  // The `opencode/*-free` models need no credential at all. Verified locally:
  // `opencode auth list` lists no `opencode` provider, and an unauthenticated
  // run against the public endpoint succeeds. Exporting an expired key is
  // therefore strictly worse than exporting nothing.
  //
  // If a paid model is ever wired in, it needs a key scoped to that step only —
  // pair it with a rotation reminder and update this test deliberately.
  const workflowDir = join(process.cwd(), '.github', 'workflows')
  const workflowFiles = readdirSync(workflowDir).filter(f => f.endsWith('.yml'))

  it.each(workflowFiles)('%s does not export OPENCODE_API_KEY', file => {
    expect(readWorkflow(file)).not.toContain('OPENCODE_API_KEY')
  })

  it('keeps the agent model chain on free, credential-less slugs', () => {
    const opencode = readWorkflow('opencode.yml')
    for (const model of [
      'opencode/glm-5.3-flash-free',
      'opencode/deepseek-v4.1-flash-free',
      'opencode/nemotron-3.5-lightning-free',
    ]) {
      expect(opencode).toContain(model)
    }
  })
})
