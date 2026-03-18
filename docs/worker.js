function buildCorsHeaders(origin, allowedOrigin) {
  const allowOrigin = allowedOrigin || origin || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function buildChatCompletionsUrl(baseUrl) {
  if (!baseUrl) return 'https://api.openai.com/v1/chat/completions';
  const normalized = baseUrl.replace(/\/$/, '');
  if (normalized.endsWith('/chat/completions')) return normalized;
  return `${normalized}/chat/completions`;
}

function jsonResponse(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Serve static docs assets and pages for all non-chat paths.
    if (url.pathname !== '/chat') {
      return env.ASSETS.fetch(request);
    }

    const origin = request.headers.get('Origin') || '';
    const allowedOrigin = env.ALLOWED_ORIGIN || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(origin, allowedOrigin),
      });
    }

    if (request.method !== 'POST') {
      return jsonResponse(
        { error: 'Method Not Allowed' },
        405,
        buildCorsHeaders(origin, allowedOrigin)
      );
    }

    if (allowedOrigin && origin && origin !== allowedOrigin) {
      return jsonResponse(
        { error: 'Forbidden origin' },
        403,
        buildCorsHeaders(origin, allowedOrigin)
      );
    }

    if (!env.OPENAI_API_KEY) {
      return jsonResponse(
        { error: 'Missing OPENAI_API_KEY secret' },
        500,
        buildCorsHeaders(origin, allowedOrigin)
      );
    }

    if (!env.OPENAI_MODEL) {
      return jsonResponse(
        { error: 'Missing OPENAI_MODEL variable' },
        500,
        buildCorsHeaders(origin, allowedOrigin)
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(
        { error: 'Invalid JSON body' },
        400,
        buildCorsHeaders(origin, allowedOrigin)
      );
    }

    const message = (payload?.message || '').toString().trim();
    const systemPrompt = (payload?.options?.systemPrompt || '').toString().trim();

    if (!message) {
      return jsonResponse(
        { error: 'message is required' },
        400,
        buildCorsHeaders(origin, allowedOrigin)
      );
    }

    const upstreamUrl = buildChatCompletionsUrl(env.OPENAI_BASE_URL || '');
    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        stream: false,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: message },
        ],
      }),
    });

    if (!upstreamRes.ok) {
      const errorText = await upstreamRes.text();
      return new Response(errorText || 'Upstream request failed', {
        status: upstreamRes.status,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          ...buildCorsHeaders(origin, allowedOrigin),
        },
      });
    }

    const data = await upstreamRes.json();
    const text = data?.choices?.[0]?.message?.content || '';

    return new Response(text, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...buildCorsHeaders(origin, allowedOrigin),
      },
    });
  },
};
