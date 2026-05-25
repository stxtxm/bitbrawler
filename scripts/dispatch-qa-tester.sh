#!/usr/bin/env bash
# ==============================================================
# Script de dispatch du workflow QA Tester pour cron externe
# ==============================================================
# Utilisation prévue : appelé par cron-job.org ou similaire
# pour garantir l'exécution du QA tester (les crons GitHub
# Actions sont peu fiables ~20% de taux d'exécution).
#
# Configuration sur cron-job.org (gratuit) :
#   1. Créer un compte sur https://cron-job.org
#   2. Créer un job :
#      - URL:  https://api.github.com/repos/stxtxm/bitbrawler/actions/workflows/qa-tester.yml/dispatches
#      - Method: POST
#      - Headers:
#          Authorization: Bearer <GH_TOKEN>
#          Accept: application/vnd.github+json
#          Content-Type: application/json
#      - Body: {"ref":"master"}
#      - Schedule: 0 6,9,12,15,18 * * * (5x/jour comme le cron original)
#   3. Le GH_TOKEN doit être un Personal Access Token (classic)
#      avec scope "workflow" créé sur GitHub Settings → Developer settings → Personal access tokens
#
# Usage direct :
#   GH_TOKEN=ghp_xxx bash scripts/dispatch-qa-tester.sh
# ==============================================================

set -euo pipefail

TOKEN="${GH_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  echo "❌ GH_TOKEN environment variable is required"
  exit 1
fi

echo "🚀 Dispatching QA Tester workflow..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "Content-Type: application/json" \
  -d '{"ref":"master"}' \
  "https://api.github.com/repos/stxtxm/bitbrawler/actions/workflows/qa-tester.yml/dispatches")

if [ "$HTTP_CODE" = "204" ]; then
  echo "✅ QA Tester dispatched successfully"
else
  echo "❌ Dispatch failed (HTTP $HTTP_CODE)"
  exit 1
fi
