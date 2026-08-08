import * as Ably from 'ably'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatBlind, formatClock } from '../../domain/format'
import {
  ablyChannelName,
  createRealtimeClient,
  isPairingConfigured,
} from '../../realtime/connection'
import { MESSAGE_NAME, type RemoteCommandInput, type StateSnapshot } from '../../realtime/messages'
import ControlTab from './ControlTab'
import HistoryTab from './HistoryTab'
import { IconCheckSquare, IconFlag, IconHistory, IconRows, IconSliders } from './icons'
import styles from './RemotePage.module.css'
import StructureTab from './StructureTab'

type ConnState = 'connecting' | 'connected' | 'disconnected' | 'failed'
type Tab = 'control' | 'structure' | 'history'

/**
 * 切断からモーダル表示までの猶予。Wi-Fi の瞬断のたびにモーダルが
 * 点滅するのを防ぎ、すぐ復帰した場合は何も表示しない
 */
const DISCONNECT_MODAL_DELAY_MS = 1_500
/**
 * 状態カードの可視割合がこれを下回ったら上部のコンパクトバーを表示する。
 * 完全に隠れるのを待つと、スクロールが下端に達してもカードの端が数 px 残る
 * 画面サイズでバーが出ないため、残り時間が見えなくなる程度で切り替える
 */
const STATE_CARD_VISIBLE_RATIO = 0.35

/**
 * リモコン画面。`?ch=` のチャンネルでサイネージと接続し、接続状態の管理と
 * タブ(コントロール / ストラクチャー / 履歴)の切り替えを行う。
 * 各タブの操作 UI は ControlTab / StructureTab / HistoryTab に分割している
 * (スマホ縦持ち・片手操作前提)
 */
