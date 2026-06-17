# BITBRAWLER - CI/CD Workflows & Automation

This document explains all **GitHub Actions workflows**, **OpenCode agent automation**, and how the **continuous integration & deployment** system works.

---

## Table of Contents

- [Workflows Overview](#workflows-overview)
- [CI Workflow](#ci-workflow)
- [OpenCode Workflow](#opencode-workflow)
- [Reviewer Workflow](#reviewer-workflow)
- [Tech Lead Workflow](#tech-lead-workflow)
- [QA Tester Workflow](#qa-tester-workflow)
- [Bot Activity Workflow](#bot-activity-workflow)
- [Daily Reset Workflow](#daily-reset-workflow)
- [How to Trigger Workflows](#how-to-trigger-workflows)
- [Monitoring & Debugging](#monitoring--debugging)

---

## Workflows Overview

### Summary Table

| Workflow | File | Trigger | Status | Purpose |
|----------|------|---------|--------|---------|
| **CI** | `.github/workflows/ci.yml` | PR open/update | ✅ Required | Lint, test, build |
| **OpenCode** | `.github/workflows/opencode.yml` | Issue with `/oc` | ✅ Autonomous | Dev agent implementation |
| **Reviewer** | `.github/workflows/reviewer.yml` | PR created | ✅ Autonomous | Auto review + merge |
| **Tech Lead** | `.github/workflows/tech-lead.yml` | Daily @ 21h | ✅ Scheduled | Daily analysis + issues |
| **QA Tester** | `.github/workflows/qa-tester.yml` | Manual / scheduled | ✅ On-demand | E2E tests + stats |
| **Bot Activity** | `.github/workflows/bot-activity.yml` | Manual / scheduled | ✅ On-demand | Bot engine runs |
| **Daily Reset** | `.github/workflows/daily-reset.yml` | Daily @ 00h | ✅ Scheduled | Character reset |

---

## CI Workflow

### File: `.github/workflows/ci.yml`

**Purpose**: Validate code quality on every PR

**Triggers**:
- `pull_request` (opened, synchronize, reopened)
- `workflow_dispatch` (manual trigger)

**Steps**:

1. **Checkout** → Get the code
2. **Setup Node** → Node 20 + npm caching
3. **Install** → `npm ci`
4. **Lint** → `npm run lint` (ESLint)
5. **Type Check** → `npx tsc --noEmit` (TypeScript)
6. **Tests** → `npm test` (Vitest, 431+ tests)
7. **Build** → `npm run build` (Vite production build)

**Status Check**:
- ✅ All steps pass → PR can be merged
- ❌ Any step fails → PR blocked, fix required

**Example**: 

```
Your PR triggers CI:
  ✅ Lint passed
  ✅ Type check passed
   ✅ Tests passed (431/431)
  ✅ Build passed
  → Reviewer workflow triggered automatically
```

---

## OpenCode Workflow

### File: `.github/workflows/opencode.yml`

**Purpose**: Autonomous agent implementation from issues

**Triggers**:
- Issue `opened` or `edited` with `/oc` in body
- `workflow_dispatch` with `issue_number` input

**How it works**:

### Step 1: Resolve Issue Context
```
Extract issue details:
- Issue number
- Issue title
- Issue body (contains the /oc request)
```

### Step 2: Create Branch
```
Branch name: feat/auto-#ISSUE_NUMBER
Example: feat/auto-42
```

### Step 3: Run Dev Agent
```
✨ OpenCode runs dev-agent:
- Reads issue description
- Explores codebase
- Implements the requested feature
- Runs tests to verify
- Creates commits
- Pushes to branch
```

### Step 4: Create PR
```
PR Details:
- Title: [From issue title]
- Body: "Closes #ISSUE_NUMBER"
- Branch: feat/auto-#ISSUE_NUMBER → master
- Label: auto-generated (if exists)
```

### Step 5: Trigger CI
```
GitHub Actions triggers:
  → ci.yml (lint, test, build)
```

### Step 6: Trigger Reviewer
```
GitHub Actions triggers:
  → reviewer.yml (auto review + merge)
```

**Timeline**:
```
[You create issue with /oc]
         ↓ (OpenCode detects)
[Dev agent implements] (5-15 minutes)
         ↓
[PR created automatically]
         ↓
[CI runs] (2-3 minutes)
         ↓
[Reviewer analyzes] (1-2 minutes)
         ↓
[Auto-merge if approved] OR [Feedback if issues]
```

---

## Reviewer Workflow

### File: `.github/workflows/reviewer.yml`

**Purpose**: Autonomous code review + merge

**Triggers**:
- PR `opened` or `ready_for_review`
- `workflow_dispatch` with `pr_number` input

**Review Checklist**:

1. ✅ **Tests** → All tests pass?
2. ✅ **TypeScript** → No TS errors?
3. ✅ **Conventions** → Code follows project style?
4. ✅ **Performance** → No N+1 queries, no waste?
5. ✅ **Security** → No secrets exposed, no SQL injection?
6. ✅ **Simplicity** → No duplication, not overly complex?
7. ✅ **Relevance** → Solves the issue as described?
8. ✅ **Scope** → No unnecessary changes?

**Reviewer Agent Decision**:

```
if (CI_PASSED && ALL_CHECKS_OK) {
  gh pr review --approve
  gh pr merge --squash --delete-branch
  → ✅ MERGED
} else {
  gh pr review --request-changes --body "Issues found: ..."
  → ❌ REQUEST CHANGES
}
```

**Important Rules**:
- 🔴 **Never approve** if CI is red
- 🔴 **Never merge** if security issues
- 🔴 **Never merge** if tests fail

---

## Tech Lead Workflow

### File: `.github/workflows/tech-lead.yml`

**Purpose**: Daily analysis, create strategic issues

**Triggers**:
- Schedule: Daily at 21h (Paris time)
- `workflow_dispatch` (manual)

**Daily Tasks**:

### 1. Mark Scan Start
Record timestamp for issue detection

### 2. Analyze QA Stats
If `qa/stats.json` exists:
```
📊 Analyze:
- HP growth trends
- Lootbox rarity distribution
- Win rate trends (last 3/5/all-time)
- Character stat balance
- Error rate
```

### 3. Run Tech Lead Agent
OpenCode runs the **tech-lead agent**:
- Reads QA analysis
- Reviews recent commits
- Identifies bugs & improvements
- Creates GitHub issues for:
  - Critical bugs 🔴
  - Balance adjustments 🟠
  - Feature suggestions 💡

### 4. Auto-implement Issues
For each newly created issue:
- If marked with `/oc` → dev-agent implements
- If marked "Proposition majeure" → waiting for human approval

**Examples of issues created**:

```
🔴 Critical Bug:
# Fix: HP scaling broken after level 10

Players at level 10+ report 0 HP max.
Need immediate fix in characterUtils.ts.

/oc

---

🟠 Balance:
# Adjust: Increase epic lootbox chance 5% → 8%

Current epic drop rate too low (3%).
Update LOOTBOX_RARITY_WEIGHTS in lootboxUtils.ts.

/oc

---

💡 Proposition:
# Proposition: Daily challenges system

Add daily quests (defeat 10 bots, survive 5 min, etc).

Type: Proposition majeure (requires architecture changes)
```

---

## QA Tester Workflow

### File: `.github/workflows/qa-tester.yml`

**Purpose**: E2E tests on live site + gameplay stats collection

**Triggers**:
- `workflow_dispatch` (manual)
- Scheduled (configuration via cron-job.org external service)

**What it does**:

1. **Install Playwright**
   ```bash
   npx playwright install chromium --with-deps
   ```

2. **Run E2E Tests**
   ```bash
   node qa/qa-bot.mjs
   ```
   - Navigate to bitbrawler.vercel.app
   - Create/load QA character
   - Perform 5 fights
   - Claim daily lootbox
   - Enable auto mode
   - Collect stats

3. **Generate Stats**
   Output: `qa/stats.json`
   ```json
   {
     "timestamp": "2026-05-25T20:00:00Z",
     "character": {
       "max_hp": 45,
       "level": 3
     },
     "fights": {
       "total": 5,
       "wins": 4,
       "losses": 1
     },
     "loot": {
       "common": 3,
       "rare": 1,
       "epic": 0
     },
     "errors": 0
   }
   ```

4. **Commit Stats**
   ```bash
   git add qa/stats.json qa/state.json
   git commit -m "chore: update QA stats"
   git push
   ```

**Important**:
- Script runs **on live site** (real data)
- Stats used by tech-lead for daily analysis
- Failures don't block CI (continue-on-error: true)

---

## Bot Activity Workflow

### File: `.github/workflows/bot-activity.yml`

**Purpose**: Maintain bot population and activity

**Triggers**:
- `workflow_dispatch` (manual)
- Scheduled (configuration via cron-job.org external service)

**What it does**:

1. **Run Bot Engine**
   ```bash
   npx tsx scripts/bot-engine.ts
   ```

2. **Bot Engine Tasks**:
   - Ensure minimum bot population at each level
   - Distribute fights evenly
   - Update bot activity profiles
   - Rebalance protection (prevent bot overuse)
   - "Retire" overpowered bots

3. **Updates to Database**:
   - Bot character stats
   - Fight records
   - Activity tracking

**Frequency**: Manual or scheduled (1-2x per day recommended)

---

## Daily Reset Workflow

### File: `.github/workflows/daily-reset.yml`

**Purpose**: Global daily reset at midnight

**Triggers**:
- Schedule: Daily at 00h (Paris time = UTC+1/+2)
- `workflow_dispatch` (manual)

**What it resets**:

1. **Fight Tracker**
   ```sql
   UPDATE characters SET fights_today = 0
   ```

2. **Opponent Rotation**
   ```sql
   DELETE FROM fight_opponents WHERE reset_date < TODAY()
   ```

3. **Lootbox Reset**
   ```sql
   UPDATE daily_lootbox SET claimed_at = NULL WHERE reset_date < TODAY()
   ```

4. **Seasonal Stats**
   ```sql
   INSERT INTO seasonal_stats SELECT ... FROM characters
   CALCULATE rankings
   ```

**Timeline**:
```
23:59 Paris time: Last chance to play
00:00 Paris time: Daily reset triggers
00:05 Paris time: Reset complete, fresh fights available
```

---

## How to Trigger Workflows

### Trigger OpenCode (Dev Agent)

**Method 1**: Create new issue with `/oc`
```markdown
# Implement feature X

Please add feature X to the game.

/oc
```

**Method 2**: Edit existing issue to add `/oc`
```markdown
Original issue text...

/oc
```

**Method 3**: Manual trigger
```bash
gh workflow run opencode.yml -f issue_number=42
```

### Trigger QA Tester
```bash
gh workflow run qa-tester.yml
```

### Trigger Bot Activity
```bash
gh workflow run bot-activity.yml
```

### Trigger Daily Reset (test)
```bash
gh workflow run daily-reset.yml
```

---

## Monitoring & Debugging

### View Workflow Runs

```bash
# List all recent runs
gh run list --limit 20

# View specific workflow runs
gh run list --workflow ci.yml --limit 10

# View detailed logs
gh run view <RUN_ID> --log
```

### Common Issues

#### CI Fails

**Problem**: Lint, test, or build fails

**Solution**:
```bash
# Run locally to debug
npm run lint      # Fix linting issues
npm test          # Fix failing tests
npm run build     # Fix build errors

# Commit fix
git add -A
git commit -m "fix: resolve CI issues"
git push
```

#### OpenCode Fails

**Problem**: Dev agent can't implement the issue

**Solution**:
1. Check the issue description is clear
2. Verify tests pass locally
3. Check the agent logs in GitHub Actions
4. Simplify the issue if too complex

#### PR Not Auto-Merging

**Problem**: Reviewer doesn't approve/merge

**Solution**:
1. Check CI passed (must be green)
2. Check for security issues
3. View reviewer logs for feedback
4. Fix issues and push again

#### QA Tester Fails

**Problem**: Playwright tests fail on live site

**Solution**:
1. Usually temporary (Vercel deploy, network)
2. Fails don't block CI (continue-on-error: true)
3. Check stats were collected anyway
4. Manually re-run if needed

### View Workflow Status

```bash
# GitHub CLI
gh run list --limit 5

# Output:
# ✓ <RUN_ID>  <WORKFLOW>  completed  success
# ✓ <RUN_ID>  <WORKFLOW>  completed  success
# ✗ <RUN_ID>  <WORKFLOW>  completed  failure
```

### GitHub Actions UI

1. Go to: https://github.com/stxtxm/bitbrawler/actions
2. Select workflow from left sidebar
3. Click run to view details
4. View "Logs" tab for step-by-step execution

---

## Performance Tips

### Optimize CI
- Cache npm dependencies (already done)
- Use `npm ci` instead of `npm install`
- Run tests in parallel (default in Vitest)

### Optimize Workflows
- Use `concurrency` to cancel redundant runs
- Avoid unnecessary steps
- Clean up old runs periodically

### Secrets & Tokens

- `OPENCODE_API_KEY` - Used by dev-agent, reviewer, tech-lead
- `SUPABASE_URL` - Database connection
- `SUPABASE_SERVICE_ROLE_KEY` - Admin operations

All secrets managed via GitHub repo settings.

---

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [OpenCode Documentation](https://opencode.ai/docs)
- [Vercel Deployment Guide](https://vercel.com/docs)
