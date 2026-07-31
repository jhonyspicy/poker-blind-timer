/**
 * ペアリング用 Worker。
 * - POST /session: 推測不能なチャンネル ID を発行する(この ID がセキュリティ境界)
 * - GET /token?ch=<id>: 対象チャンネルに capability を限定した Ably TokenRequest を返す
 * Ably の API キーはこの Worker の secret(ABLY_API_KEY)のみに保持する。
 */

export interface Env {
  ABLY_API_KEY: string
}

const ALLOWED_ORIGINS = new Set([
  'https://jhonyspicy.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
])

/** チャンネル ID(base64url)の形式。生成は 16 バイト = 22 文字 */
const CHANNEL_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/

const TOKEN_TTL_MS = 60 * 60 * 1000

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin')
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}

function json(data: unknown, request: Request, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  })
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function createChannelId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return base64urlEncode(bytes)
}

export function channelName(channelId: string): string {
  return `bt:${channelId}`
}

async function hmacSha256Base64(secret: string, text: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(text))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/**
 * Ably の署名付き TokenRequest を生成する(SDK 不使用)。
 * https://ably.com/docs/auth/token#token-request
 */
async function createTokenRequest(
  apiKey: string,
  channelId: string,
): Promise<Record<string, unknown>> {
  const [keyName, keySecret] = apiKey.split(':')
  if (!keyName || !keySecret) throw new Error('ABLY_API_KEY is malformed')

  // presence はリモコン接続の検知(入室の宣言と購読)に使う
  const capability = JSON.stringify({
    [channelName(channelId)]: ['publish', 'subscribe', 'presence'],
  })
  const timestamp = Date.now()
  const nonce = base64urlEncode(crypto.getRandomValues(new Uint8Array(12)))

  // clientId はワイルドカード。presence への入室にはクライアントが clientId を
  // 名乗る必要があり、'*' はどの clientId でも許可する(空文字は Ably が 40012 で拒否)
  const clientId = '*'
  const signText = `${keyName}\n${TOKEN_TTL_MS}\n${capability}\n${clientId}\n${timestamp}\n${nonce}\n`
  const mac = await hmacSha256Base64(keySecret, signText)

  return { keyName, ttl: TOKEN_TTL_MS, capability, clientId, timestamp, nonce, mac }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    if (request.method === 'POST' && url.pathname === '/session') {
      return json({ channelId: createChannelId() }, request)
    }

    if (request.method === 'GET' && url.pathname === '/token') {
      const channelId = url.searchParams.get('ch')
      if (!channelId || !CHANNEL_ID_PATTERN.test(channelId)) {
        return json({ error: 'invalid channel id' }, request, 400)
      }
      try {
        const tokenRequest = await createTokenRequest(env.ABLY_API_KEY, channelId)
        return json(tokenRequest, request)
      } catch {
        return json({ error: 'token request failed' }, request, 500)
      }
    }

    return json({ error: 'not found' }, request, 404)
  },
} satisfies ExportedHandler<Env>