export default function RemotePage() {
  const [searchParams] = useSearchParams()
  const channelId = searchParams.get('ch')
  const [connState, setConnState] = useState<ConnState>('connecting')
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null)
  const hasSnapshotRef = useRef(false)
  const [tab, setTab] = useState<Tab>('control')
  const [now, setNow] = useState(() => Date.now())
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  // 残り時間スライダー。ドラッグ中はスナップショットより手元の値を優先する。
  // コンパクトバーの表示にも使うため、ControlTab ではなくここで保持する
  const [sliderSec, setSliderSec] = useState<number | null>(null)
  const sliderSecRef = useRef<number | null>(null)
  const sliderDraggingRef = useRef(false)

  // 状態カードがスクロールで画面外に出たら、上部にコンパクトバーを固定表示する
  // (小さい画面でもタイマー・ブラインドを常に確認できるようにするため)
  const [stateCardHidden, setStateCardHidden] = useState(false)
  const stateCardObserverRef = useRef<IntersectionObserver | null>(null)
  const stateCardRef = useCallback((node: HTMLDivElement | null) => {
    stateCardObserverRef.current?.disconnect()
    stateCardObserverRef.current = null
    if (!node) {
      setStateCardHidden(false)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setStateCardHidden(entry.intersectionRatio < STATE_CARD_VISIBLE_RATIO)
      },
      { threshold: STATE_CARD_VISIBLE_RATIO },
    )
    observer.observe(node)
    stateCardObserverRef.current = observer
  }, [])
  useEffect(() => () => stateCardObserverRef.current?.disconnect(), [])

  // 切断中は操作をブロックするモーダルを表示する(知らずに操作して
  // コマンドが届かないのを防ぐ)。切断時刻を記録し、猶予を超えても
  // 復帰していなければ表示する。再接続が完了すると自動的に閉じる
  const [disconnectedAt, setDisconnectedAt] = useState<number | null>(null)

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
      setDisconnectedAt(null)
      // 接続・再接続のたびに最新状態へ同期する(サイネージ側が正)
      requestState()
    })
    const onDisconnected = () => {
      setConnState('disconnected')
      // 再通知されても最初の切断時刻を保持する(モーダル表示の起点)
      setDisconnectedAt((prev) => prev ?? Date.now())
    }
    client.connection.on('disconnected', onDisconnected)
    client.connection.on('suspended', onDisconnected)
    // トークン取得不能など回復見込みの無い失敗。再読み込みを案内する
    client.connection.on('failed', () => setConnState('failed'))
    void channel.subscribe(MESSAGE_NAME.state, (message) => {
      const data = message.data as StateSnapshot
      hasSnapshotRef.current = true
      setSnapshot(data)
      if (!sliderDraggingRef.current) {
        sliderSecRef.current = null
        setSliderSec(null)
      }
      // トーナメント終了後は操作できないため、接続を閉じて余計な
      // メッセージのやり取りをしない(終了画面は最後のスナップショットで表示し続ける)
      if (data.status === 'finished') client.close()
    })
    // サイネージ側の接続検知(presence)のため入室を宣言する
    void channel.presence.enter({ role: 'remote' }).catch(() => {
      /* presence 権限が無い場合も操作自体は可能なので継続する */
    })
    // サイネージが後から起動するケースに備え、初回スナップショットを受信する
    // まで定期的に再要求する
    const retryId = window.setInterval(() => {
      if (hasSnapshotRef.current) {
        window.clearInterval(retryId)
        return
      }
      if (client.connection.state === 'connected') requestState()
    }, 3_000)
    return () => {
      window.clearInterval(retryId)
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
  const waiting = snapshot?.status === 'waiting'
  const finished = snapshot?.status === 'finished'
  const remainingFromSnapshot = snapshot
    ? running
      ? // now はスナップショット受信より古いことがある(500ms 間隔の更新)ため、
        // 経過を負にせず残り時間がスナップショットの値を超えないようにする
        Math.max(0, snapshot.remainingMs - Math.max(0, now - snapshot.publishedAt))
      : snapshot.remainingMs
    : 0
  const remaining = sliderSec !== null ? sliderSec * 1000 : remainingFromSnapshot
  const levelLabel = waiting
    ? 'エントリー受付中'
    : snapshot?.isBreak
      ? 'ブレイク'
      : `LEVEL ${snapshot?.levelNumber ?? '-'}`
  const showSpinner = !snapshot && connState !== 'failed'
  const locked = showSpinner || connState === 'failed' || finished
  // now は 500ms ごとに進むため、表示は猶予+最大 500ms 後になる
  const showDisconnectModal =
    connState === 'disconnected' &&
    disconnectedAt !== null &&
    now - disconnectedAt >= DISCONNECT_MODAL_DELAY_MS

  // ---- 残り時間スライダー(値は ControlTab から操作される) ----
  const onSliderDragStart = () => {
    sliderDraggingRef.current = true
  }
  const onSliderChange = (value: number) => {
    sliderSecRef.current = value
    setSliderSec(value)
  }
  const onSliderCommit = () => {
    if (!sliderDraggingRef.current) return
    sliderDraggingRef.current = false
    if (sliderSecRef.current !== null) {
      sendCommand({ type: 'SET_REMAINING', remainingMs: sliderSecRef.current * 1000 })
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {connState === 'failed' ? (
          <div className={styles.center}>
            <div className={styles.failedTitle}>接続に失敗しました</div>
            <p className={styles.failedNote}>
              ページを再読み込みするか、
              <br />
              サイネージの QR コードを読み直してください。
            </p>
          </div>
        ) : showSpinner ? (
          <div className={styles.center}>
            {connState === 'connected' ? (
              <>
                <IconCheckSquare className={styles.connectedIcon} />
                <div className={styles.connectedText}>接続しました</div>
                <p className={styles.connectedNote}>PC でブラインドタイマーを起動してください。</p>
              </>
            ) : (
              <>
                <div className={styles.spinner}></div>
                <div className={styles.connectingText}>接続中</div>
              </>
            )}
          </div>
        ) : finished ? (
          <div className={styles.center}>
            <IconFlag className={styles.finishedIcon} />
            <div className={styles.finishedText}>
              {snapshot?.title}
              <br />
              は終了しました
            </div>
          </div>
        ) : (
          <div className={styles.scroll}>
            {/* 接続状態ヘッダー */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <span
                  className={connState === 'connected' ? styles.dotConnected : styles.dotOff}
                ></span>
                <span className={styles.headerTitle}>{snapshot?.title || 'リモコン'}</span>
              </div>
              <span className={styles.connLabel}>
                {connState === 'connected' ? '接続中' : '再接続中…'}
              </span>
            </div>

            {/* 現在状態の表示と記録・タイマー操作 */}
            {tab === 'control' && snapshot && (
              <ControlTab
                snapshot={snapshot}
                sendCommand={sendCommand}
                stateCardRef={stateCardRef}
                levelLabel={levelLabel}
                remaining={remaining}
                onSliderDragStart={onSliderDragStart}
                onSliderChange={onSliderChange}
                onSliderCommit={onSliderCommit}
              />
            )}

            {/* ストラクチャーの閲覧・編集(未来の項目のみ) */}
            {tab === 'structure' && snapshot && (
              <StructureTab snapshot={snapshot} sendCommand={sendCommand} />
            )}

            {/* 履歴一覧(新しい順) */}
            {tab === 'history' && snapshot && (
              <HistoryTab snapshot={snapshot} sendCommand={sendCommand} />
            )}
          </div>
        )}

        {/* 状態カードが画面外のときだけ出す上部固定のコンパクト表示 */}
        {tab === 'control' && stateCardHidden && snapshot && (
          <div className={styles.miniBar}>
            <span className={styles.miniLevel}>{levelLabel}</span>
            <span className={styles.miniClock}>{formatClock(remaining)}</span>
            {snapshot.blind ? (
              <span className={styles.miniBlinds}>
                {formatBlind(snapshot.blind.sb)} / {formatBlind(snapshot.blind.bb)}
                {snapshot.blind.ante > 0 && ` (${formatBlind(snapshot.blind.ante)})`}
              </span>
            ) : (
              <span className={styles.miniBlinds}></span>
            )}
          </div>
        )}

        {/* 切断中の操作防止モーダル(再接続が完了すると自動的に閉じる) */}
        {showDisconnectModal && snapshot && !finished && (
          <div className={styles.disconnectOverlay} role="alert">
            <div className={styles.disconnectCard}>
              <div className={styles.spinner}></div>
              <div className={styles.disconnectTitle}>接続が切れました</div>
              <p className={styles.disconnectNote}>
                再接続しています…
                <br />
                このまましばらくお待ちください。
              </p>
            </div>
          </div>
        )}

        {/* タブバー */}
        <div className={locked ? styles.tabbarLocked : styles.tabbar}>
          <button
            type="button"
            disabled={locked}
            className={tab === 'control' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setTab('control')}
          >
            <IconSliders className={styles.tabIcon} />
            <span className={styles.tabLabel}>コントロール</span>
          </button>
          <button
            type="button"
            disabled={locked}
            className={tab === 'structure' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setTab('structure')}
          >
            <IconRows className={styles.tabIcon} />
            <span className={styles.tabLabel}>ストラクチャー</span>
          </button>
          <button
            type="button"
            disabled={locked}
            className={tab === 'history' ? styles.tabBtnActive : styles.tabBtn}
            onClick={() => setTab('history')}
          >
            <IconHistory className={styles.tabIcon} />
            <span className={styles.tabLabel}>履歴</span>
          </button>
        </div>
      </div>
    </main>
  )
}
