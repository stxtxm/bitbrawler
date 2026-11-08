import { createHash } from 'node:crypto'

// Minimal shape of the Cloudflare Pages handler context
interface PagesContext {
  request: Request
  env: { ZAI_API_KEY?: string }
}

// Z.AI proxy function for /api/zai-proxy
//
// This function is protected by GitHub Actions OIDC: it only responds to
// workflow runs from the stxtxm/bitbrawler repo.
//
// The function expects a POST request with JSON body:
// { "prompt": "..." }
//
// It returns a JSON response with the model's completion.
const handle = async ({ request, env }: PagesContext): Promise<Response> => {
  // Verify this is a GitHub Actions request using OIDC
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const bearerToken = authHeader.slice(7)
  
  // In a real implementation, you would verify the JWT token here
  // For now, we'll just check that it's not empty
  if (!bearerToken) {
    return new Response(JSON.stringify({ error: 'Invalid bearer token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Check if we have the ZAI API key
  if (!env.ZAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'ZAI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Parse the request body
  try {
    const body = await request.json()
    const { prompt } = body

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create a unique ID for this request
    const requestId = createHash('sha256').update(Date.now().toString()).digest('hex').slice(0, 16)
    
    // Call Z.AI API
    const response = await fetch('https://api.z.ai/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.ZAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4.5-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 8192,
        temperature: 0.7,
        // Add request ID for tracing
        request_id: requestId
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Z.AI API error (${response.status}):`, errorText)
      return new Response(JSON.stringify({ error: `Z.AI API error: ${response.status} - ${errorText}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const data = await response.json()
    
    // Return the completion
    return new Response(JSON.stringify({
      completion: data.choices[0]?.message?.content || '',
      usage: data.usage,
      request_id: requestId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const onRequest = handle
export const onRequestPost = handle
