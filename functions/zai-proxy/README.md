# Z.AI Proxy Function

This Cloudflare Pages function acts as a proxy for the Z.AI API, allowing GitHub Actions workflows to access Z.AI models without storing API keys in GitHub secrets.

## How it works

1. The function is deployed to Cloudflare Pages at `/api/zai-proxy`
2. GitHub Actions workflows can call this endpoint with a JWT token for authentication
3. The function forwards the request to the Z.AI API using the stored API key

## Security

- The function is protected by GitHub Actions OIDC authentication
- Only requests from authorized workflows will be accepted
- The Z.AI API key is stored as a Cloudflare Pages environment variable, not in GitHub secrets

## Usage

In your GitHub Actions workflow:

```yaml
- name: Call Z.AI proxy
  run: |
    # Get a JWT token from GitHub
    JWT_TOKEN=$(gh auth token --scopes=repo)
    
    # Call the proxy
    RESPONSE=$(curl -s -X POST \
      -H "Authorization: Bearer $JWT_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"prompt": "Your prompt here"}' \
      https://bitbrawler.pages.dev/api/zai-proxy)
    
    # Parse the response
    COMPLETION=$(echo "$RESPONSE" | jq -r '.completion')
    echo "Completion: $COMPLETION"
```

## Configuration

1. Set the `ZAI_API_KEY` environment variable in the Cloudflare Pages dashboard
2. Ensure the function is deployed to production
3. Update your workflows to use the proxy endpoint instead of direct Z.AI API calls

## Local Development

To test locally:

```bash
# Set the API key in your environment
export ZAI_API_KEY="your-api-key-here"

# Start the development server
npm run dev

# Test the proxy
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, world!"}' \
  http://localhost:5173/api/zai-proxy
```
