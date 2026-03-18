import OpenAI from 'openai';
import type { RequestHandler } from './$types';
import { checkRateLimit, getRemainingRequests, getResetTime } from '$lib/server/rateLimit';

type RuntimeEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
  ALLOWED_ORIGIN?: string;
  RATE_LIMIT_REQUESTS?: string;
  RATE_LIMIT_WINDOW_MS?: string;
};

function getRuntimeEnv(platform: App.Platform | undefined): RuntimeEnv {
  const platformEnv = (platform?.env as RuntimeEnv | undefined) ?? {};

  return {
    OPENAI_API_KEY: platformEnv.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? process.env.API_KEY,
    OPENAI_MODEL: platformEnv.OPENAI_MODEL ?? process.env.OPENAI_MODEL ?? process.env.MODEL_NAME,
    OPENAI_BASE_URL:
      platformEnv.OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? process.env.ENDPOINT,
    ALLOWED_ORIGIN: platformEnv.ALLOWED_ORIGIN ?? process.env.ALLOWED_ORIGIN ?? process.env.ORIGIN,
    RATE_LIMIT_REQUESTS: platformEnv.RATE_LIMIT_REQUESTS ?? process.env.RATE_LIMIT_REQUESTS ?? '10',
    RATE_LIMIT_WINDOW_MS: platformEnv.RATE_LIMIT_WINDOW_MS ?? process.env.RATE_LIMIT_WINDOW_MS ?? '60000',
  };
}

export const POST: RequestHandler = async ({ request, platform }) => {
  const env = getRuntimeEnv(platform);

  if (!env.OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: 'Missing OPENAI_API_KEY secret' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!env.OPENAI_MODEL) {
    return new Response(JSON.stringify({ error: 'Missing OPENAI_MODEL variable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting check
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
                    request.headers.get('cf-connecting-ip') ||
                    'unknown';
  const maxRequests = parseInt(env.RATE_LIMIT_REQUESTS ?? '10', 10);
  const windowMs = parseInt(env.RATE_LIMIT_WINDOW_MS ?? '60000', 10); // 1 minute default

  if (!checkRateLimit(clientIp, maxRequests, windowMs)) {
    const resetTime = getResetTime(clientIp);
    return new Response(JSON.stringify({ 
      error: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(resetTime / 1000),
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil(resetTime / 1000).toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + resetTime).toISOString(),
      },
    });
  }

  const remaining = getRemainingRequests(clientIp, maxRequests);
  const resetTime = getResetTime(clientIp);
  const rateLimitHeaders = {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(Date.now() + resetTime).toISOString(),
  };

  const origin = request.headers.get('origin') ?? '';
  const isOriginAllowed = (() => {
    if (!env.ALLOWED_ORIGIN || !origin) return true;
    if (origin === env.ALLOWED_ORIGIN) return true;

    try {
      const originUrl = new URL(origin);
      const allowedUrl = new URL(env.ALLOWED_ORIGIN);
      const bothLocalhost =
        (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') &&
        (allowedUrl.hostname === 'localhost' || allowedUrl.hostname === '127.0.0.1');

      // Allow localhost origin mismatch by port for local dev only.
      return bothLocalhost;
    } catch {
      return false;
    }
  })();

  if (!isOriginAllowed) {
    return new Response(JSON.stringify({ error: 'Forbidden origin' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload: { message?: string; options?: { systemPrompt?: string } };
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const message = payload.message?.trim();
  if (!message) {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL || undefined,
  });

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    ...(payload.options?.systemPrompt
      ? [{ role: 'system' as const, content: payload.options.systemPrompt }]
      : []),
    { role: 'user' as const, content: message },
  ];

  const completion = await client.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages,
    stream: false,
  });

  const text = completion.choices?.[0]?.message?.content ?? '';
  return new Response(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...rateLimitHeaders,
    },
  });
};
