#!/bin/bash

# This script sets up the Z.AI API key in Cloudflare Pages environment variables
# It should be run after the Z.AI proxy function is deployed

# Check if we have the ZAI_API_KEY
if [ -z "$ZAI_API_KEY" ]; then
    echo "Error: ZAI_API_KEY environment variable is not set"
    echo "Please set it to your Z.AI API key from ~/.local/share/opencode/auth.json"
    exit 1
fi

# Get the Cloudflare credentials
if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo "Error: CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is not set"
    echo "Please set these environment variables"
    exit 1
fi

# Deploy the proxy function with the API key
echo "Deploying Z.AI proxy function..."
npx wrangler pages deploy functions/zai-proxy --project-name bitbrawler

echo "✅ Z.AI proxy deployed successfully"
echo "📍 Proxy URL: https://bitbrawler.pages.dev/api/zai-proxy"
echo "🔧 Next step: Add this URL to your GitHub workflow secrets as PROXY_URL"
