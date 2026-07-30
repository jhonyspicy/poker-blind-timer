import * as Ably from 'ably'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  ablyChannelName,
  buildRemoteUrl,
  createChannelId,
  createRealtimeClient,
  isPairingConfigured,
} from '../../realtime/connection'
import { MESSAGE_NAME } from '../../realtime/messages'

/**
 * サイネージ画面の雛形 + リアルタイム接続テスト(仮)。
 * チャンネル発行 → リモコン URL 表示 → command 受信で state を返す疎通確認のみを行う。
 * 本実装(タイマー表示)は画面の作り直しステップで置き換える。
 */
export default function SignagePage() {
  const [channelId, setChannelId] = useState<string | null>(null)
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const clientRef = useRef<Ably.Realtime | null>(null)

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} ${message}`])
  }

  useEffect(
    () => () => {
      clientRef.current?.close()
    },
    [],
  )

  const startTest = async () => {
    try {
      const id = await createChannelId()
      setChannelId(id)
      setRemoteUrl(buildRemoteUrl(id))
      addLog(`チャンネル ID を発行: ${id}`)

      const client = createRealtimeClient(id)
      clientRef.current = client
      client.connection.on('connected', () => addLog('Ably に接続しました'))
      client.connection.on('disconnected', () => addLog('Ably から切断されました(再接続待ち)'))
      client.connection.on('failed', (stateChange) => {
        addLog(`Ably 接続失敗: ${stateChange.reason?.message ?? '不明なエラー'}`)
      })

      const channel = client.channels.get(ablyChannelName(id))
      await channel.subscribe(MESSAGE_NAME.command, (message) => {
        addLog(`受信(command): ${JSON.stringify(message.data)}`)
        // 疎通確認: 受け取った command に対して state を返す
        void channel.publish(MESSAGE_NAME.state, {
          pong: true,
          echo: message.data,
          publishedAt: Date.now(),
        })
        addLog('送信(state): pong を返しました')
      })
      addLog('command の購読を開始しました')
    } catch (error) {
      addLog(`エラー: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '48rem' }}>
      <h1>サイネージ(接続テスト)</h1>
      <p>タイマー表示は未実装です。ここではリモコンとのリアルタイム接続の疎通のみ確認できます。</p>
      {!isPairingConfigured() ? (
        <p>
          VITE_PAIRING_API_URL が設定されていないため、接続テストは実行できません(.env.local
          を確認)。
        </p>
      ) : channelId === null ? (
        <p>
          <button type="button" onClick={() => void startTest()}>
            接続テストを開始(チャンネル発行)
          </button>
        </p>
      ) : (
        <>
          <p style={{ wordBreak: 'break-all' }}>
            リモコン URL(別タブ・スマホで開く):
            <br />
            <a href={remoteUrl ?? '#'} target="_blank" rel="noreferrer">
              {remoteUrl}
            </a>
          </p>
        </>
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
