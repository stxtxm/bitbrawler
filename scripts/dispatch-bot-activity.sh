#!/usr/bin/env bash
# ==============================================================
# Script de dispatch du workflow Bot Activity pour cron externe
# ==============================================================
# Utilisation prevue : appele par cron-job.org ou similaire.
# Cron GitHub Actions desactive car ~20% de fiable seulement.
#
# Configuration sur cron-job.org (gratuit) :
#   1. Creer un compte sur https://cron-job.org
#   2. Creer un job :
#      - URL:  https://api.github.com/repos/stxtxm/bitbrawler/actions/workflows/bot-activity.yml/dispatches
#      - Method: POST
#      - Headers:
#          Authorization: Bearer <GH_TOKEN>
#          Accept: application/vnd.github+json
#          Content-Type: application/json
#      - Body: {"ref":"master"}
#      - Schedule: toutes les 2 heures (comme l'ancien cron)
#   3. GH_TOKEN = Personal Access Token (classic) scope "workflow"
#
# Usage direct :
#   GH_TOKEN=ghp_xxx bash scripts/dispatch-bot-activity.sh
# ==============================================================

set -euo pipefail

TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "GH_TOKEN environment variable is required"
  exit 1
fi

echo "Dispatching Bot Activity workflow..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{"ref":"master"}' \
  "https://api.github.com/repos/stxtxm/bitbrawler/actions/workflows/bot-activity.yml/dispatches")

if [ "$HTTP_CODE" = "204" ]; then
  echo "Bot Activity dispatched successfully"
else
  echo "Dispatch failed (HTTP $HTTP_CODE)"
  exit 1
fi
