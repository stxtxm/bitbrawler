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

describe('Memory save must never block the PR push', () => {
  // Incident 2026-10-17 (issue #1132, run 39058690947): the dev agent implemented
  // the fix and validation passed, then "Save agent session memory" died on
  // `jq --argjson` because the agent had written invalid JSON. GitHub runs `run:`
  // steps with `bash -e`, so jq's exit 2 killed the step — and "Push and manage
  // PR" is guarded by success(), so the whole implementation was silently
  // dropped. A perfectly good run produced nothing.
  //
  // The step also used to read `CURRENT` from master's `.opencode/memory/dev.json`
  // before switching to the `memory` branch. Master only keeps a vestige that
  // agents never read (the loader prefers refs/remotes/origin/memory), so every
  // successful save overwrote the accumulated notes and known_limitations.
  //
  // Both invariants are asserted here so neither can regress quietly.
  const source = readWorkflow('opencode.yml')
  const start = source.indexOf('- name: Save agent session memory')
  expect(start, 'step "Save agent session memory" is missing from opencode.yml').toBeGreaterThan(-1)
  const nextStep = source.indexOf('\n      - name:', start + 1)
  const step = source.slice(start, nextStep === -1 ? undefined : nextStep)

  it('tolerates its own failure so the PR push still runs', () => {
    expect(step).toContain('continue-on-error: true')
  })

  it('validates the agent notes before handing them to --argjson', () => {
    // The agent writes /tmp/agent-session-notes.json by hand: trailing commas,
    // raw newlines and markdown fences are all normal.
    expect(step).toContain('jq -e . /tmp/agent-session-notes.json')
    expect(step).toContain('--rawfile')
  })

  it('reads the accumulated memory from the memory branch, not from master', () => {
    const readsCurrent = step.indexOf('CURRENT=$(cat .opencode/memory/dev.json')
    const switchesBranch = step.indexOf('git checkout memory')
    expect(readsCurrent).toBeGreaterThan(-1)
    expect(switchesBranch).toBeGreaterThan(-1)
    expect(readsCurrent).toBeGreaterThan(switchesBranch)
  })
})

describe('Reviewer preflight must be able to see the PR', () => {
  // Incident 2026-10-17 (PR #1176): the preflight job has no actions/checkout —
  // it only reads the PR state — so there is no git repository in the workspace
  // and `gh` cannot infer which repo it is talking to. It exits with
  // « failed to run git: fatal: ... n'est pas un dépôt git ».
  //
  // The script swallowed that with `2>/dev/null || echo ""`, turned it into
  // "unknown", and skipped the review. Every reviewer run was therefore green
  // and did nothing: reviews were off across the board, invisibly. That is worse
  // than a red run — nothing to look at, nothing to fix.
  //
  // Two invariants: gh is told which repo to use, and an unreadable state is a
  // loud failure rather than a silent skip.
  const source = readWorkflow('reviewer.yml')
  const start = source.indexOf('- name: Skip review if the PR is not open')
  expect(start, 'preflight gate step is missing from reviewer.yml').toBeGreaterThan(-1)
  const end = source.indexOf('\n  review:', start)
  const gate = source.slice(start, end === -1 ? undefined : end)

  it('tells gh which repository to use, since the job has no checkout', () => {
    expect(source.slice(source.indexOf('  preflight:'), source.indexOf('\n  review:'))).toContain(
      'GH_REPO: ${{ github.repository }}'
    )
  })

  it('fails loudly instead of silently skipping when the state is unreadable', () => {
    // A blind preflight must not be able to disable the whole reviewer quietly:
    // it retries, then exits non-zero so the run is red and visible.
    expect(gate).toContain('exit 1')
    expect(gate).toMatch(/for attempt in/)
    // The exact anti-pattern that caused the outage: reading the state with
    // stderr discarded and defaulting the result to "", which became "unknown".
    expect(gate).not.toMatch(/gh pr view[^\n]*2>\/dev\/null/)
  })

  it('still skips a genuinely closed or merged PR', () => {
    // The ghost-run fix must survive: a merged PR is not worth reviewing.
    expect(gate).toContain('should_review=false')
    expect(gate).toContain('should_review=true')
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
