# 🧠 AGENT MEMORY - Operational & Execution Guidelines

**READ THIS BEFORE EVERY RUN** - Essential constraints, environment specifics, and learned patterns to avoid recurring errors.

---

## 📌 QUICK REFERENCE

| Item | Details |
|------|---------|
| **Environment** | GitHub Actions (Ubuntu 24.04) |
| **Node** | v20.20.2 (setup-node@v4) |
| **npm** | Always use `npm ci` (never `npm install`) |
| **Working Dir** | `/home/runner/work/bitbrawler/bitbrawler/` |
| **GITHUB_TOKEN** | Available as env var `${{ github.token }}` |
| **Timeout** | Most actions timeout after 60s—plan accordingly |

---

## 🔴 CRITICAL CONSTRAINTS (READ FIRST!)

### 1. **YAML Indentation Must Be Exact**
```yaml
❌ WRONG (breaks silently):
  - name: Step
   run: command          # 3 spaces = parse error
   env:
    KEY: value          # 1 space = parse error

✅ CORRECT:
  - name: Step
    run: command        # 4 spaces
    env:
      KEY: value        # 6 spaces
```
**Impact:** Workflow runs 0 seconds, silently fails, wastes time debugging  
**Fix:** Validate with `python3 -c "import yaml; yaml.safe_load(open('file.yml'))"`

---

### 2. **npm Installation: npm ci (NOT npm install)**
```bash
❌ npm install
  → May install different versions than package-lock.json
  → Build succeeds locally but fails in CI
  → node_modules corrupted on next run

✅ npm ci
  → Installs EXACT versions from package-lock.json
  → Deterministic, reproducible
  → Faster (cache-aware)
```
**When to use:**
- Always in workflows
- Always in CI/CD pipelines
- Local dev: `npm install` is OK, but `npm ci` is safer

---

### 3. **GITHUB_TOKEN Permissions Are Strict**
```yaml
❌ WRONG permissions (causes HTTP 403):
  permissions:
    contents: write
    pull-requests: write
    issues: write
    # Missing: actions:write ← BLOCKS gh workflow run

✅ CORRECT (for workflow dispatch):
  permissions:
    actions: write        ← REQUIRED to trigger other workflows
    contents: write
    pull-requests: write
    issues: write
```
**Learn:** Every `gh workflow run` needs `actions: write`

---

### 4. **gh CLI Output Formats Are Not Obvious**
```bash
❌ WRONG - gh pr create returns URL, not JSON:
  PR_NUMBER=$(gh pr create ... --json number --jq '.number')
  → PR_NUMBER is empty (flag doesn't work on gh pr create)

✅ CORRECT - extract from URL:
  PR_URL=$(gh pr create --title "..." --body "...")
  PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')

❌ WRONG - gh pr review with multi-line body fails:
  gh pr review "$PR_NUMBER" --approve --body "Line1
  Line2"
  → Syntax error (bash interprets newline as command separator)

✅ CORRECT - use printf or here-doc:
  gh pr review "$PR_NUMBER" --approve --body "$(printf 'Line1\nLine2')"

❌ WRONG field name:
  gh pr view 173 --json state,mergeable,merged
  → Unknown JSON field: "merged" (doesn't exist)

✅ CORRECT field name:
  gh pr view 173 --json state,mergeable,mergeStateStatus
```
**Keys:** Always check `gh COMMAND view --json` docs before using unknown fields

---

### 5. **Self-Approval in PRs Is Blocked by GitHub**
```bash
❌ WRONG - Can't approve own PR:
  gh pr review "$PR_NUMBER" --approve
  → Error: "Can not approve your own pull request"
  
✅ FIX - Check author, skip approval if self:
  AUTHOR=$(gh pr view "$PR_NUMBER" --json author --jq '.author.login')
  if [ "$AUTHOR" != "$GITHUB_ACTOR" ]; then
    gh pr review "$PR_NUMBER" --approve
  fi
  # Then proceed with merge anyway if checks pass
```
**Why:** GitHub prevents self-reviews to maintain code quality standards

---

### 6. **PR Merge Commits Must Include Issue Close Keywords**
```bash
❌ WRONG - Custom merge body loses "Closes #XYZ":
  gh pr merge 173 --squash --body "Custom message"
  → Issue #171 stays OPEN (GitHub looks for "Closes #XYZ" in commit)

✅ CORRECT - Preserve close keyword:
  ORIGINAL_BODY=$(gh pr view 173 --json body --jq '.body')
  # Extract "Closes #XYZ" from original body
  CLOSE_KEYWORD=$(echo "$ORIGINAL_BODY" | grep -oE 'Closes #[0-9]+')
  MERGE_BODY="$CUSTOM_MESSAGE\n\n$CLOSE_KEYWORD"
  gh pr merge 173 --squash --body "$MERGE_BODY"

✅ ALTERNATIVE - Close issue manually:
  gh pr merge 173 --squash --body "Custom message"
  if grep -q "Closes" "$ORIGINAL_BODY"; then
    ISSUE=$(echo "$ORIGINAL_BODY" | grep -oE '#[0-9]+' | head -1 | cut -c2-)
    gh issue close "$ISSUE"
  fi
```
**Impact:** Issues stay OPEN forever if this is forgotten

