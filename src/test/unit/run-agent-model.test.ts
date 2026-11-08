/**
 * Watchdog contract for `scripts/run-agent-model.sh`.
 *
 * Incident 2026-11-01 → 2026-11-04: the free `opencode/*-free` models answer
 * `AI_APICallError: Free usage limit reached` and the CLI retries the call for
 * ~2 minutes before exiting. A 3-model chain burned ~24 minutes and the job
 * died without a usable diagnostic. The wrapper kills the attempt as soon as
 * that fatal line appears, then the workflow moves to the Z.AI fallback.
 *
 * These tests drive the real shell script with a fake `opencode` on PATH, so
 * the exit-code contract stays honest: 0 success, 42 quota, 43 auth, 44
 * retired model, 124 budget exhausted.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { spawnSync } from 'child_process'

const script = resolve(process.cwd(), 'scripts', 'run-agent-model.sh')
let workdir: string

beforeAll(() => {
  workdir = mkdtempSync(join(tmpdir(), 'run-agent-model-'))
  const fake = join(workdir, 'opencode')
  // `--log-level` is case-sensitive and changed between CLI majors: 1.x wants
  // INFO, 2.x wants info. The fake rejects the wrong one exactly like the CLI.
  writeFileSync(
    fake,
    `#!/usr/bin/env bash
if [[ "$1" == "--version" ]]; then echo "opencode v\${FAKE_VERSION:-1.19.5}"; exit 0; fi
LEVEL=""
PREV=""
for ARG in "$@"; do
  [[ "$PREV" == "--log-level" ]] && LEVEL="$ARG"
  PREV="$ARG"
done
case "\${FAKE_VERSION:-1.19.5}" in
  2.*) [[ "$LEVEL" == "info" ]] || { echo "InvalidValue --log-level $LEVEL"; exit 1; } ;;
  *)   [[ "$LEVEL" == "INFO" ]] || { echo "InvalidValue --log-level $LEVEL"; exit 1; } ;;
esac
case "$FAKE_MODE" in
  ok) echo "OK"; exit 0 ;;
  quota) echo 'timestamp=2026-11-04T19:59:17.004Z level=ERROR run=x message="stream error" error.error="AI_APICallError: Free usage limit reached."'; sleep 60 ;;
  quota_echo) echo "Le message est: Free usage limit reached. Free models work in OpenCode"; echo "48.0"; exit 0 ;;
  auth) echo 'timestamp=x level=ERROR error.error="AI_APICallError: This API key has expired"'; sleep 60 ;;
  model) echo 'timestamp=x level=ERROR error.error="UnknownError: Unexpected server error"'; sleep 60 ;;
  zai_quota) echo 'timestamp=x level=ERROR error.error="AI_APICallError: Insufficient balance or no resource package."'; sleep 60 ;;
  slow) sleep 60 ;;
esac
`
  )
  chmodSync(fake, 0o755)
})

afterAll(() => {
  rmSync(workdir, { recursive: true, force: true })
})

function run(mode: string, budget = '20s', version = '1.19.5') {
  const started = Date.now()
  const result = spawnSync(
    'bash',
    [script, '--model', 'test/model', '--budget', budget, '--prompt', 'hi'],
    {
      env: {
        ...process.env,
        PATH: `${workdir}:${process.env.PATH}`,
        FAKE_MODE: mode,
        FAKE_VERSION: version,
      },
      encoding: 'utf8',
      timeout: 30_000,
    }
  )
  return { code: result.status, elapsed: Date.now() - started, output: `${result.stdout}${result.stderr}` }
}

describe('run-agent-model watchdog', () => {
  it('returns 0 when the model succeeds', () => {
    const { code, output } = run('ok')
    expect(code).toBe(0)
    expect(output).toContain('modèle=test/model')
  })

  it('aborts a quota error in seconds instead of waiting for CLI retries (42)', () => {
    const { code, elapsed, output } = run('quota', '60s')
    expect(code).toBe(42)
    expect(elapsed).toBeLessThan(20_000)
    expect(output).toContain('quota gratuit épuisé')
  })

  it('aborts a Z.AI billing error like a quota (42)', () => {
    const { code, elapsed } = run('zai_quota', '60s')
    expect(code).toBe(42)
    expect(elapsed).toBeLessThan(20_000)
  })

  it('aborts an expired credential (43)', () => {
    const { code, elapsed } = run('auth', '60s')
    expect(code).toBe(43)
    expect(elapsed).toBeLessThan(20_000)
  })

  it('aborts a retired model slug (44)', () => {
    const { code, elapsed } = run('model', '60s')
    expect(code).toBe(44)
    expect(elapsed).toBeLessThan(20_000)
  })

  it('does not mistake the agent transcript for a provider error', () => {
    // An agent debugging the quota writes the exact message in its output.
    // Only `level=ERROR` log lines may abort the attempt.
    const { code } = run('quota_echo')
    expect(code).toBe(0)
  })

  it('returns 124 when the wall-clock budget is exhausted', () => {
    const { code, elapsed } = run('slow', '2s')
    expect(code).toBe(124)
    expect(elapsed).toBeLessThan(20_000)
  })

  it('rejects a missing --model or --budget', () => {
    const missing = spawnSync('bash', [script, '--budget', '1m', '--prompt', 'hi'], {
      encoding: 'utf8',
    })
    expect(missing.status).toBe(2)
  })

  it('picks the log-level spelling of the installed CLI major', () => {
    // npm installs 1.19.5 today, but a future 2.x rejects "--log-level INFO".
    expect(run('ok', '20s', '1.19.5').code).toBe(0)
    expect(run('ok', '20s', '2.2.5').code).toBe(0)
  })
})
