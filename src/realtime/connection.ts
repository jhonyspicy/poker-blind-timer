import * as Ably from 'ably'

export const PAIRING_API_URL: string | null = import.meta.env.VITE_PAIRING_API_URL ?? null

/** リモコン連携(Worker + Ably)が設定されているか */
export function isPairingConfigured(): boolean {
  return PAIRING_API_URL !== null && PAIRING_API_URL !== ''
}

/** サイネージが呼ぶ。推測不能なチャンネル ID を Worker から発行してもらう */
export async function createChannelId(): Promise<string> {
  const response = await fetch(`${PAIRING_API_URL}/session`, { method: 'POST' })
  if (!response.ok) throw new Error(`session request failed: ${response.status}`)
  const data = (await response.json()) as { channelId: string }
  return data.channelId
}

/** QR コードに載せるリモコン用 URL */
export function buildRemoteUrl(channelId: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}remote?ch=${channelId}`
}

/** Worker 側の channelName(`bt:<id>`)と一致させる */
export function ablyChannelName(channelId: string): string {
  return `bt:${channelId}`
}

/**
 * トークン認証(authUrl)で Ably Realtime クライアントを作る。
 * API キーはフロントに存在せず、Worker が対象チャンネル限定のトークンを発行する。
 */
export function createRealtimeClient(channelId: string): Ably.Realtime {
  return new Ably.Realtime({
    authUrl: `${PAIRING_API_URL}/token`,
    authParams: { ch: channelId },
    authMethod: 'GET',
  })
}
