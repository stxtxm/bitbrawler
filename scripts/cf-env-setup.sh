#!/usr/bin/env bash
# One-shot Cloudflare Pages environment setup.
#
# Why this exists: the deploy needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
# Pasting a service-role key by hand is both tedious and a hygiene risk, so this
# reads them straight from .env and pushes them through the Wrangler CLI, which
# never echoes the values back.
#
# Requires: an existing Pages project named in wrangler.toml, and
#   npx wrangler login
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

missing=()
pushed=0

for key in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY; do
  value="$(read_env "$key")"
  if [ -z "$value" ]; then
    missing+=("$key")
    continue
  fi
  echo "-> setting $key (${#value} chars)"
  # Wrangler wants the key=value form as a single argument, and `--` stops it
  # from swallowing a value that starts with a dash.
  npx --yes wrangler pages secret put "$key" --project-name bitbrawler <<<"$value"
  pushed=$((pushed + 1))
done

if [ ${#missing[@]} -gt 0 ]; then
  echo
  echo "ERROR: missing from .env: ${missing[*]}" >&2
  exit 1
fi

cat <<'EOF'

Done: $pushed server variable(s) pushed to Cloudflare Pages (production).

These are secrets and are NOT exposed to the client bundle. The client only
needs VITE_SUPABASE_* / VITE_VAPID_PUBLIC_KEY, which Cloudflare injects at
build time from the project's build variables (dashboard > Settings >
Environment variables > Production and Preview).

First deploy:
  npx wrangler pages deploy dist --project-name bitbrawler

Then verify:
  curl -i https://<ton-site>.pages.dev/api/idle-processor
  -> must answer HTTP 405 {"error":"POST required"}, never the SPA HTML.
EOF