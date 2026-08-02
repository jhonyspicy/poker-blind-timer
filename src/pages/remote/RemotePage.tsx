import * as Ably from 'ably'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatChips, formatClock } from '../../domain/format'
import {
  ablyChannelName,
  createRealtimeClient,
  isPairingConfigured,
} from '../../realtime/connection'
import { MESSAGE_NAME, type RemoteCommandInput, type StateSnapshot } from '../../realtime/messages'
import styles from './RemotePage.module.css'

type ConnState = 'connecting' | 'connected' | 'disconnected'

const HISTORY_LABEL = { entry: 'エントリー', addon: 'アドオン', bust: 'バスト' } as const

/** チップ量入力の保存キー(次回のリモコン起動時に前回値を引き継ぐ) */
const ENTRY_CHIP_KEY = 'remote.entryChip'
const ADDON_CHIP_KEY = 'remote.addonChip'

/**
 * リモコン画面。`?ch=` のチャンネルでサイネージと接続し、
 * トーナメント開始・履歴の記録/修正/削除・一時停止/再開・レベル移動を操作する。
 * 現在状態は state スナップショットから表示する(スマホ縦持ち・片手操作前提)
 */
export default function RemotePage() {
  const [searchParams] = useSearchParams()
  const channelId = searchParams.get('ch')
  const [connState, setConnState] = useState<ConnState>('connecting')
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [entryChip, setEntryChip] = useState(() => localStorage.getItem(ENTRY_CHIP_KEY) ?? '25000')
  const [addonChip, setAddonChip] = useState(() => localStorage.getItem(ADDON_CHIP_KEY) ?? '10000')
  /** 履歴のチップ量を修正中の行 */
  const [editing, setEditing] = useState<{ id: number; chip: string } | null>(null)
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  const sendCommand = (input: RemoteCommandInput) => {
    const requestId = crypto.randomUUID()
    void channelRef.current?.publish(MESSAGE_NAME.command, { ...input, requestId })
  }

  useEffect(() => {
    if (!channelId || !isPairingConfigured()) return
    // presence 入室には clientId が必要(トークンはワイルドカード許可)
    const client = createRealtimeClient(channelId, `remote-${crypto.randomUUID().slice(0, 8)}`)
    const channel = client.channels.get(ablyChannelName(channelId))
    channelRef.current = channel
    const requestState = () => {
      void channel.publish(MESSAGE_NAME.command, {
        type: 'REQUEST_STATE',
        requestId: crypto.randomUUID(),
      })
    }
    client.connection.on('connected', () => {
      setConnState('connected')
      // 接続・再接続のたびに最新状態へ同期する(サイネージ側が正)
      requestState()
    })
    client.connection.on('disconnected', () => setConnState('disconnected'))
    client.connection.on('suspended', () => setConnState('disconnected'))
    void channel.subscribe(MESSAGE_NAME.state, (message) => {
      setSnapshot(message.data as StateSnapshot)
    })
    // サイネージ側の接続検知(presence)のため入室を宣言する
    void channel.presence.enter({ role: 'remote' }).catch(() => {
      /* presence 権限が無い場合も操作自体は可能なので継続する */
    })
    return () => {
      channelRef.current = null
      client.close()
    }
  }, [channelId])

  // 残り時間の表示をローカルで進める(スナップショット受信間の補間)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(id)
  }, [])

  if (!isPairingConfigured()) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p className={styles.notice}>リモコン連携が設定されていません(VITE_PAIRING_API_URL)。</p>
        </div>
      </main>
    )
  }
  if (!channelId) {
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <p className={styles.notice}>
            チャンネル識別子がありません。
            <br />
            トップページの「開始」で表示される QR コードから開いてください。
          </p>
          <div className={styles.backLink}>
            <Link to="/">トップへ戻る</Link>
          </div>
        </div>
      </main>
    )
  }

  // ---- スナップショットからの表示値 ----
  const running = snapshot?.status === 'running'
  const paused = snapshot?.status === 'paused'
  const waiting = snapshot?.status === 'waiting'
  const remaining = snapshot
    ? running
      ? Math.max(0, snapshot.remainingMs - (now - snapshot.publishedAt))
      : snapshot.remainingMs
    : null
  const levelLine = !snapshot
    ? '接続中…'
    : waiting
      ? '開始前'
      : snapshot.status === 'finished'
        ? '終了'
        : snapshot.isBreak
          ? 'ブレイク'
          : `LEVEL ${snapshot.levelNumber ?? '-'}`
  const entryChipValue = Number(entryChip)
  const addonChipValue = Number(addonChip)

  const updateEntryChip = (value: string) => {
    setEntryChip(value)
    localStorage.setItem(ENTRY_CHIP_KEY, value)
  }
  const updateAddonChip = (value: string) => {
    setAddonChip(value)
    localStorage.setItem(ADDON_CHIP_KEY, value)
  }

  const connDot =
    connState === 'connected'
      ? styles.dotConnected
      : connState === 'disconnected'
        ? styles.dotDisconnected
        : styles.dotConnecting

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={connDot}></span>
          <span className={styles.headerTitle}>{snapshot?.title || 'リモコン'}</span>
          <span className={styles.headerStatus}>
            {connState === 'connected'
              ? '接続中'
              : connState === 'disconnected'
                ? '再接続中…'
                : '接続しています…'}
          </span>
        </div>

        {/* 現在状態 */}
        <div className={styles.stateCard}>
          <div className={styles.stateLevel}>{levelLine}</div>
          <div className={`${styles.stateTime} ${paused ? styles.statePaused : ''}`}>
            {remaining === null ? '--:--' : formatClock(remaining)}
          </div>
          {snapshot?.blind && (
            <div className={styles.stateBlinds}>
              {formatChips(snapshot.blind.sb)} / {formatChips(snapshot.blind.bb)}
              {snapshot.blind.ante > 0 && ` (${formatChips(snapshot.blind.ante)})`}
            </div>
          )}
          {snapshot && (
            <div className={styles.stateStats}>
              <span>{snapshot.stats.currentPlayers} 人</span>
              <span>エントリー {snapshot.stats.totalEntries}</span>
              <span>アドオン {snapshot.stats.addons}</span>
            </div>
          )}
          {paused && <div className={styles.pausedBadge}>一時停止中</div>}
        </div>

        {/* 開始前はトーナメント開始のみ */}
        {waiting && (
          <button
            type="button"
            className={styles.btnStart}
            onClick={() => sendCommand({ type: 'START' })}
          >
            トーナメント開始
          </button>
        )}

        {/* 履歴の記録 */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>記録(チップ量を入力して記録)</div>
          <div className={styles.chipRow}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className={styles.chipInput}
              value={entryChip}
              onChange={(e) => updateEntryChip(e.target.value)}
              aria-label="エントリーのチップ量"
            />
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!Number.isFinite(entryChipValue) || entryChipValue <= 0}
              onClick={() =>
                sendCommand({ type: 'HISTORY_ADD', command: 'entry', chip: entryChipValue })
              }
            >
              エントリー
            </button>
          </div>
          <div className={styles.chipRow}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              className={styles.chipInput}
              value={addonChip}
              onChange={(e) => updateAddonChip(e.target.value)}
              aria-label="アドオンのチップ量"
            />
            <button
              type="button"
              className={styles.btn}
              disabled={!Number.isFinite(addonChipValue) || addonChipValue <= 0}
              onClick={() =>
                sendCommand({ type: 'HISTORY_ADD', command: 'addon', chip: addonChipValue })
              }
            >
              アドオン
            </button>
          </div>
          <button
            type="button"
            className={styles.btn}
            onClick={() => sendCommand({ type: 'HISTORY_ADD', command: 'bust' })}
          >
            バスト
          </button>
        </div>

        {/* タイマー操作 */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>タイマー</div>
          {paused ? (
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={() => sendCommand({ type: 'RESUME' })}
            >
              再開
            </button>
          ) : (
            <button
              type="button"
              className={styles.btn}
              disabled={!running}
              onClick={() => sendCommand({ type: 'PAUSE' })}
            >
              一時停止
            </button>
          )}
        </div>

        {/* レベル移動(影響が大きいので分離配置) */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>レベル移動</div>
          <div className={styles.pairGrid}>
            <button
              type="button"
              className={styles.btn}
              onClick={() => sendCommand({ type: 'PREV_LEVEL' })}
            >
              ← 前のレベル
            </button>
            <button
              type="button"
              className={styles.btn}
              onClick={() => sendCommand({ type: 'NEXT_LEVEL' })}
            >
              次のレベル →
            </button>
          </div>
        </div>

        {/* 履歴一覧(新しい順) */}
        <div className={styles.section}>
          <div className={styles.sectionLabel}>履歴</div>
          <div className={styles.historyList}>
            {!snapshot || snapshot.histories.length === 0 ? (
              <div className={styles.historyEmpty}>まだ記録がありません</div>
            ) : (
              snapshot.histories
                .slice()
                .reverse()
                .map((entry) => (
                  <div key={entry.id}>
                    <div className={styles.historyRow}>
                      <span className={styles.historyId}>#{entry.id}</span>
                      <span
                        className={
                          entry.command === 'bust' ? styles.historyKindBust : styles.historyKind
                        }
                      >
                        {HISTORY_LABEL[entry.command]}
                      </span>
                      <span className={styles.historyChip}>
                        {entry.chip !== undefined ? formatChips(entry.chip) : ''}
                      </span>
                      {entry.command !== 'bust' && (
                        <button
                          type="button"
                          className={styles.historySmallBtn}
                          onClick={() =>
                            setEditing({ id: entry.id, chip: String(entry.chip ?? '') })
                          }
                        >
                          修正
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.historyDeleteBtn}
                        onClick={() => {
                          if (
                            window.confirm(
                              `#${entry.id} ${HISTORY_LABEL[entry.command]} を削除しますか?`,
                            )
                          ) {
                            sendCommand({ type: 'HISTORY_DELETE', id: entry.id })
                          }
                        }}
                      >
                        削除
                      </button>
                    </div>
                    {editing?.id === entry.id && (
                      <div className={styles.historyEditRow}>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          className={styles.historyEditInput}
                          value={editing.chip}
                          onChange={(e) => setEditing({ id: entry.id, chip: e.target.value })}
                          aria-label="修正後のチップ量"
                        />
                        <button
                          type="button"
                          className={styles.historySmallBtn}
                          disabled={
                            !Number.isFinite(Number(editing.chip)) || Number(editing.chip) <= 0
                          }
                          onClick={() => {
                            sendCommand({
                              type: 'HISTORY_UPDATE',
                              id: entry.id,
                              chip: Number(editing.chip),
                            })
                            setEditing(null)
                          }}
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          className={styles.historySmallBtn}
                          onClick={() => setEditing(null)}
                        >
                          取消
                        </button>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
