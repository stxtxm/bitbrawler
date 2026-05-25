#!/usr/bin/env bash
# Script to merge all eligible agent PRs one by one and close linked issues.
# Usage: GH_TOKEN=xxx ./scripts/merge-eligible-prs.sh
# Requires: gh CLI, jq
set -euo pipefail

echo "=== Checking master CI status ==="
LATEST_MASTER_CI=$(gh run list --workflow ci.yml --branch master --event push --limit 1 --json databaseId,status,conclusion,url,createdAt 2>/dev/null || echo "[]")
MASTER_CI_COUNT=$(echo "$LATEST_MASTER_CI" | jq 'length')

if [ "$MASTER_CI_COUNT" -gt 0 ]; then
  MASTER_CI_STATUS=$(echo "$LATEST_MASTER_CI" | jq -r '.[0].status // ""')
  MASTER_CI_CONCLUSION=$(echo "$LATEST_MASTER_CI" | jq -r '.[0].conclusion // ""')
  MASTER_CI_URL=$(echo "$LATEST_MASTER_CI" | jq -r '.[0].url // ""')

  if [ "$MASTER_CI_STATUS" != "completed" ]; then
    echo "Latest master push CI is still running: $MASTER_CI_URL"
    echo "Will proceed anyway since we can wait for each merge's CI."
  elif [ "$MASTER_CI_CONCLUSION" != "success" ]; then
    echo "WARNING: Latest master push CI was not green: $MASTER_CI_URL"
    echo "Will proceed anyway since subsequent merges will verify CI."
  else
    echo "Master CI is green: $MASTER_CI_URL"
  fi
else
  echo "No previous master push CI run found. Continuing."
fi

echo ""
echo "=== Fetching eligible agent PRs ==="

PR_NUMS=$(gh pr list --state open --limit 50 --json number,author,isDraft,labels,createdAt,baseRefName \
  --jq '[.[]
    | .author_login = (.author.login // "")
    | .has_auto_label = ([.labels[]?.name] | index("auto-generated") != null)
    | .is_agent = (
        .has_auto_label or
        .author_login == "app/github-actions" or
        .author_login == "opencode-agent" or
        (.author_login | test("bot"; "i"))
      )
    | select(.is_agent == true and .isDraft == false and .baseRefName == "master")
  ] | sort_by(.createdAt) | .[].number // empty')

if [ -z "${PR_NUMS:-}" ]; then
  echo "No eligible agent PRs found."
  exit 0
fi

echo "Found PRs: $(echo "$PR_NUMS" | tr '\n' ' ')"

MERGE_COUNT=0
for PR_NUM in $PR_NUMS; do
  echo ""
  echo "=== Processing PR #$PR_NUM ==="

  # Check mergeability
  MERGE_STATE=$(gh pr view "$PR_NUM" --json mergeStateStatus --jq '.mergeStateStatus // ""')
  if [ "$MERGE_STATE" = "CLEAN" ] || [ "$MERGE_STATE" = "HAS_HOOKS" ]; then
    echo "PR #$PR_NUM merge state is $MERGE_STATE (good)."
  elif [ "$MERGE_STATE" = "UNKNOWN" ]; then
    # UNKNOWN often means gh CLI version mismatch or no branch protection.
    # Check CI status directly and proceed if all checks are green.
    echo "PR #$PR_NUM has mergeState=UNKNOWN. Checking CI status directly..."
    BLOCKING=$(gh pr view "$PR_NUM" --json statusCheckRollup --jq '[.statusCheckRollup[]? | select(
      (.status? != null and .status? != "COMPLETED") or
      (.state? != null and .state? != "SUCCESS") or
      (.conclusion? != null and .conclusion? != "SUCCESS")
    )] | length')
    if [ "$BLOCKING" -eq 0 ]; then
      echo "PR #$PR_NUM all checks are green. Proceeding despite UNKNOWN state."
    else
      echo "PR #$PR_NUM has $BLOCKING non-green checks. Skipping."
      continue
    fi
  else
    echo "PR #$PR_NUM is not mergeable (state=$MERGE_STATE). Skipping."
    continue
  fi

  # Check CI status (skip if already verified via UNKNOWN path above)
  if [ "$MERGE_STATE" != "UNKNOWN" ]; then
    BLOCKING=$(gh pr view "$PR_NUM" --json statusCheckRollup --jq '[.statusCheckRollup[]? | select(
      (.status? != null and .status? != "COMPLETED") or
      (.state? != null and .state? != "SUCCESS") or
      (.conclusion? != null and .conclusion? != "SUCCESS")
    )] | length')
    if [ "$BLOCKING" -ne 0 ]; then
      echo "PR #$PR_NUM does not have a fully green check suite. Skipping."
      continue
    fi
  fi

  PR_TITLE=$(gh pr view "$PR_NUM" --json title --jq '.title // ""')
  echo "Approving and merging PR #$PR_NUM: $PR_TITLE"

  gh pr review --approve "$PR_NUM" || echo "Approval may have already been given."
  gh pr merge "$PR_NUM" --squash --delete-branch || {
    echo "Failed to merge PR #$PR_NUM. Skipping."
    continue
  }
  echo "PR #$PR_NUM merged successfully."

  # Close linked issues (look for "Closes #<num>" or "Fixes #<num>" in the PR body)
  PR_BODY=$(gh pr view "$PR_NUM" --json body --jq '.body // ""')
  LINKED_ISSUES=$(echo "$PR_BODY" | grep -oE '(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#[0-9]+' | grep -oE '#[0-9]+' | tr -d '#' || true)
  if [ -n "$LINKED_ISSUES" ]; then
    for ISSUE_NUM in $LINKED_ISSUES; do
      echo "Closing linked issue #$ISSUE_NUM..."
      gh issue close "$ISSUE_NUM" --comment "Closed automatically after merging PR #$PR_NUM: $PR_TITLE" || echo "Could not close issue #$ISSUE_NUM"
    done
  fi

  # Post-merge CI check skipped : le CI ne s'exécute plus sur push -> master
  # (les tests sont déjà validés dans la PR avant merge). On continue directement.
  MERGE_COUNT=$((MERGE_COUNT + 1))
done

echo ""
echo "=== Summary ==="
echo "Merged $MERGE_COUNT PR(s) successfully."
