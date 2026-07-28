import * as Ably from 'ably'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ablyChannelName,
  buildRemoteUrl,
  createChannelId,
  createRealtimeClient,
  isPairingConfigured,
} from '../../realtime/connection'
import { MESSAGE_NAME, type RemoteCommand } from '../../realtime/messages'
import { buildSnapshot } from '../../realtime/snapshot'
import type { SignageController } from './useSignageSession'

/** リロードしても同じ QR が使えるよう、タブ内でチャンネル ID を保持する */
const CHANNEL_STORAGE_KEY = 'pbt-channel-id'

export interface SignagePairing {
  configured: boolean
  channelId: string | null
  remoteUrl: string | null
  connectionState: string
  error: string | null
}

/**
 * サイネージ側のリアルタイム連携。
 * チャンネル ID の発行 → Ably 接続 → コマンド受信の適用と状態スナップショットの publish。
 */
export function useSignageRealtime(controller: SignageController): SignagePairing {
  const active = controller.phase === 'active'
  const configured = isPairingConfigured()

  const [channelId, setChannelId] = useState<string | null>(null)
  const [connectionState, setConnectionState] = useState('disconnected')
  const [error, setError] = useState<string | null>(null)

  // publish は常に最新の状態を参照したいので ref 経由にする(render 中の書き込みを避け effect で同期)
  const stateRef = useRef({ config: controller.config, session: controller.session })
  const applyRef = useRef(controller.applyRemoteCommand)
  useEffect(() => {
    stateRef.current = { config: controller.config, session: controller.session }
    applyRef.current = controller.applyRemoteCommand
  })
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  const publishState = useCallback(() => {
    const { config, session } = stateRef.current
    const channel = channelRef.current
    if (!channel || !config || !session) return
    void channel
      .publish(MESSAGE_NAME.state, buildSnapshot(config, session, Date.now()))
      .catch(() => {
        // 切断中の publish 失敗は無視する。再接続時に REQUEST_STATE で同期される
      })
  }, [])

  // トーナメント終了(select へ戻る)で次回は新しいチャンネル ID を発行する
  useEffect(() => {
    if (!active) sessionStorage.removeItem(CHANNEL_STORAGE_KEY)
  }, [active])

  useEffect(() => {
    if (!active || !configured) return
    let disposed = false
    let client: Ably.Realtime | null = null
    ;(async () => {
      let id = sessionStorage.getItem(CHANNEL_STORAGE_KEY)
      if (!id) {
        id = await createChannelId()
        sessionStorage.setItem(CHANNEL_STORAGE_KEY, id)
      }
      if (disposed) return
      setChannelId(id)
      client = createRealtimeClient(id)
      client.connection.on(() => {
        if (client) setConnectionState(client.connection.state)
      })
      const channel = client.channels.get(ablyChannelName(id))
      channelRef.current = channel
      await channel.subscribe(MESSAGE_NAME.command, (message) => {
        const command = message.data as RemoteCommand
        if (!command || typeof command.type !== 'string') return
        if (command.type === 'REQUEST_STATE') {
          publishState()
          return
        }
        applyRef.current(command)
      })
      publishState()
    })().catch((cause) => {
      if (!disposed) setError(cause instanceof Error ? cause.message : String(cause))
    })
    return () => {
      disposed = true
      channelRef.current = null
      client?.close()
    }
  }, [active, configured, publishState])

  // タイマー状態・履歴・タイトルの変化を publish(毎秒の残り時間 tick では発火しない)
  const timer = controller.session?.timer
  const histories = controller.session?.histories
  const titleOverride = controller.session?.titleOverride
  useEffect(() => {
    publishState()
  }, [timer, histories, titleOverride, publishState])

  return {
    configured,
    channelId,
    remoteUrl: channelId ? buildRemoteUrl(channelId) : null,
    connectionState,
    error,
  }
}