---

## 🏗️ ENVIRONMENT SETUP

### GitHub Actions Runner
```bash
OS: Ubuntu 24.04 LTS
Node: v20.20.2 (setup-node@v4)
npm: 10.8.2
Git: 2.54.0
Python: 3.12+

Path: /home/runner/work/bitbrawler/bitbrawler/
Temp: /tmp/ or /home/runner/work/_temp/
Cache: auto-handled by setup-node@v4 (save node_modules)
```

### Environment Variables Available
```bash
GH_TOKEN=${{ github.token }}              # GitHub CLI auth
GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}  # Same as above
GITHUB_ACTOR=${{ github.actor }}          # "app/github-actions" or user login
GITHUB_REF=${{ github.ref }}              # "refs/heads/master" or "refs/pull/123/merge"
GITHUB_REPOSITORY=${{ github.repository }} # "stxtxm/bitbrawler"

# Custom secrets (if set in repo):
OPENCODE_API_KEY=${{ secrets.OPENCODE_API_KEY }}
SUPABASE_URL=${{ secrets.SUPABASE_URL }}
```

### npm Scripts Available
```bash
npm run dev              # Start Vite dev server (port 5173)
npm test                # Run Vitest (459+ tests, ~25 seconds)
npm test -- --watch    # Watch mode
npm test -- --coverage # Coverage report
npm run lint            # ESLint check (~2 seconds)
npm run lint -- --fix  # Auto-fix issues
npx tsc --noEmit       # TypeScript check (no build, ~3 seconds)
npm run build          # Production build (Vite + tsc, ~15 seconds)
npm run preview        # Preview built app
```

---

## ❌ COMMON ERRORS & SOLUTIONS

### Error 1: Parse Error in YAML Workflow
```
Error: yaml.parser.ParserError: expected <block end>, but found '<block sequence start>'
```
**Cause:** Indentation mismatch (usually mixing spaces and tabs, or wrong number of spaces)  
**Solution:**
```bash
# Validate YAML
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/opencode.yml'))"

# Fix: Check file has consistent 2-space indentation
# Line formatting must be:
#   - name: Step        (2 spaces)
#     run: command      (4 spaces)
#     env:              (4 spaces)
#       KEY: val        (6 spaces)
```
**Prevention:** Always validate after editing workflows

---

### Error 2: npm ci Fails with "Cannot find module"
```
Error: Cannot find module 'vitest'
```
**Cause:** 
- node_modules corrupted or outdated
- package-lock.json out of sync
- Previous run used `npm install` instead of `npm ci`

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install              # Update lock file locally
git add package-lock.json && git commit -m "chore: update package-lock"
npm ci                   # Use in CI
```
**Prevention:** Always run `npm ci` in workflows, never `npm install`

---

### Error 3: Tests Fail (TypeScript Errors During Run)
```
Error: TS2322: Type 'any' is not assignable to type 'CharacterStats'
```
**Cause:**
- Code uses `any` type
- Type mismatch between function input/output
- Missing type definitions

**Solution:**
```bash
# 1. Check for TypeScript errors BEFORE running tests
npx tsc --noEmit

# 2. Fix all type errors
# (edit file to add proper types, remove `any`)

# 3. Then run tests
npm test
```
**Prevention:** Run `npx tsc --noEmit` before `npm test`

---

### Error 4: Lint Fails (ESLint Violations)
```
Error: Unexpected console statement (no-console)
Error: 'myVar' is defined but never used (no-unused-vars)
```
**Cause:**
- console.log() in production code
- Unused imports or variables
- Code style violations

**Solution:**
```bash
# Auto-fix what ESLint can
npm run lint -- --fix

# Manually fix what remains
# Remove console.log() calls
# Remove unused variables
# Fix imports

# Verify
npm run lint
```
**Prevention:** Run `npm run lint -- --fix` before committing

---

### Error 5: Build Fails (Vite Build Error)
```
Error: Failed to resolve entry module (/home/runner/work/bitbrawler/bitbrawler/src/main.tsx)
```
**Cause:**
- File not found or deleted
- Import path typo
- Circular dependency

**Solution:**
```bash
# Check build output carefully
npm run build

