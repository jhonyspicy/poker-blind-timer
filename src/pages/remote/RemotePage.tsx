import * as Ably from 'ably'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  ablyChannelName,
  createRealtimeClient,
  isPairingConfigured,
} from '../../realtime/connection'
import { MESSAGE_NAME } from '../../realtime/messages'

/**
 * リモコン画面の雛形 + リアルタイム接続テスト(仮)。
 * `?ch=` で接続し、command(REQUEST_STATE)の送信と state の受信のみを確認する。
 * 本実装(操作 UI)は画面の作り直しステップで置き換える。
 */
export default function RemotePage() {
  const [searchParams] = useSearchParams()
  const channelId = searchParams.get('ch')
  const [logs, setLogs] = useState<string[]>([])
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${message}`])
  }

  useEffect(() => {
    if (!channelId || !isPairingConfigured()) return
    // presence 入室には clientId が必要(トークンはワイルドカード許可)
    const client = createRealtimeClient(channelId, `remote-${crypto.randomUUID().slice(0, 8)}`)
    client.connection.on('connected', () => addLog('Ably に接続しました'))
    client.connection.on('disconnected', () => addLog('Ably から切断されました(再接続待ち)'))
    client.connection.on('failed', (stateChange) => {
      addLog(`Ably 接続失敗: ${stateChange.reason?.message ?? '不明なエラー'}`)
    })
    const channel = client.channels.get(ablyChannelName(channelId))
    channelRef.current = channel
    void channel
      .subscribe(MESSAGE_NAME.state, (message) => {
        addLog(`受信(state): ${JSON.stringify(message.data)}`)
      })
      .then(() => addLog('state の購読を開始しました'))
    // サイネージ側の接続検知(presence)のため入室を宣言する
    void channel.presence
      .enter({ role: 'remote' })
      .then(() => addLog('presence: 入室を宣言しました'))
      .catch((error: unknown) =>
        addLog(`presence エラー: ${error instanceof Error ? error.message : String(error)}`),
      )
    return () => {
      channelRef.current = null
      client.close()
    }
  }, [channelId])

  const sendCommand = () => {
    const requestId = crypto.randomUUID()
    void channelRef.current?.publish(MESSAGE_NAME.command, { type: 'REQUEST_STATE', requestId })
    addLog(`送信(command): REQUEST_STATE (${requestId.slice(0, 8)}…)`)
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '48rem' }}>
      <h1>リモコン(接続テスト)</h1>
      <p>操作 UI は未実装です。ここではサイネージとのリアルタイム接続の疎通のみ確認できます。</p>
      {!isPairingConfigured() ? (
        <p>
          VITE_PAIRING_API_URL が設定されていないため、接続テストは実行できません(.env.local
          を確認)。
        </p>
      ) : !channelId ? (
        <p>チャンネル識別子がありません。サイネージが表示するリモコン URL から開いてください。</p>
      ) : (
        <p>
          <button type="button" onClick={sendCommand}>
            command を送信(REQUEST_STATE)
          </button>
        </p>
      )}
      <ul style={{ fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: 1.7 }}>
        {logs.map((log, index) => (
          <li key={index}>{log}</li>
        ))}
      </ul>
      <p>
        <Link to="/">← トップへ戻る</Link>
      </p>
    </main>
  )
}
