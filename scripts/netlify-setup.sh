#!/usr/bin/env bash
# One-shot Netlify environment setup.
#
# Why this exists: the deploy needs 5 variables, 4 of which already sit in the
# local .env. Pasting service-role keys by hand is both tedious and a hygiene
# risk, so this reads them straight from .env and pushes them through the
# Netlify CLI, which never echoes the values back.
#
# Requires an already-linked site (netlify link) so --site resolves.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $(pwd)" >&2
  exit 1
fi

read_env() {
  # Prints the value of KEY=... from .env without the key prefix.
  grep -m1 "^$1=" .env | cut -d= -f2- | tr -d '"' | tr -d '\n'
}

required=(SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY)

missing=()
for key in "${required[@]}"; do
  value="$(read_env "$key")"
  if [ -z "$value" ]; then
    missing+=("$key")
    continue
  fi
  echo "-> setting $key (${#value} chars)"
  npx --yes netlify-cli env:set --context production "$key" "$value"
done

if [ ${#missing[@]} -gt 0 ]; then
  echo
  echo "ERROR: missing from .env: ${missing[*]}" >&2
  exit 1
fi

cat <<'EOF'

Done: 4 server/build variables pushed to Netlify (production).

ONE LEFT TO ADD BY HAND, because it is not in .env and is unreadable from CI:
  VITE_VAPID_PUBLIC_KEY   <- the public VAPID application server key

  Site settings -> Environment variables -> add it, then redeploy.

Check afterwards:
  netlify env:list            # 5 variables, production
  netlify deploy --prod
EOF