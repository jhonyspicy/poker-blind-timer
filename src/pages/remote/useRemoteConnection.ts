import * as Ably from 'ably'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ablyChannelName,
  createRealtimeClient,
  isPairingConfigured,
} from '../../realtime/connection'
import {
  MESSAGE_NAME,
  type RemoteCommand,
  type RemoteCommandInput,
  type StateSnapshot,
} from '../../realtime/messages'

export interface RemoteConnection {
  configured: boolean
  connectionState: string
  snapshot: StateSnapshot | null
  /** requestId を付与してコマンドを publish する */
  send: (command: RemoteCommandInput) => void
}

/** リモコン側の Ably 接続。state を購読し、接続(再接続)時に最新状態を要求する */
export function useRemoteConnection(channelId: string | null): RemoteConnection {
  const configured = isPairingConfigured()
  const [connectionState, setConnectionState] = useState('disconnected')
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null)
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  useEffect(() => {
    if (!channelId || !configured) return
    const client = createRealtimeClient(channelId)
    const channel = client.channels.get(ablyChannelName(channelId))
    channelRef.current = channel

    client.connection.on((stateChange) => {
      setConnectionState(stateChange.current)
      // 接続直後と再接続時に最新状態を要求して表示を同期する
      if (stateChange.current === 'connected') {
        void channel
          .publish(MESSAGE_NAME.command, {
            type: 'REQUEST_STATE',
            requestId: crypto.randomUUID(),
          } satisfies RemoteCommand)
          .catch(() => {})
      }
    })
    void channel.subscribe(MESSAGE_NAME.state, (message) => {
      setSnapshot(message.data as StateSnapshot)
    })

    return () => {
      channelRef.current = null
      client.close()
    }
  }, [channelId, configured])

  const send = useCallback((command: RemoteCommandInput) => {
    const channel = channelRef.current
    if (!channel) return
    void channel
      .publish(MESSAGE_NAME.command, { ...command, requestId: crypto.randomUUID() })
      .catch(() => {
        // 切断中は届かないが、サイネージが正なので再接続後の状態同期に任せる
      })
  }, [])

  return { configured, connectionState, snapshot, send }
}
