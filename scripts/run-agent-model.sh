#!/usr/bin/env bash
#
# Runs one opencode model attempt with an early-abort watchdog.
#
# Why this exists (incident 2026-11-01 → 2026-11-04)
# ---------------------------------------------------
# The free `opencode/*-free` models answer immediately with:
#
#   AI_APICallError: Free usage limit reached. Free models work in OpenCode
#   (https://opencode.ai); subscribe to OpenCode Go to keep going
#
# The quota is per IP and per UTC day, and it is shared by every `*-free`
# slug. GitHub-hosted runners use shared egress IPs, so the bucket is already
# empty before the first request: switching from deepseek to glm to nemotron
# changes nothing. Worse, the CLI retries the failed call for ~2 minutes
# before exiting, so a 3-model chain burned ~24 minutes and the job died at
# the step timeout with no usable diagnostic.
#
# This wrapper streams the opencode log to the job output and kills the
# attempt as soon as a *fatal* provider error appears. The caller can then
# move to a fallback bearer of an actual quota (via broker OIDC, e.g. Z.AI GLM).
#
# Usage:
#   scripts/run-agent-model.sh --model <provider/model> --budget 8m \
#     [--agent <name>] (--prompt <text> | --prompt-file <path>)
#
# Exit codes:
#   0    success
#   42   free quota exhausted (shared by every opencode/*-free slug)
#   43   credential rejected / expired
#   44   model unknown or retired
#   45   repeated provider errors (service instable) — bail to save budget
#   124  wall-clock budget exhausted (timeout)
#   *    opencode's own exit code
#
set -uo pipefail

MODEL=""
AGENT=""
BUDGET=""
PROMPT=""
PROMPT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model) MODEL="${2:-}"; shift 2 ;;
    --agent) AGENT="${2:-}"; shift 2 ;;
    --budget) BUDGET="${2:-}"; shift 2 ;;
    --prompt) PROMPT="${2:-}"; shift 2 ;;
    --prompt-file) PROMPT_FILE="${2:-}"; shift 2 ;;
    *)
      echo "run-agent-model: option inconnue: $1" >&2
      exit 2
      ;;
  esac
done

[[ -n "$MODEL" ]] || { echo "run-agent-model: --model est requis" >&2; exit 2; }
[[ -n "$BUDGET" ]] || { echo "run-agent-model: --budget est requis" >&2; exit 2; }
if [[ -n "$PROMPT_FILE" ]]; then
  PROMPT="$(cat "$PROMPT_FILE")"
fi
[[ -n "$PROMPT" ]] || { echo "run-agent-model: --prompt ou --prompt-file est requis" >&2; exit 2; }

LOG="$(mktemp -t opencode-model.XXXXXX.log)"
trap 'rm -f "$LOG"' EXIT

# The flag value is case-sensitive and changed between CLI majors:
#   1.x expects --log-level INFO, 2.x expects --log-level info (1.x rejects
#   "info" with a CliError/InvalidValue and prints help).
OC_MAJOR="$(opencode --version 2>/dev/null | grep -oE '[0-9]+' | head -1 || true)"
LOG_LEVEL=INFO
[[ "${OC_MAJOR:-1}" -ge 2 ]] && LOG_LEVEL=info

ARGS=(run --print-logs --log-level "$LOG_LEVEL" --dangerously-skip-permissions --model "$MODEL")
[[ -n "$AGENT" ]] && ARGS+=(--agent "$AGENT")
ARGS+=("$PROMPT")

# Fatal provider answers. The `level=ERROR` anchor matters: the log also holds
# the agent's own transcript, and an agent working on a quota bug will happily
# echo the quota message. Only opencode's error lines may abort the attempt.
# `AI_RetryError: Failed after 3 attempts. Last error: ...` matches too, which
# is what the CLI prints once it gives up.
QUOTA_RE='level=ERROR.*(Free usage limit reached|FreeUsageLimitError|FreeTierError|free starter model is busy|Insufficient balance or no resource package)'
AUTH_RE='level=ERROR.*(This API key has expired|Incorrect API key|invalid_api_key|authentication_error|AI_APICallError: 401)'
MODEL_RE='level=ERROR.*(UnknownError: Unexpected server error|model_not_found|Model not found|does not exist or you do not have access)'
# Transient-but-stuck: repeated provider failures waste budget (observed Z.AI
# "Operation failed" / "temporarily overloaded" burning 15 min). Bail after 4.
DEGRADED_RE='level=ERROR.*(AI_APICallError: Operation failed|temporarily overloaded, please try again later)'

echo "opencode: modèle=$MODEL budget=$BUDGET agent=${AGENT:-default}"

# `timeout` guarantees the wall-clock budget; the watchdog below only cuts
# short the cases we know are hopeless (quota, dead key, retired slug, or
#   repeatedly failing provider).
timeout -k 5s "$BUDGET" opencode "${ARGS[@]}" >"$LOG" 2>&1 &
PID=$!

QUOTA=0
AUTH=0
MODEL_ERR=0

DEGRADED=0
while kill -0 "$PID" 2>/dev/null; do
  sleep 1
  if grep -qE "$QUOTA_RE" "$LOG" 2>/dev/null; then
    QUOTA=1
    break
  fi
  if grep -qE "$AUTH_RE" "$LOG" 2>/dev/null; then
    AUTH=1
    break
  fi
  if grep -qE "$MODEL_RE" "$LOG" 2>/dev/null; then
    MODEL_ERR=1
    break
  fi
  if grep -cE "$DEGRADED_RE" "$LOG" 2>/dev/null | grep -qE '^[4-9]|^[1-9][0-9]'; then
    DEGRADED=1
    break
  fi
done

if [[ "$QUOTA" -eq 1 || "$AUTH" -eq 1 || "$MODEL_ERR" -eq 1 || "$DEGRADED" -eq 1 ]]; then
  kill -TERM "$PID" 2>/dev/null || true
  sleep 2
  kill -KILL "$PID" 2>/dev/null || true
fi

wait "$PID" 2>/dev/null
RC=$?

# The log is printed in full: on a real failure it is the only evidence of
# which provider answered what, and the workflow log is what future agents
# read when they debug the chain.
cat "$LOG"

if [[ "$QUOTA" -eq 1 ]]; then
  echo "run-agent-model: quota gratuit épuisé pour $MODEL (partagé par les slugs *-free) — repli."
  exit 42
fi
if [[ "$AUTH" -eq 1 ]]; then
  echo "run-agent-model: credential refusé pour $MODEL — repli."
  exit 43
fi
if [[ "$MODEL_ERR" -eq 1 ]]; then
  echo "run-agent-model: modèle $MODEL indisponible ou retiré — repli."
  exit 44
fi
if [[ "$DEGRADED" -eq 1 ]]; then
  echo "run-agent-model: erreurs provider répétées pour $MODEL (service instable) — repli/abandon pour économiser le quota."
  exit 45
fi

exit "$RC"