# Common fixes:
# - Check file exists: ls src/main.tsx
# - Check imports: grep -n "main" vite.config.ts
# - Check for circular imports
```
**Prevention:** Run `npm run build` locally before pushing

---

### Error 6: gh CLI Authentication Fails
```
Error: HTTP 403 - Resource not accessible by integration
```
**Cause:**
- Missing `actions: write` permission in workflow
- GITHUB_TOKEN expired or invalid
- Insufficient scope for the command

**Solution:**
```yaml
# Add missing permission
permissions:
  actions: write        # ← Add this for gh workflow run
  contents: write
  pull-requests: write
  issues: write

# Or set GH_TOKEN explicitly
env:
  GH_TOKEN: ${{ github.token }}
```
**Prevention:** Check permissions before each `gh` command that modifies resources

---

### Error 7: PR Merge Fails with Conflict
```
Error: Pull request cannot be merged: merge conflict or CI red
```
**Cause:**
- Branch conflicts with master
- CI checks failing (tests, lint, build)
- Branch protection rules not met

**Solution:**
```bash
# Check merge state
gh pr view "$PR_NUMBER" --json mergeStateStatus

# If conflict:
git fetch origin
git merge origin/master
# resolve conflicts manually
git add .
git commit -m "Merge master into feature branch"
git push

# If CI red:
Check logs: gh run view <RUN_ID> --log
Fix issues and push again
```
**Prevention:** Keep branch up-to-date with master, ensure CI passes before merging

---

### Error 8: Issue Not Closed After PR Merge
```
PR merged but issue still OPEN
```
**Cause:**
- Original PR body had `Closes #171`
- But merge commit used custom body WITHOUT the keyword
- GitHub only closes issues on commit messages with `Closes #XYZ`

**Solution:**
```bash
# Check original PR body
gh pr view "$PR_NUMBER" --json body --jq '.body'

# If it had "Closes #XYZ", include it in merge:
ORIGINAL=$(gh pr view "$PR_NUMBER" --json body --jq '.body')
CLOSE_KEYWORD=$(echo "$ORIGINAL" | grep -oE 'Closes #[0-9]+' || echo "")
MERGE_BODY="Your message\n\n$CLOSE_KEYWORD"
gh pr merge "$PR_NUMBER" --squash --body "$MERGE_BODY"

# Or close manually:
gh issue close 171
```
**Prevention:** Always preserve `Closes #XYZ` in merge commit, or close issues manually

---

## 🎯 AGENT-SPECIFIC CHECKLIST

### ✅ Before EVERY dev-agent Run
```bash
☑ npm ci                   # Install dependencies deterministically
☑ npm run lint             # ESLint (and --fix if needed)
☑ npx tsc --noEmit        # TypeScript compile check
☑ npm test                # All 431+ tests must PASS
☑ npm run build           # Production build must succeed
☑ git diff --stat         # Verify files changed (sanity check)
☑ git commit -m "feat: ..." # Conventional commit
☑ git push origin feat/auto-#ISSUE
```

### ✅ Before EVERY reviewer-agent Run
```bash
☑ gh pr view PR_NUMBER --json state,mergeable
  - state must be "OPEN"
  - mergeable must not be "CONFLICTED"
☑ gh pr checks PR_NUMBER
  - All checks must be "pass" (not "pending" or "fail")
☑ gh pr view PR_NUMBER --json reviews
  - Check if reviewer already exists
☑ Preserve "Closes #XYZ" if present in PR body
☑ After merge, verify issue is closed OR close manually
```

### ✅ Before EVERY tech-lead-agent Run
```bash
☑ qa/stats.json exists and is valid JSON
☑ qa/analysis-latest.json exists (or will be generated)
☑ git log --oneline -20  # Review recent commits
☑ All issues created should have clear scope (mineure/majeure)
☑ For mineure issues: add /oc for auto-implement
☑ For majeure issues: NO /oc (needs human review)
```

### ✅ Before EVERY qa-tester-agent Run
```bash
☑ bitbrawler.vercel.app is UP (test with curl)
☑ Playwright browsers installed (npx playwright install)
☑ QA character exists in localStorage (or create new)
☑ Run sequence: create char → 5 fights → claim lootbox
☑ Collect stats to qa/stats.json
☑ Validate JSON: cat qa/stats.json | python3 -m json.tool
☑ git add qa/stats.json && git commit
```

---

## 🛠️ DEBUGGING TECHNIQUES

### Workflow Fails: Check Logs
```bash
# List recent runs
gh run list --limit 20

# View specific run logs
gh run view <RUN_ID> --log | head -100

# Stream logs in real-time (experimental)
gh run view <RUN_ID> --log --follow

# Search logs for errors
gh run view <RUN_ID> --log | grep -i "error\|failed"
```

### Git Push/Commit Issues
```bash
# Check git status before committing
git status

# Verify branch
git branch -v

# Check remote
git remote -v

# Resync with origin if needed
git fetch origin
git rebase origin/master
```

