# BITBRAWLER - Autonomous Agents Documentation

This document explains **OpenCode autonomous agents**, how they work, their responsibilities, and how to interact with them.

---

## Table of Contents

- [Agents Overview](#agents-overview)
- [Dev Agent](#dev-agent)
- [Reviewer Agent](#reviewer-agent)
- [Tech Lead Agent](#tech-lead-agent)
- [QA Tester Agent](#qa-tester-agent)
- [How to Trigger Agents](#how-to-trigger-agents)
- [Agent Communication](#agent-communication)
- [Debugging Failed Agents](#debugging-failed-agents)

---

## Agents Overview

Bitbrawler uses **4 autonomous agents** to automate development, code review, analysis, and testing.

| Agent | Role | Trigger | Frequency |
|-------|------|---------|-----------|
| **dev-agent** | Implement features | Issue with `/oc` | On-demand |
| **reviewer** | Review & merge PRs | PR created | On-demand |
| **tech-lead** | Daily analysis | Scheduled @ 21h | Daily |
| **qa-tester** | E2E tests + Shop testing | Manual / scheduled | Manual or scheduled |

---

## ⚠️ Database Safety — Règle ABSOLUE

**Aucun agent ne doit JAMAIS modifier la base de production Supabase directement.**
Toute modification de schéma (nouvelle table, colonne, contrainte) doit passer par une issue GitHub avec la requête SQL exacte, que l'humain exécutera dans **Supabase Dashboard > SQL Editor**.

### ✅ Ce que les agents DOIVENT faire
- Écrire le code TypeScript (champs optionnels `?`, valeurs par défaut, optional chaining)
- Créer une issue de migration **SANS `/oc`** avec la requête SQL prête à copier-coller
- Tester que le code fonctionne **avant** l'exécution de la migration (champs optionnels)

### ❌ Interdictions formelles
- ❌ NE JAMAIS exécuter `ALTER TABLE`, `CREATE TABLE`, `INSERT`, `UPDATE` sur la prod
- ❌ NE JAMAIS utiliser `supabase` ou un client SQL pour modifier le schéma
- ❌ NE JAMAIS fusionner une PR dont la migration n'a pas été exécutée
- ❌ NE JAMAIS inclure de migration SQL dans du code automatisé (scripts, CI/CD)

### Format obligatoire d'une issue de migration

```markdown
# Migration: [description courte]

## Changement
- Table: `characters`
- Colonne: `essence`
- Type: `INTEGER`
- Défaut: `0`
- Nullable: non

## Commande SQL
\`\`\`sql
ALTER TABLE characters ADD COLUMN IF NOT EXISTS essence INTEGER NOT NULL DEFAULT 0;
\`\`\`

## Notes
- Code déjà déployé, fonctionnel sans la migration (champs optionnels)
- Exécuter dans Supabase Dashboard > SQL Editor > New Query
- Aucun downtime nécessaire
```

---

---

## Dev Agent

### File: `.opencode/agents/dev-agent.md`

### Role

**Autonomous developer**. Implements features, fixes bugs, and pushes code.

### Responsibilities

✅ **What the dev-agent does**:
1. Reads the issue description
2. Explores the codebase
3. Writes clean, tested code
4. Creates commits with clear messages
5. Runs tests to verify
6. Pushes to a feature branch
7. **Does NOT create PR** (workflow handles this)
8. **Does NOT merge code** (reviewer handles this)

### Trigger

**Create an issue with `/oc`** in the body:

```markdown
# Implement feature X

Please add feature X to increase player engagement.

/oc
```

Or edit existing issue to add `/oc`:

```markdown
Original issue description...

/oc
```

### Workflow

```
[Issue created with /oc]
         ↓
[Dev agent reads issue]
         ↓
[Dev agent explores codebase]
         ↓
[Dev agent reads issue + comments (tech-lead data)]
         ↓
[Dev agent writes code (TDD: tests first)]
         ↓
[Dev agent runs tests: npm test]
         ↓
[Dev agent runs build: npm run build]
         ↓
[Dev agent commits + pushes]
         ↓
[GitHub Actions creates PR automatically]
         ↓
[CI workflow runs (lint, test, build)]
         ↓
[Reviewer workflow analyzes PR]
         ↓
[Auto-merge or feedback]
```

### Example Issues

#### ✅ Good - Clear & Scoped

```markdown
# feat: Increase epic lootbox rarity from 3% to 8%

Players report that epic items are too rare.

## Solution
Update LOOTBOX_RARITY_WEIGHTS.epic in src/utils/lootboxUtils.ts
from 0.03 to 0.08

## Files to modify
- src/utils/lootboxUtils.ts
- src/config/gameRules.ts (if needed)

/oc
```

#### ✅ Good - Bug Fix

```markdown
# fix: Combat damage calculated incorrectly at low levels

At level 1-5, damage calculation returns negative values.

## Root cause
Division by zero in combatBalance.ts line 45

## Solution
Add guard clause to prevent division by zero

/oc
```

#### ❌ Bad - Too Vague

```markdown
# improve the game

/oc
```

#### ❌ Bad - Too Complex

```markdown
# Add complete guild system with leveling, warehouses, and PvP

This would require:
- New tables in DB
- New UI components
- New game mode
- New economy system

/oc
```

### Tips for Success

1. **Be specific**: Clear, detailed description helps agent understand
2. **Keep scope small**: Single feature per issue (1-2 files typically)
3. **Reference files**: Mention which files need changes
4. **Link related issues**: If fixing a reported bug, include issue reference
5. **Set context**: Explain why this change matters

---

## Reviewer Agent

### File: `.opencode/agents/reviewer.md`

### Role

**Autonomous code reviewer**. Reviews PRs, approves if good, requests changes if issues.

### Responsibilities

✅ **What the reviewer does**:
1. Waits for CI checks to pass
2. Reads the PR title, description, and diff
3. Checks code quality, security, tests
4. **Approves & merges** if all looks good
5. **Requests changes** if issues found
6. **Never merges** if CI is red

### Review Checklist

The reviewer checks:

1. **Tests** 🔴 (critical)
   - Do new tests exist?
   - Do all tests pass?
   - Is coverage adequate?

2. **TypeScript** 🔴 (critical)
   - No `any` types?
   - All functions typed?
   - No type errors?

3. **Conventions** 🟠
   - Follows project style?
   - Clean imports?
   - No duplication?

4. **Performance** 🟠
   - No N+1 queries?
   - No unnecessary renders?
   - No memory leaks?

5. **Security** 🔴 (critical)
   - No secrets exposed?
   - No SQL injection?
   - No XSS vulnerabilities?

6. **Scope** 🟠
   - Does it solve the issue?
   - No unnecessary changes?

### Approval Criteria

✅ **Reviewer approves & merges if**:
- CI all green ✅
- All tests pass ✅
- No TypeScript errors ✅
- Code is clean & follows conventions ✅
- No security issues ✅

❌ **Reviewer requests changes if**:
- CI is failing ❌
- Tests are failing ❌
- TypeScript errors ❌
- Duplicated code ❌
- Security concerns ❌

### Example Actions

#### ✅ Auto-Merge

```
✓ CI Passed (lint, test, build)
✓ Tests: 431/431 passed
✓ No TypeScript errors
✓ Code follows conventions
✓ No security issues

→ APPROVED & MERGED ✅
```

#### ❌ Request Changes

```
✗ Issue: New feature missing tests
✗ Issue: Duplicated code in combatUtils.ts
✗ Issue: Uses `any` type on line 45

→ REQUESTED CHANGES ❌

Please fix these issues and push again.
```

---

## Tech Lead Agent

### File: `.opencode/agents/tech-lead.md`

### Role

**Autonomous tech lead**. Daily analysis, creates strategic issues, ensures code health.

### Responsibilities

✅ **What the tech-lead does**:
1. Analyzes QA gameplay stats (`qa/stats.json`)
2. Reviews recent commits
3. Identifies bugs & imbalances
4. Creates GitHub issues for problems
5. Decides: auto-implement or human validation
6. Dispatches dev-agent for `/oc` issues

### Daily Schedule

**Runs daily at 21h (Paris time)**:

```
21:00 → Read QA stats
21:05 → Analyze HP growth, loot rarity, win rates
21:10 → Review recent commits
21:15 → Identify issues & improvements
21:20 → Create GitHub issues
21:25 → Dispatch dev-agent for auto-implement issues
21:30 → Done
```

### Issue Creation Logic

#### 🔴 Critical Bugs (with `/oc` for auto-implement)

```markdown
# fix: HP calculation returns 0 at level 10+

Players report that max HP is 0 at level 10+.
This is a blocker for game progression.

/oc
```

#### 🟠 Balance Adjustments (with `/oc` for auto-implement)

```markdown
# chore: Adjust epic lootbox rate 3% → 8%

QA data shows epic drops too rare.
Boosting engagement for high-level players.

## Change
src/utils/lootboxUtils.ts
LOOTBOX_RARITY_WEIGHTS.epic: 0.03 → 0.08

/oc
```

#### 💡 Major Features (WITHOUT `/oc`, needs human review)

```markdown
# Proposition: Daily Challenge System

Add daily quests to increase engagement:
- Defeat 10 bots
- Survive 5 minutes
- Collect 5 rare items

This requires:
- New DB tables
- New UI screens
- New game mode

Type: Proposition majeure
```

### QA Stats Analysis

The tech-lead analyzes:

```json
{
  "hp_growth": {
    "level_5": 35,
    "level_10": 45,
    "level_20": 85,
    "trend": "healthy"
  },
  "loot_rarity": {
    "common": 85,
    "rare": 12,
    "epic": 3,
    "recommendation": "increase epic to 8%"
  },
  "win_rate": {
    "last_3": 52,
    "last_5": 50,
    "trend": "stable"
  },
  "pve_analysis": {
    "total_fights": 8,
    "win_rate": 0.75,
    "avg_xp_per_fight": 108,
    "monsters_faced": { "GOBLIN": 3, "OGRE": 3, "WRAITH": 2 }
  },
  "equipment": {
    "runs_with_data": 4,
    "unique_items": 3
  },
  "streak": {
    "avg_initial": 2.5,
    "avg_final": 3.0
  }
}
```

---

## QA Tester Agent

### File: `.opencode/agents/qa-tester.md`

### Role

**Autonomous QA tester**. Runs E2E tests on live site, collects gameplay stats.

### Responsibilities

✅ **What the QA tester does**:
1. Navigates to bitbrawler.vercel.app
2. Creates/loads QA character
3. Performs **3 PvP fights + 2 PvE fights** (mixed run)
4. Captures equipment, streak, and initial/final stats
5. Claims daily lootbox
6. Tests forge system (salvage, fusion, upgrade)
7. Tests **Shop** (8-Bit Emporium) — navigates to Shop tab, reads 3 offers, attempts to buy cheapest
8. Collects enriched gameplay stats (fight_type, monster_name, pve_data, shop purchases)
9. Saves stats to `qa/stats.json`
10. Commits stats to repo

### Stats Collected

```json
{
  "timestamp": "2026-06-18T20:00:00Z",
  "character": { "max_hp": 164, "level": 5, "total_xp": 850 },
  "fights": [
    { "result": "victory", "xp": 135, "fight_duration_ms": 4200, "fight_type": "pvp" },
    { "result": "victory", "xp": 108, "fight_duration_ms": 5100, "fight_type": "pve", "monster_name": "GOBLIN" }
  ],
  "pve_data": { "fights": 2, "wins": 2, "xp_total": 216, "monsters_faced": ["GOBLIN", "OGRE"] },
  "loot": { "common": 3, "rare": 1, "epic": 0 },
  "initial_equipment": [{ "slot": "⚔️", "name": "Iron Sword" }],
  "initial_streak": 2,
  "final_streak": 3,
  "errors": 0
}
```

### Trigger

**Manual trigger**:
```bash
gh workflow run qa-tester.yml
```

**Or scheduled** (configured via external cron service)

### What's Tested

- ✅ Character creation works
- ✅ Fight system works (can attack, take damage)
- ✅ Leveling works (XP gain, level ups)
- ✅ Lootbox system works (can claim, get items)
- ✅ No crashes or errors
- ✅ Stats are collected correctly

### Data Usage

Stats are used by **tech-lead** for:
- Balance analysis
- Player progression trends
- Identifying bugs
- Optimizing game constants

---

## How to Trigger Agents

### Trigger Dev Agent (Auto-Implement)

**Option 1**: Create new issue with `/oc`
```bash
# Via GitHub UI: Create issue with /oc in body
```

**Option 2**: Edit existing issue to add `/oc`
```bash
# Via GitHub UI: Edit issue, add /oc
```

**Option 3**: Manual trigger
```bash
gh workflow run opencode.yml -f issue_number=42
```

### Trigger Reviewer Agent

Automatic when PR is created.

Manual trigger:
```bash
gh workflow run reviewer.yml -f pr_number=123
```

### Trigger Tech Lead Agent

Automatic daily at 21h (Paris time).

Manual trigger:
```bash
gh workflow run tech-lead.yml
```

### Trigger QA Tester

Manual trigger:
```bash
gh workflow run qa-tester.yml
```

---

## Agent Communication

### Understanding Agent Output

Each agent logs progress to GitHub Actions:

#### Dev Agent Logs

```
✓ Issue #42 resolved
✓ Creating branch feat/auto-42
✓ Exploring codebase...
✓ Running npm test
  ✓ 431 tests passed
✓ Running npm run build
  ✓ Build successful
✓ Pushing to feat/auto-42
✓ PR #123 created automatically
```

#### Reviewer Agent Logs

```
✓ PR #123 detected
✓ Waiting for CI checks...
✓ CI passed (lint, test, build)
✓ Analyzing code quality
  ✓ No TypeScript errors
  ✓ Tests comprehensive
  ✓ No security issues
✓ APPROVED & MERGED
✓ Branch deleted
```

#### Tech Lead Agent Logs

```
✓ QA stats found (qa/stats.json)
✓ Analyzing gameplay data
  ℹ HP growth: healthy
  ℹ Loot rarity: could boost epic
  ⚠ Win rate trending down 5%
✓ Creating issue: Boost epic lootbox rate
✓ Triggering dev-agent for auto-implement
```

### Viewing Agent Logs

```bash
# List recent runs
gh run list --limit 10

# View specific run
gh run view <RUN_ID> --log

# Example
gh run view 26414736618 --log
```

Or visit: https://github.com/stxtxm/bitbrawler/actions

---

## Debugging Failed Agents

### Dev Agent Failed

**Check**:
1. Issue description is clear?
2. Scope is reasonable (1-2 files)?
3. No typos in `/oc` command?

**Fix**:
1. Edit issue with clearer description
2. Add `/oc` again to trigger
3. Check logs for errors

### Reviewer Agent Failed

**Check**:
1. Did CI pass first?
2. Are there any test failures?
3. Any security warnings?

**Fix**:
1. Fix issues in PR
2. Push fix
3. Reviewer will retry automatically

### Tech Lead Agent Failed

**Check**:
1. Is `qa/stats.json` present?
2. Are there recent commits?

**Fix**:
1. Run QA tester first: `gh workflow run qa-tester.yml`
2. Manually trigger tech-lead: `gh workflow run tech-lead.yml`

### QA Tester Failed

**Check**:
1. Is live site up? (bitbrawler.vercel.app)
2. Network issue?
3. Playwright crash?

**Fix**:
1. Wait a minute, retry
2. Check site status
3. Manually run again

---

## Tips for Working with Agents

### Best Practices

1. **Be specific** → Clear issues → Better implementations
2. **Keep scope small** → Easier to review → Faster merge
3. **Use keywords** → `/oc` triggers agent automatically
4. **Test before requesting** → Run locally first
5. **Read feedback** → Agent provides clear explanations

### Common Patterns

**Quick fix**:
```markdown
# fix: Typo in combat text

/oc
```

**Feature implementation**:
```markdown
# feat: Add new item rarity

Add "legendary" rarity between epic and ordinary.

Files: src/data/itemAssets.ts, src/config/gameRules.ts

/oc
```

**Balance adjustment**:
```markdown
# chore: Boost XP gains for level 20+

Players report slow progression at high levels.

Increase XP multiplier from 1.0 to 1.2 for level 20+.

/oc
```

---

## Questions?

- **Agent not responding?** → Check GitHub Actions logs
- **PR not merging?** → Reviewer might have feedback
- **QA stats not appearing?** → Run QA tester manually
- **Need more help?** → Check [WORKFLOWS.md](WORKFLOWS.md)

---

## Agent Responsibilities Summary

```
┌─────────────────────────────────────────────┐
│         HUMAN DEVELOPER                      │
│  - Creates issues with /oc                   │
│  - Reviews PRs & provides feedback           │
│  - Decides major architecture changes       │
└────────────────┬────────────────────────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │   Dev Agent           │
     │  - Implements code    │
     │  - Runs tests         │
     │  - Creates commits    │
     └───────────────────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │  Reviewer Agent       │
     │  - Reviews code       │
     │  - Checks quality     │
     │  - Approves & merges  │
     └───────────────────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │  Tech Lead Agent      │
     │  - Daily analysis     │
     │  - Creates issues     │
     │  - Dispatches agents  │
     └───────────────────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │  QA Tester Agent      │
     │  - E2E tests          │
     │  - Collects stats     │
     │  - Detects bugs       │
     └───────────────────────┘
```
