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
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'fs'
import { join, resolve, relative } from 'path'
import { tmpdir } from 'os'
import { spawnSync } from 'child_process'
import qaBotConfig from '../../../qa/qa-bot.config.js'

const readWorkflow = (name: string): string =>
  readFileSync(join(process.cwd(), '.github', 'workflows', name), 'utf8')

describe('Workflow contracts: auto bot-merge reliability ([skip ci] head)', () => {
  const opencode = readWorkflow('opencode.yml')
  const reviewer = readWorkflow('reviewer.yml')
  const ci = readWorkflow('ci.yml')

  it('opencode.yml dispatches CI explicitly on every bot PR', () => {
    // GitHub retient le run pull_request des PRs ouvertes avec GITHUB_TOKEN
    // (`action_required`, zéro job) : la PR n'a alors aucun check, ci.yml ne
    // dispatche jamais le reviewer et la PR reste muette. Le dispatch ne doit
    // donc plus être conditionné à un commit de tête [skip ci] (HEAD_MSG).
    expect(opencode).toContain('gh workflow run ci.yml')
    expect(opencode).toContain('--ref "$BRANCH"')
    expect(opencode).toContain('-f pr_number="$PR_NUMBER"')
    expect(opencode).not.toContain('HEAD_MSG')
  })

  it('opencode.yml never auto-merges — merge is manual after reviewer approval', () => {
    expect(opencode).not.toMatch(/gh pr merge --auto/)
    expect(opencode).not.toMatch(/gh pr merge "\$PR_NUMBER" --squash/)
    expect(opencode).toContain('gh pr merge --disable-auto')
    expect(opencode).not.toContain('--merge --admin')
    expect(opencode).toContain('mode != \'supervisor\'')
  })

  it('reviewer.yml asks for manual merge (no gh pr merge)', () => {
    const reviewer = readWorkflow('reviewer.yml')
    expect(reviewer).toContain('MERGE MANUEL OBLIGATOIRE')
    expect(reviewer).not.toMatch(/gh pr merge "\$PR_NUMBER" --squash/)
  })

  it('no workflow declares the invalid `workflows` permission', () => {
    const files = readdirSync(join(process.cwd(), '.github', 'workflows')).filter(f => f.endsWith('.yml'))
    for (const file of files) {
      expect(readWorkflow(file), file).not.toMatch(/^\s*workflows:\s*write\s*$/m)
    }
  })

  it('ci.yml exposes the pr_number workflow_dispatch input', () => {
    expect(ci).toMatch(/workflow_dispatch:\s*\n\s*inputs:/)
    expect(ci).toContain('pr_number')
  })

  it('ci.yml validates the PR head on dispatch, not the default branch', () => {
    // Un dispatch manuel sans `--ref` s'exécutait sur master : le job affichait
    // « success » pour du code qu'il n'avait jamais compilé, puis transmettait
    // ci_green=true au reviewer (#1179, run 39067317103).
    expect(ci).toContain("format('refs/pull/{0}/head', github.event.inputs.pr_number)")
    expect(ci).toContain("github.event_name == 'workflow_dispatch'")
    // Hors dispatch, ref doit rester vide pour laisser checkout choisir le
    // commit de merge de la PR.
    expect(ci).toMatch(/ref:.*\|\| ''/)
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

describe('QA stats commits survive a concurrent master (#1132)', () => {
  // Three QA runs a day plus manual dispatches all write qa/stats.json on master,
  // and master also moves for other reasons (the reviewer merges PRs, other bots
  // commit). qa/stats.json is rewritten whole on every run, so any concurrent
  // write is a rebase conflict — the old bare `git pull --rebase` left the step
  // red and the run's stats were lost.
  //
  // Proven on a real git sandbox with two runs writing different stats:
  //   old step -> exit 1, master keeps A, B's stats gone
  //   new step -> exit 0, master holds B, the fresh stats
  const source = readWorkflow('qa-tester.yml')
  const step = source.slice(source.indexOf('- name: Commit QA stats'))

  it('serialises QA runs instead of racing them', () => {
    expect(source).toMatch(/^concurrency:/m)
    expect(source).toMatch(/^\s{2}group: qa-stats-commit$/m)
    // A QA run must never be cancelled mid-flight: it just played a real fight.
    // Line-anchored so a comment mentioning the setting cannot satisfy the guard.
    expect(source).toMatch(/^\s{2}cancel-in-progress: false$/m)
  })

  it('retries the rebase and keeps the fresh stats on conflict', () => {
    expect(step).toMatch(/for tentative in/)
    expect(step).toContain('git rebase --abort')
    // During a rebase, `theirs` is the commit being replayed: our fresh stats.
    expect(step).toMatch(/git -c rebase\.autoStash=true pull --rebase -X theirs/)
  })

  it('fails loudly instead of losing stats silently', () => {
    expect(step).toContain('::error::')
    expect(step).toContain('exit 1')
  })

  it('pins the runner image instead of following ubuntu-latest', () => {
    // 2026-10-22 : `ubuntu-latest` a basculé sur Ubuntu 26.04, que
    // playwright@1.60 ne connaît pas encore :
    //   ERROR: Playwright does not support chromium on ubuntu26.04-x64
    // Le job mourait à l'installation du navigateur, avant le premier combat,
    // neuf runs d'affilée. Une image épinglée garde la QA debout quand
    // `latest` roule : c'est au navigateur de suivre l'OS, pas l'inverse.
    expect(source).toMatch(/^\s{4}runs-on: ubuntu-24\.04$/m)
    expect(source).not.toMatch(/^\s{4}runs-on: ubuntu-latest$/m)
    // La version est loguée : l'erreur ne nomme que l'OS, jamais le paquet.
    expect(source).toMatch(/npx playwright --version/)
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

describe('Agents lancés par --agent sont primaires', () => {
  // Incident 2026-10-27 (issue #1334, run reviewer 40598684499) : `opencode run
  // --agent reviewer` répondait « agent "reviewer" is a subagent, not a primary
  // agent. Falling back to default agent » puis tournait comme dev-agent. Le
  // prompt de .opencode/agents/reviewer.md (qui porte la consigne « merge après
  // gate ») n'était donc jamais chargé : le modèle produisait un texte de review
  // et s'arrêtait, sans commentaire ni merge. Même piège pour tech-lead,
  // orchestrator et supervisor, tous lancés avec --agent.
  interface AgentConfigEntry {
    mode?: string
    permission?: { edit?: string; bash?: string }
  }
  interface OpencodeConfig {
    agent?: Record<string, AgentConfigEntry>
  }

  const readConfig = (): OpencodeConfig => {
    const raw: unknown = JSON.parse(readFileSync(join(process.cwd(), 'opencode.json'), 'utf8'))
    return raw as OpencodeConfig
  }

  const readAgentFrontmatterMode = (name: string): string | undefined => {
    const source = readFileSync(join(process.cwd(), '.opencode', 'agents', `${name}.md`), 'utf8')
    return /^mode:\s*(\S+)\s*$/m.exec(source)?.[1]
  }

  const workflowDir = join(process.cwd(), '.github', 'workflows')
  const workflowFiles = readdirSync(workflowDir).filter(f => f.endsWith('.yml'))
  const usedAgents = new Set<string>()
  for (const file of workflowFiles) {
    for (const match of readWorkflow(file).matchAll(/--agent\s+([A-Za-z0-9_-]+)/g)) {
      usedAgents.add(match[1])
    }
  }

  it('détecte les agents réellement passés à --agent', () => {
    expect([...usedAgents].sort()).toEqual(['orchestrator', 'reviewer', 'supervisor', 'tech-lead'])
  })

  it.each([...usedAgents])('%s est déclaré primary partout où il est défini', name => {
    const configMode = readConfig().agent?.[name]?.mode
    if (configMode !== undefined) expect(configMode).toBe('primary')
    expect(readAgentFrontmatterMode(name)).toBe('primary')
  })

  it('reviewer peut lancer gh pr review/merge (bash autorisé)', () => {
    expect(readConfig().agent?.reviewer?.mode).toBe('primary')
    expect(readConfig().agent?.reviewer?.permission?.bash).toBe('allow')
  })
})

describe('QA failures stay diagnosable', () => {
  // Un run QA à 0 combat ne laissait aucune trace exploitable : le bot prend une
  // capture à chaque échec (no-start, pve-locked, timeout, skip) mais elle
  // restait sur le runner, donc on ne pouvait pas dire POURQUOI.
  it('qa-tester.yml uploads the screenshotsDir resolved from qa-bot.config.js', () => {
    const qa = readWorkflow('qa-tester.yml')
    expect(qa).toContain('actions/upload-artifact@v4')
    expect(qa).toContain('if-no-files-found: ignore')
    const botDir = relative(process.cwd(), resolve(process.cwd(), 'qa', qaBotConfig.screenshotsDir))
    expect(qa).toContain(`path: ${botDir}/`)
  })
})

describe('Bookkeeping commits never consume a Pages build', () => {
  // La branche memory est un registre, jamais mergée dans master : chaque push
  // y déclenchait pourtant une preview Cloudflare pour rien (les commits de
  // mémoire n'affichaient aucun marqueur, contrairement à ceux du bot QA).
  it('memory-branch commits carry the skip markers', () => {
    expect(readWorkflow('opencode.yml')).toContain(
      'chore: update dev memory #$ISSUE_NUMBER [skip ci] [CF-Pages-Skip]'
    )
    expect(readWorkflow('reviewer.yml')).toContain(
      'chore: update reviewer memory [skip ci] [CF-Pages-Skip]'
    )
  })

  // Contre-exemple volontaire : un squash merge recopie les messages des commits
  // dans le corps du commit poussé sur master. Un marqueur posé sur une branche
  // de PR ferait donc sauter le déploiement de PRODUCTION au merge.
  it('PR-branch commits stay marker-free', () => {
    const opencode = readWorkflow('opencode.yml')
    expect(opencode).toMatch(/git commit -m "feat: auto-implement #\$ISSUE_NUMBER"\s*$/m)
    expect(opencode).toMatch(/git commit -m \\"docs: add vX\.Y\.Z patch notes[^\\]*\\" \|\| true/)
  })
})

describe('Campagnes — le DAG avance sans intervention humaine', () => {
  // 2026-10-18 (campagne #1201) : #1202 mergée → #1203 JAMAIS dispatchée. Le post-merge
  // ne relançait que les dépendants ayant déjà une PR ; une sous-issue neuve, elle,
  // n'était réclamée par personne, et la campagne s'arrêtait au premier maillon.
  it('reviewer.yml lance le dev-agent pour un dépendant sans PR', () => {
    const reviewer = readWorkflow('reviewer.yml')
    expect(reviewer).toContain('dispatching dev-agent for')
    expect(reviewer).toContain('gh workflow run opencode.yml -f issue_number=')
  })

  it('opencode.yml (auto-merge inline) fait de même', () => {
    expect(readWorkflow('opencode.yml')).toContain('dispatching dev-agent for')
  })
})

describe('DAG — la syntaxe réelle des dépendances est reconnue', () => {
  // 2026-10-18 : l'orchestrateur écrit `depends-on: ##1202` (double dièse, vérifié sur
  // #1203). Les parseurs en `#[0-9]+` ne voyaient AUCUNE dépendance : le dev-agent
  // démarrait sans ses prérequis et le post-merge ne détectait aucun dépendant.
  it('les parseurs tolèrent un ou plusieurs dièses', () => {
    for (const file of ['opencode.yml', 'reviewer.yml']) {
      expect(readWorkflow(file)).toContain('#+[0-9]+')
    }
    const re = new RegExp('depends-on:\\s*(#+[0-9]+[,\\s]*)*#+1202([^0-9]|$)', 'i')
    expect(re.test('/oc\ndepends-on: ##1202')).toBe(true)
    expect(re.test('depends-on: #1202')).toBe(true)
    expect(re.test('depends-on: #12021')).toBe(false)
  })

  // jq sépare les arguments d'une fonction par `;`. Avec une virgule, `test("re", "i")`
  // devient un FLUX (`test("re")` puis `test("i")`) : la regex « i » matche alors toute
  // issue contenant un i, soit toutes — mesuré 32/32 sur le dépôt. Fan-out N² garanti.
  it('les tests jq passent les flags avec un point-virgule, jamais une virgule', () => {
    for (const file of ['opencode.yml', 'reviewer.yml']) {
      const wf = readWorkflow(file)
      expect(wf).toContain('; "i"')
      expect(wf).not.toContain('", "i")')
    }
  })
})

describe('DAG — extraction des dépendances (piège grep ERE)', () => {
  // `[,\s]` en ERE grep n'est PAS « virgule ou blanc » : c'est l'ensemble des caractères
  // littéraux {',', '\', 's'}. Mesuré le 2026-10-18 sur #1209 :
  //   `depends-on: ##1203 ##1207` -> seule « 1203 » était extraite
  // donc le gate « toutes les dépendances sont fermées » laissait partir un dépendant
  // alors que #1207 était encore ouverte. La forme POSIX correcte est `[,[:space:]]`.
  it('utilise [[:space:]] et non \\s dans les classes de caractères', () => {
    for (const file of ['opencode.yml', 'reviewer.yml']) {
      const wf = readWorkflow(file)
      expect(wf).toContain('([,[:space:]]*#+[0-9]+)*')
      expect(wf).not.toContain('([,\\s]*#+[0-9]+)*')
    }
  })
})

describe('Watchdog — filets de sécurité (PR orphelines & fin de campagne)', () => {
  // Deux angles morts mesurés le 2026-10-18, tous les deux laissés pour compte par le sweep :
  //  1. PR de bot dont le run `pull_request` est retenu par GitHub (action_required, ZÉRO
  //     job) : aucun check n'est JAMAIS attaché, donc rien ne déclenche le reviewer. #1223
  //     a attendu 1h36, #1227 1h54 — le passage de 20:37 a raté #1227 de 4 minutes
  //     (56 min < seuil 60). Les PR sans check passent donc au seuil 30 min, et reçoivent
  //     le REVIEWER (qui exécute sa propre gate), plus un redispatch CI sans effet.
  //  2. Le dispatch du supervisor ne vit que dans reviewer.yml : quand la dernière
  //     sous-issue est mergée par une autre voie, le parent reste ouvert pour toujours
  //     (9/9 sous-issues fermées, #1201 encore ouverte à 19:41).
  const wd = readWorkflow('watchdog.yml')

  it('déclenche le reviewer (pas la CI) pour une PR sans check dès 30 min', () => {
    expect(wd).toContain('if [ "$AGE_MIN" -lt 30 ]')
    expect(wd).toContain('gh workflow run reviewer.yml -f pr_number="$PR_NUMBER"')
    expect(wd).not.toContain('gh workflow run ci.yml --ref "$HEAD_REF"')
  })

  it('ne rejuge jamais deux fois le même commit (anti-tempête)', () => {
    // Sans ça, une PR bloquée brûlerait une gate complète (lint+tsc+tests+build) à
    // chaque passage horaire. Un push (nouveau SHA) réarme naturellement la règle.
    expect(wd).toContain('headRefOid')
    expect(wd).toContain('.state == \\"APPROVED\\" or .state == \\"CHANGES_REQUESTED\\"')
  })

  it('dispatche le supervisor quand toutes les sous-issues sont fermées', () => {
    expect(wd).toContain('mode=supervisor')
    // Claim anti-doublon + ré-armement si le run supervisor meurt sans livrer sa PR docs.
    expect(wd).toContain('supervisor-dispatched')
    // Le scan part des issues récemment actives : parcourir les ~160 labels campaign-*
    // historiques coûterait ~2-3 appels API chacun, à chaque passage horaire.
    expect(wd).toContain('sort:updated-desc')
  })
})

describe('Chaîne de modèles : watchdog + repli hors quota partagé (#tech-lead mort)', () => {
  // Incident 2026-11-01 → 2026-11-04 : les slugs `opencode/*-free` partagent un
  // quota PAR IP ET PAR JOUR UTC. Les runners GitHub partagent leurs IP, donc le
  // bucket est vide avant la première requête et les 3 modèles répondent
  // « Free usage limit reached ». Le CLI retente ~2 min par modèle, si bien que
  // tech-lead brûlait 24 min pour finir en échec, sans issue ni PR.
  //
  // Contrat : chaque tentative passe par le watchdog (coupe en ~3 s sur erreur
  // fatale) et un dernier recours Z.AI (GLM-4.5-Flash, gratuit, pas de Google)
  // est ajouté via le broker OIDC Cloudflare /api/zai-key (aucun secret GitHub)
  // — les slugs opencode restent prioritaires.
  const agentWorkflows = ['opencode.yml', 'reviewer.yml', 'tech-lead.yml']

  it.each(agentWorkflows)('%s invoque chaque modèle via le watchdog', file => {
    const source = readWorkflow(file)
    expect(source).toContain('scripts/run-agent-model.sh')
    // Aucun appel direct : sans watchdog, un quota épuisé coûte 2 min de retries
    // par modèle avant de rendre la main.
    expect(source).not.toMatch(/\bopencode run\b/)
  })

  it.each(agentWorkflows)('%s récupère la clé via le broker OIDC (Z.AI/GLM, pas de secret GitHub)', file => {
    const source = readWorkflow(file)
    expect(source).toContain('id-token: write')
    expect(source).toContain('/api/agent-key?provider=zai')
    expect(source).toContain('ACTIONS_ID_TOKEN_REQUEST_TOKEN')
    expect(source).toContain('MODELS+=("zai/glm-4.5-flash")')
    expect(source).not.toContain('secrets.ZAI_API_KEY')
    // Z.AI vient en DERNIER recours : un `MODELS=(` qui le contient en tête
    // ferait sortir les slugs opencode du chemin nominal.
    expect(source).not.toMatch(/MODELS=\(\s*"zai\//)
  })

  it('les slugs opencode restent prioritaires dans les trois workflows', () => {
    for (const file of agentWorkflows) {
      const source = readWorkflow(file)
      const free = source.indexOf('"opencode/deepseek-v4.1-flash-free"')
      expect(free).toBeGreaterThanOrEqual(0)
      // Le repli est ajouté après le tableau des slugs gratuits.
      expect(source.indexOf('MODELS+=("zai/glm-4.5-flash")')).toBeGreaterThan(free)
    }
  })

  it('le watchdog est un script versionné et exécutable', () => {
    const script = join(process.cwd(), 'scripts', 'run-agent-model.sh')
    const source = readFileSync(script, 'utf8')
    expect(source).toContain('Free usage limit reached')
    expect(source).toContain('Insufficient balance or no resource package')
    expect(source).toContain('exit 42')
    expect(statSync(script).mode & 0o111).not.toBe(0)
  })

  it('le broker OIDC vérifie le dépôt et ne fuit pas la clé sans jeton', () => {
    const broker = readFileSync(join(process.cwd(), 'functions', 'api', 'agent-key.ts'), 'utf8')
    expect(broker).toContain("EXPECTED_REPO = 'stxtxm/bitbrawler'")
    expect(broker).toContain("EXPECTED_AUD = 'bitbrawler-agents'")
    expect(broker).toContain('crypto.subtle.verify')
    expect(broker).toContain('ZAI_API_KEY')
  })
})

describe('Fraîcheur du déploiement — le watchdog doit voir la prod gelée (#1228)', () => {
  // La prod a servi pendant des jours un bundle antérieur à master : HTTP 200,
  // QA verte, aucun crash. Le seul signal était le CONTENU du bundle (prix shop
  // 24/48/41/73 au lieu de 27/53/45/80). Le watchdog sonde désormais ces
  // marqueurs et ouvre/ferme un ticket `deploy-stale`.
  const wd = readWorkflow('watchdog.yml')

  it('sonde la prod à chaque passage', () => {
    expect(wd).toContain('scripts/check-deploy-freshness.ts --issue')
  })

  it('la sonde ne fait jamais échouer le run quand la prod est stale', () => {
    // --issue => exit 0 même si stale (le ticket est le signal) ; seul un site
    // injoignable (exit 2) laisse le run rouge.
    expect(wd).toContain('npx --yes tsx scripts/check-deploy-freshness.ts --issue')
  })

  it('les marqueurs sondés existent bien dans le dépôt', () => {
    const revSource = readFileSync(join(process.cwd(), 'src', 'components', 'sprite', 'PixelGridCanvas.tsx'), 'utf8')
    const offersSource = readFileSync(join(process.cwd(), 'src', 'data', 'shopConstants.ts'), 'utf8')
    expect(revSource).toMatch(/SPRITE_RENDER_REV\s*=\s*'[^']+'/)
    expect(offersSource).toMatch(/price:\s*\d+/)
  })
})

describe('Prompts des workflows : sûrs pour le shell (tech-lead mort 2026-11-08)', () => {
  // Incident : le PROMPT du tech-lead est une chaîne bash entre guillemets
  // doubles. La consigne ajoutée par db838b2d contenait des backticks
  // (`websearch`, `webfetch`, `explore`) ET des guillemets doubles internes
  // ("idle RPG ..."). Bash a donc exécuté `websearch`, `webfetch`, `explore`
  // et `RPG` comme des commandes (exit 127) avant même de lancer l'agent :
  // deux runs tech-lead morts en 1 s, sans issue ni PR.
  const workflowDir = join(process.cwd(), '.github', 'workflows')
  const workflowFiles = readdirSync(workflowDir).filter(f => f.endsWith('.yml'))

  /** Lignes réellement interprétées par bash (`run:` inline ou bloc `|`). */
  const runBlockLines = (source: string): Array<{ line: string; number: number }> => {
    const lines = source.split('\n')
    const collected: Array<{ line: string; number: number }> = []

    for (let i = 0; i < lines.length; i += 1) {
      const match = /^(\s*)run:\s*(\|.*)$/.exec(lines[i])
      if (!match) {
        const inline = /^(\s*)run:\s+(.+)$/.exec(lines[i])
        if (inline) collected.push({ line: inline[2], number: i + 1 })
        continue
      }

      const baseIndent = match[1].length
      for (let j = i + 1; j < lines.length; j += 1) {
        const line = lines[j]
        if (line.trim() === '') continue
        const indent = line.length - line.trimStart().length
        if (indent <= baseIndent) break
        // Les commentaires du script ne sont pas interprétés par bash.
        if (!line.trimStart().startsWith('#')) {
          collected.push({ line, number: j + 1 })
        }
      }
    }

    return collected
  }

  it.each(workflowFiles)('%s ne contient aucun backtick non échappé dans ses scripts bash', file => {
    // Un backtick est sûr uniquement s'il est échappé (\`) — jamais nu.
    const offending = runBlockLines(readWorkflow(file)).filter(({ line }) => /(^|[^\\])`/.test(line))

    expect(offending).toEqual([])
  })

  it('le prompt tech-lead ne ferme pas sa chaîne sur un guillemet interne', () => {
    const source = readWorkflow('tech-lead.yml')
    const start = source.indexOf('PROMPT="Tu es le tech-lead')
    expect(start).toBeGreaterThanOrEqual(0)

    // Le bloc se termine à la première ligne suivante qui se termine par un
    // guillemet double (la fermeture réelle de la chaîne bash).
    const afterStart = source.slice(start)
    const lines = afterStart.split('\n')
    const closingIndex = lines.findIndex((line, index) => index > 0 && /"\s*$/.test(line))
    expect(closingIndex).toBeGreaterThan(0)

    const body = lines.slice(1, closingIndex).join('\n')
    // Hors ${VAR:-"défaut"}, un guillemet double nu terminerait la chaîne et
    // ferait exécuter la suite du texte comme une commande.
    const unescaped = body
      .replace(/\$\{[^}]*\}/g, '')
      .split('\n')
      .filter(line => /(^|[^\\])"/.test(line))

    expect(unescaped).toEqual([])
  })
})

describe('Tech-lead — le filtre de dispatch /oc est vérifié en l’exécutant', () => {
  // Le 19/11/2026, le filtre a été corrigé à la main : fenêtre glissante de 48 h au
  // lieu de « depuis le début du run », parce que GitHub n'émet jamais
  // `issues:opened` pour une issue créée par GITHUB_TOKEN. Une simulation à 8 cas
  // avait validé le correctif… une seule fois, hors du dépôt. Réimplémenter le
  // filtre en TypeScript ne testerait que la copie : le script bash de
  // tech-lead.yml pourrait dériver sans qu'aucun test ne s'en aperçoive.
  //
  // Ces tests extraient donc le vrai bloc `run:` de l'étape de dispatch, le font
  // tourner sous bash avec un faux `gh` sur le PATH, et lisent ce qu'il a réclamé
  // et dispatché. Le faux `gh api` sert les lignes qu'on lui donne : la requête
  // elle-même (since, tri, exclusion des PRs) est vérifiée par assertions de source
  // plus bas, puisque le bouchon la court-circuite.
  const source = readWorkflow('tech-lead.yml')

  /** Bloc `run:` d'une étape nommée, désindenté (GitHub le passe tel quel à bash). */
  const stepRunScript = (workflow: string, stepNamePrefix: string): string => {
    const lines = workflow.split('\n')
    const stepStart = lines.findIndex(line => line.trim().startsWith('- name:') && line.trim().includes(stepNamePrefix))
    if (stepStart === -1) throw new Error(`étape « ${stepNamePrefix} » introuvable`)

    let runStart = -1
    for (let i = stepStart + 1; i < lines.length; i += 1) {
      // Une nouvelle étape commence : le `run:` de celle-ci n'existe pas.
      if (/^\s*- name:/.test(lines[i])) break
      if (/^\s*run:\s*\|\s*$/.test(lines[i])) {
        runStart = i
        break
      }
    }
    if (runStart === -1) throw new Error(`étape « ${stepNamePrefix} » sans bloc run: |`)

    const runIndent = lines[runStart].length - lines[runStart].trimStart().length
    const body: string[] = []
    for (let i = runStart + 1; i < lines.length; i += 1) {
      const line = lines[i]
      if (line.trim() === '') {
        body.push('')
        continue
      }
      if (line.length - line.trimStart().length <= runIndent) break
      body.push(line)
    }

    const indents = body.filter(line => line.trim() !== '').map(line => line.length - line.trimStart().length)
    const dedent = Math.min(...indents)
    return `${body.map(line => (line.trim() === '' ? '' : line.slice(dedent))).join('\n')}\n`
  }

  const hasShellTools = (): boolean =>
    spawnSync('bash', ['-c', 'command -v jq >/dev/null 2>&1 && command -v base64 >/dev/null 2>&1 && command -v mktemp >/dev/null 2>&1'], {
      encoding: 'utf8',
    }).status === 0

  const hasGnuDate = (): boolean =>
    spawnSync('bash', ['-c', "date -u -d '1 hour ago' +%s"], { encoding: 'utf8' }).status === 0

  it('extrait bien le script de dispatch (garde du helper)', () => {
    const script = stepRunScript(source, 'Dispatch OpenCode for /oc issues')
    expect(script).toContain('gh api')
  })

  describe.skipIf(!hasShellTools())('exécution du filtre réel avec un faux gh', () => {
    // Bornes fixes : `TECH_LEAD_SCAN_START` est le DÉBUT de la fenêtre, soit 48 h
    // avant le passage du 2026-11-19T00:00:00Z. Les dates des cas sont exprimées
    // par rapport à ce passage, donc les bornes 47 h 30 (dedans) et 48 h 30
    // (dehors) sont exactes, pas approximatives.
    const SCAN_START = '2026-11-17T00:00:00Z'

    // GitHub Actions crée les issues avec `github-actions[bot]`, mais l'API renvoie
    // aussi `app/github-actions` et `opencode-agent` selon la voie de création.
    const BOT = 'github-actions[bot]'
    const creation = (n: number, author: string, createdAt: string, body: string, labels: string[] = [], title = '') =>
      Buffer.from(
        JSON.stringify({
          number: n,
          title,
          user: { login: author },
          created_at: createdAt,
          body,
          labels: labels.map(name => ({ name })),
        })
      ).toString('base64')

    const rows = [
      // 1 - bot, /oc, aucun label → dispatch (sur plusieurs jours de cadre)
      creation(9001, BOT, '2026-11-17T18:00:00Z', 'Corrige le calcul des dégâts.\n\n/oc'),
      // déjà réclamée par un run concurrent → skip (anti fan-out N²)
      creation(9002, BOT, '2026-11-17T18:00:00Z', '/oc', ['dispatched']),
      // vieille issue du créneau fixe (ven 6+ jours) → dispatch aussi : on
      // ne retire plus les issues /oc qui n'ont pas encore de PR, justement
      // parce que GitHub ne signale jamais leur création au tech-lead.
      creation(9003, BOT, '2026-11-16T00:00:00Z', '/oc'),
      // humain → dispatch aussi (le rôle du tech-lead, ce n'est pas de bloquer /oc)
      creation(9004, 'stxtxm', '2026-11-18T23:00:00Z', '/oc'),
      // aucun déclencheur → skip
      creation(9005, BOT, '2026-11-18T23:00:00Z', 'Proposition majeure, sans déclencheur.'),
      // app/github-actions + auto-generated sans dispatched → dispatch
      creation(9006, 'app/github-actions', '2026-11-18T23:00:00Z', '/oc', ['auto-generated']),
      // horodatage tardif, déclencheur présent → dispatch
      creation(9007, 'opencode-agent', '2026-11-17T00:30:00Z', '/oc'),
      // "/oc" dans backticks (casse réelle #1382/#1377) → skip : les
      // délimiteurs exigés par le trigger ne sont pas là.
      creation(9008, BOT, '2026-11-18T23:00:00Z', 'Pas de `/oc` volontairement, voir la proposition.'),
      // apparemment sans /oc → skip
      creation(9009, BOT, '2026-11-18T23:00:00Z', 'Issue sans déclencheur explicite, voir la proposition.'),
      // casse indifférente (grep -i) → dispatch
      creation(9010, BOT, '2026-11-18T22:00:00Z', '/OC'),
      // forme longue du déclencheur → dispatch. Le motif essaie `oc` d'abord ;
      // sans retour arrière sur l'alternative, « /opencode » serait ignoré.
      creation(9011, BOT, '2026-11-18T21:00:00Z', 'Implémente la proposition.\n\n/opencode'),
      // claim au MILIEU d'une liste de labels → skip : `(^|,)dispatched(,|$)`
      // ne doit pas dépendre de la position du label dans la liste.
      creation(9012, BOT, '2026-11-18T20:00:00Z', '/oc', ['bug', 'dispatched', 'campaign-42']),
      // label plus long COMMENÇANT par « dispatched » → skip (label non ancré
      // suffisant à la masque manuelle, retour arrière impossible)
      creation(9013, BOT, '2026-11-18T19:00:00Z', '/oc', ['dispatched-by-watchdog']),
      // proposition légère sans /oc → dispatch + /oc ajouté au corps
      creation(9014, BOT, '2026-11-18T18:00:00Z', 'Petite proposition sans declencheur.', ['proposition'], 'Proposition: ajouter un filtre'),
      // proposition majeure → skip (l'humain décide)
      creation(9015, BOT, '2026-11-18T17:00:00Z', 'Type: Proposition', ['proposition'], 'Proposition majeure: guilde complete'),
      // effort 4+ → skip
      creation(9016, BOT, '2026-11-18T16:00:00Z', 'Type: Proposition. Effort: 4', ['proposition'], 'Proposition: refonte totale'),
      // "Type: Proposition" dans le corps, titre neutre → dispatch
      creation(9017, BOT, '2026-11-18T15:00:00Z', 'Type: Proposition — petit ajustement.', [], 'Ajuster le taux de loot'),
    ]

    type DispatchRun = {
      status: number | null
      stdout: string
      stderr: string
      /** Appels du faux `gh`, dans l'ordre où le script les a faits. */
      calls: string[]
    }

    // Chaque test rejoue le filtre dans SON propre répertoire temporaire (script,
    // faux `gh`, liste d'issues, journal d'appels) et le supprime en sortant : rien
    // n'est partagé entre deux tests, donc chacun passe seul (`-t`, `.only`, ordre
    // aléatoire) sans dépendre d'un fichier /tmp écrit par un autre.
    const runFilterOnce = (): DispatchRun => {
      const workdir = mkdtempSync(join(tmpdir(), 'tech-lead-dispatch-'))
      try {
        const scriptPath = join(workdir, 'dispatch.sh')
        writeFileSync(scriptPath, stepRunScript(source, 'Dispatch OpenCode for /oc issues'))
        writeFileSync(join(workdir, 'issues.txt'), `${rows.join('\n')}\n`)
        const logPath = join(workdir, 'gh-calls.log')
        writeFileSync(logPath, '')

        // Faux `gh` : journalise chaque appel (l'ordre compte pour le claim), et
        // sert les lignes d'issues à `gh api`. Aucun accès réseau.
        const fakeGh = join(workdir, 'gh')
        writeFileSync(
          fakeGh,
          `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$GH_STUB_LOG"
if [ "$1" = "api" ]; then cat "$GH_STUB_ISSUES"; fi
exit 0
`
        )
        chmodSync(fakeGh, 0o755)

        const result = spawnSync('bash', ['-eo', 'pipefail', scriptPath], {
          cwd: workdir,
          encoding: 'utf8',
          timeout: 30_000,
          env: {
            ...process.env,
            PATH: `${workdir}:${process.env.PATH}`,
            GITHUB_REPOSITORY: 'stxtxm/bitbrawler',
            TECH_LEAD_SCAN_START: SCAN_START,
            GH_STUB_ISSUES: join(workdir, 'issues.txt'),
            GH_STUB_LOG: logPath,
          },
        })

        return {
          status: result.status,
          stdout: result.stdout ?? '',
          stderr: result.stderr ?? '',
          calls: readFileSync(logPath, 'utf8').split('\n').filter(Boolean),
        }
      } finally {
        rmSync(workdir, { recursive: true, force: true })
      }
    }

    it('ne dispatch pas les issues sans /oc ou avec claim (anti-fanout', () => {
      const run = runFilterOnce()
      expect(run.stderr).toBe('')
      expect(run.status, `sortie : ${run.stdout}${run.stderr}`).toBe(0)

      const dispatched = run.calls
        .map(call => /^workflow run opencode\.yml -f issue_number=(\d+)$/.exec(call))
        .filter((match): match is RegExpExecArray => match !== null)
        .map(match => match[1])

      // Toute issue sans `dispatched` et avec un /oc dans son corps : humain ou
      // bot, vieille ou récente (no window anymore), '/OC' ou '/opencode' → dispatch.
      expect(dispatched).toEqual(['9001', '9003', '9004', '9006', '9007', '9010', '9011', '9013', '9014', '9017'])
      expect(run.stdout).toContain('Dispatching OpenCode workflow for issue #9001...')
    })

    it('ajoute /oc au corps des propositions legères avant de les dispatcher', () => {
      const run = runFilterOnce()
      expect(run.status, `sortie : ${run.stdout}${run.stderr}`).toBe(0)
      const bodyCalls = run.calls.filter(call => /^issue edit 90(14|17) --body /.test(call))
      expect(bodyCalls.length).toBe(2)
      expect(bodyCalls.every(call => call.includes('/oc'))).toBe(true)
      // Les majeures ne sont pas modifiées.
      expect(run.calls.some(call => /^issue edit 90(15|16) --body /.test(call))).toBe(false)
    })

    it('réclame chaque issue (label dispatched) AVANT de la dispatcher', () => {
      // Claim avant dispatch = la garantie anti fan-out : deux scans concurrents
      // doivent voir le label posé par le premier. L'inverse a produit ~200 runs
      // et des doublons d'issues (#940/#950, 2026-09-11).
      const run = runFilterOnce()
      expect(run.status, `sortie : ${run.stdout}${run.stderr}`).toBe(0)
      const calls = run.calls
      for (const number of ['9001', '9003', '9004', '9006', '9007', '9010', '9011', '9013', '9014', '9017']) {
        const claim = calls.indexOf(`issue edit ${number} --add-label dispatched`)
        const dispatch = calls.indexOf(`workflow run opencode.yml -f issue_number=${number}`)
        expect(claim, `#${number} jamais réclamée`).toBeGreaterThan(-1)
        expect(dispatch).toBeGreaterThan(claim)
      }
      expect(calls.some(call => /issue edit (9002|9005|9008|9009|9012) /.test(call))).toBe(false)
    })

    it('la liste d’issues passe par un fichier temporaire unique, pas un /tmp partagé', () => {
      // Deux exécutions simultanées (tests en parallèle, rerun local) écriraient
      // dans le même /tmp/tech-lead-issues.txt : l'une lirait les lignes de
      // l'autre, et le journal du faux gh ne correspondrait plus.
      const script = stepRunScript(source, 'Dispatch OpenCode for /oc issues')
      expect(script).not.toContain('/tmp/tech-lead-issues.txt')
      expect(script).toContain('mktemp')
    })

    it('la requête API liste les issues ouvertes et exclut les PRs', () => {
      // Le bouchon sert des lignes déjà filtrées : ce que le script DEMANDE à
      // GitHub doit donc être vérifié sur la source.
      const script = stepRunScript(source, 'Dispatch OpenCode for /oc issues')
      expect(script).toContain('issues?state=open&sort=created&direction=desc&per_page=100')
      expect(script).toContain('select(.pull_request | not)')
    })
  })

  describe.skipIf(!hasShellTools() || !hasGnuDate())('fenêtre glissante de 48 h', () => {
    // `date -d '48 hours ago'` est une extension GNU : le workflow ne tourne que sur
    // ubuntu, mais un poste de dev macOS saute ce test au lieu d'échouer à tort.
    it('calcule la borne 48 h avant l’exécution, pas au début du run ni par défaut', () => {
      const workdir = mkdtempSync(join(tmpdir(), 'tech-lead-window-'))
      try {
        const envFile = join(workdir, 'github-env')
        writeFileSync(envFile, '')
        const scriptPath = join(workdir, 'scan-start.sh')
        writeFileSync(scriptPath, stepRunScript(source, 'Mark issue scan start'))

        const result = spawnSync('bash', ['-eo', 'pipefail', scriptPath], {
          encoding: 'utf8',
          timeout: 30_000,
          env: { ...process.env, GITHUB_ENV: envFile },
        })
        expect(result.status, result.stderr).toBe(0)

        const match = /^TECH_LEAD_SCAN_START=(.+)$/m.exec(readFileSync(envFile, 'utf8'))
        expect(match, 'TECH_LEAD_SCAN_START absent de $GITHUB_ENV').not.toBeNull()
        const bound = Date.parse(match![1])

        // Tolérance de 5 min : largement au-dessus de la dérive d'horloge, très
        // en dessous des 24 h d'un « début de run » ou d'une fenêtre d'un jour.
        const expected = Date.now() - 48 * 3600_000
        expect(Math.abs(bound - expected)).toBeLessThan(5 * 60_000)
      } finally {
        rmSync(workdir, { recursive: true, force: true })
      }
    })
  })
})

describe('Workflow contracts: double quotes in `if:` conditions (#1400)', () => {
  it('no workflow `if:` line uses double-quoted string literals', () => {
    // GitHub Actions rejecte les doubles quotes dans les conditions `if:`
    // (« You must use single quotes around string literals ») : un `if:`
    // pareil refusait le workflow lui-même — 0 job, sans log utile (#1400 :
    // zéro stat QA depuis 2026-11-20). Le YAML valide en parse, mais
    // l'expression est rejetée au chargement — le garde-fou scanne les
    // lignes `if:` uniquement (les `${{ }}` dans un `run:` ne sont pas
    // concernés).
    const workflowsDir = join(process.cwd(), '.github', 'workflows')
    const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'))
    expect(files.length).toBeGreaterThan(0)
    const offenders: string[] = []
    for (const file of files) {
      const lines = readFileSync(join(workflowsDir, file), 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (/^\s*if:/.test(line) && line.includes('"')) {
          offenders.push(`${file}:${index + 1}: ${line.trim()}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })
})