### npm/Node Issues
```bash
# Check Node version
node --version              # Should be v20.20.2+

# Check npm version
npm --version              # Should be 10.8.2+

# Verify node_modules
ls node_modules/ | wc -l  # Should be 100+ packages

# Clear npm cache if stuck
npm cache clean --force
rm -rf node_modules
npm ci
```

### Test Failures
```bash
# Run single test file
npm test src/utils/combat.test.ts

# Run with verbose output
npm test -- --reporter=verbose

# Run with coverage
npm test -- --coverage

# Debug a specific test
npm test -- --reporter=verbose | grep "FAIL\|✓"
```

---

## 📋 PROJECT CONVENTIONS

### Code Style
- **No `any` types** (use proper TypeScript)
- **No console.log()** in production code
- **Imports sorted** (use ESLint --fix)
- **No unused variables** or imports
- **Functions have explicit return types**
- **Comment complex logic** (game mechanics, calculations)

### Commits
- **Format:** `type: description` (conventional commits)
- **Types:** `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`
- **Language:** English only
- **Length:** Descriptive but concise (<80 chars)
- **Example:** `fix: prevent division by zero in xp calculation`

### Testing
- **Coverage:** >80% for utils/
- **Format:** AAA (Arrange, Act, Assert)
- **Isolation:** Each test independent
- **Naming:** `should...when...` pattern
- **Example:** `should calculate XP correctly when level is 20`

### Files & Structure
- **Utils:** `src/utils/combatUtils.ts` (pure functions)
- **Types:** `src/types/Character.ts` (interfaces)
- **Config:** `src/config/gameRules.ts` (constants, not hardcoded)
- **Tests:** `src/utils/combat.test.ts` (colocated with source)
- **Components:** `src/components/Arena.tsx` (React components)

---

## 🔗 USEFUL REFERENCES

- **Vitest Docs:** https://vitest.dev/
- **ESLint Rules:** https://eslint.org/docs/rules/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Vite Guide:** https://vitejs.dev/guide/
- **GitHub CLI:** https://cli.github.com/manual/
- **Conventional Commits:** https://www.conventionalcommits.org/

---

## 📞 WHEN YOU'RE STUCK

1. **Check this memory file first** — Most issues documented above
2. **View workflow logs:** `gh run view <RUN_ID> --log`
3. **Test locally:** `npm test`, `npm run lint`, `npm run build`
4. **Check git status:** `git status`, `git log --oneline -5`
5. **Ask for help:** Reference error message + context

---

**Last Updated:** 2026-06-20  
**For Agents:** dev-agent, reviewer-agent, tech-lead-agent, qa-tester-agent  
**Critical Level:** 🔴 READ BEFORE EVERY RUN

---

## 🧠 CRITICAL ARCHITECTURE CHANGES (v3.2.0+)

### Idle Processing: Vercel Serverless (NOT GitHub Actions)

**File:** `api/idle-processor.ts` — SELF-CONTAINED Vercel serverless function

**Why self-contained:** Vercel only compiles `api/` files to JS. The idle processor inlines ALL utilities (monsters, combat, XP, efficiency). If you change logic in `src/utils/xpUtils.ts`, `src/utils/combatUtils.ts`, or `src/utils/monsterUtils.ts`, you **MUST mirror changes in `api/idle-processor.ts`**.

**Architecture:**
- Primary: Client POSTs `{ character_id }` on reconnect → instant processing (< 1s cold start)
- Fallback: cron-job.org every 1 min → processes all stale characters (no character_id)
- Former GitHub Actions workflow (`idle-processor.yml`) is **DELETED**

**XP Curve:** Must be IDENTICAL in both files:
- `src/utils/xpUtils.ts`: `Math.floor(100 * Math.pow(level, 1.6))`
- `api/idle-processor.ts`: `Math.floor(100 * Math.pow(level, 1.6))`

**gainXp:** Does NOT give stat points. Caller (`simulateIdleGains` in idle-processor, `useFight` in client) adds them once per level.

### Watermark System

| Watermark | Updated by | Purpose |
|-----------|-----------|---------|
| `lastActive` | Client (visibility change only) | Tracks last player activity |
| `last_idle_check` | Client + server idle-processor | Tracks last processed idle time |

- Unmount: advances ONLY `lastIdleCheck` (NOT `lastActive`) — preserves idle for character switching
- Visibility → hidden: advances both via `onSyncCharacter`

### Efficiency Effect

In `useIdleCombat.ts`, the efficiency effect uses `[character]` identity (not individual fields).
This means it recalculates on ANY character change — level, stats, equipment all trigger refresh.

### Build Verification

```bash
# MUST pass before any push
npm run build   # tsc + vite build (checks TypeScript + SCSS)
npm test        # 531+ tests must pass
```
