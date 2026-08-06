import * as Ably from 'ably'
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { formatChips, formatClock } from '../../domain/format'
import type { HistoryCommand } from '../../domain/types'
import {
  ablyChannelName,
  createRealtimeClient,
  isPairingConfigured,
} from '../../realtime/connection'
import { MESSAGE_NAME, type RemoteCommandInput, type StateSnapshot } from '../../realtime/messages'
import styles from './RemotePage.module.css'

type ConnState = 'connecting' | 'connected' | 'disconnected' | 'failed'
type Tab = 'control' | 'history'

const HISTORY_LABEL = { entry: 'エントリー', addon: 'アドオン', bust: 'バスト' } as const

/** チップ量入力の保存キー(次回のリモコン起動時に前回値を引き継ぐ) */
const ENTRY_CHIP_KEY = 'remote.entryChip'
const ADDON_CHIP_KEY = 'remote.addonChip'
/** START 送信後にサイネージから応答が無い場合、開始スライダーを元に戻すまでの時間 */
const START_TIMEOUT_MS = 15_000
/** 履歴から拾うクイックチップの最大数 */
const QUICK_CHIP_MAX = 5
/** 開始スライダーのノブ幅+左右余白(px)。ドラッグ可動域の計算に使う */
const SLIDE_KNOB_SPAN = 76

// ---- アイコン(Phosphor 相当を最小限のインライン SVG で再現) ----
type IconProps = { className?: string }
const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const IconPlus = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps} strokeWidth={2.4}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const IconCaretDoubleRight = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps} strokeWidth={2.4}>
    <path d="M5 5l7 7-7 7M13 5l7 7-7 7" />
  </svg>
)
const IconUserMinus = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <circle cx="10" cy="8" r="4" />
    <path d="M2.5 20c1.4-3.3 4.2-5 7.5-5s6.1 1.7 7.5 5" />
    <path d="M17 11h6" />
  </svg>
)
const IconRewind = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M11 5v14l-9-7zM22 5v14l-9-7z" />
  </svg>
)
const IconFastForward = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M13 5v14l9-7zM2 5v14l9-7z" />
  </svg>
)
const IconPlay = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M7 4v16l13-8z" />
  </svg>
)
const IconPause = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
)
const IconSliders = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <path d="M3 7h10M17.5 7H21M3 17h4M11.5 17H21" />
    <circle cx="15" cy="7" r="2.5" />
    <circle cx="9" cy="17" r="2.5" />
  </svg>
)
const IconHistory = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5" />
    <path d="M3.5 3.5v5h5" />
    <path d="M12 7.5V12l3.5 2" />
  </svg>
)
const IconCheckSquare = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <path d="M8 12.5l3 3 5.5-6.5" />
  </svg>
)
const IconFlag = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" className={className} {...strokeProps}>
    <path d="M5 21V4" />
    <path d="M5 4c4.5-2.2 9 2.2 14 0v10c-5 2.2-9.5-2.2-14 0" />
  </svg>
)

/**
 * リモコン画面。`?ch=` のチャンネルでサイネージと接続し、
 * トーナメント開始(スライド)・履歴の記録/修正/削除・一時停止/再開・
 * レベル移動・残り時間の変更を操作する。現在状態は state スナップショットから
 * 表示する(スマホ縦持ち・片手操作前提)
 */
export default function RemotePage() {
  const [searchParams] = useSearchParams()
  const channelId = searchParams.get('ch')
  const [connState, setConnState] = useState<ConnState>('connecting')
  const [snapshot, setSnapshot] = useState<StateSnapshot | null>(null)
  const hasSnapshotRef = useRef(false)
  const [tab, setTab] = useState<Tab>('control')
  const [now, setNow] = useState(() => Date.now())
  const [entryChip, setEntryChip] = useState(() => localStorage.getItem(ENTRY_CHIP_KEY) ?? '')
  const [addonChip, setAddonChip] = useState(() => localStorage.getItem(ADDON_CHIP_KEY) ?? '')
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)

  // 開始スライダー(スライドして開始)
  const [slide, setSlide] = useState(0)
  const [startPending, setStartPending] = useState(false)
  const slideRef = useRef(0)
  const trackRef = useRef<HTMLDivElement | null>(null)

  // 残り時間スライダー。ドラッグ中はスナップショットより手元の値を優先する
  const [sliderSec, setSliderSec] = useState<number | null>(null)
  const sliderSecRef = useRef<number | null>(null)
  const sliderDraggingRef = useRef(false)

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
      // 開始が反映されたら開始スライダーを解放する
      if (data.status !== 'waiting') {
        setStartPending(false)
        slideRef.current = 0
        setSlide(0)
      }
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

  // START 送信後に応答が無ければ開始スライダーを元に戻す
  useEffect(() => {
    if (!startPending) return
    const id = window.setTimeout(() => {
      setStartPending(false)
      slideRef.current = 0
      setSlide(0)
    }, START_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [startPending])

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
  const finished = snapshot?.status === 'finished'
  const started = running || paused
  const remainingFromSnapshot = snapshot
    ? running
      ? Math.max(0, snapshot.remainingMs - (now - snapshot.publishedAt))
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
  const levelDurationSec = snapshot?.levelDurationMs
    ? Math.round(snapshot.levelDurationMs / 1000)
    : 0
  const entryChipValue = Number.parseInt(entryChip.replace(/[^\d]/g, ''), 10)
  const addonChipValue = Number.parseInt(addonChip.replace(/[^\d]/g, ''), 10)

  const updateEntryChip = (value: string) => {
    setEntryChip(value)
    localStorage.setItem(ENTRY_CHIP_KEY, value)
  }
  const updateAddonChip = (value: string) => {
    setAddonChip(value)
    localStorage.setItem(ADDON_CHIP_KEY, value)
  }

  /** 履歴に出てくるチップ量(重複なし・降順)をクイック入力候補にする */
  const quickChips = (command: HistoryCommand): number[] =>
    [
      ...new Set(
        (snapshot?.histories ?? [])
          .filter((h) => h.command === command && h.chip !== undefined)
          .map((h) => h.chip as number),
      ),
    ]
      .sort((a, b) => b - a)
      .slice(0, QUICK_CHIP_MAX)

  const addQuick = (command: HistoryCommand, chip: number) => {
    if (command === 'entry') updateEntryChip(String(chip))
    else updateAddonChip(String(chip))
    sendCommand({ type: 'HISTORY_ADD', command, chip })
  }

  const editHistoryChip = (id: number, chip: number | undefined) => {
    const value = window.prompt('チップ量', chip !== undefined ? String(chip) : '')
    if (value == null) return
    const parsed = Number.parseInt(value.replace(/[^\d]/g, ''), 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      sendCommand({ type: 'HISTORY_UPDATE', id, chip: parsed })
    }
  }

  // ---- 開始スライダーのドラッグ ----
  const onSlideDown = (e: React.PointerEvent) => {
    if (startPending) return
    const track = trackRef.current
    if (!track) return
    e.preventDefault()
    const rect = track.getBoundingClientRect()
    const span = rect.width - SLIDE_KNOB_SPAN
    const grab = e.clientX - (rect.left + 7 + slideRef.current * span)
    const move = (ev: PointerEvent) => {
      const v = Math.min(1, Math.max(0, (ev.clientX - grab - rect.left - 7) / span))
      slideRef.current = v
      setSlide(v)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (slideRef.current > 0.92) {
        slideRef.current = 1
        setSlide(1)
        setStartPending(true)
        sendCommand({ type: 'START' })
      } else {
        slideRef.current = 0
        setSlide(0)
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // ---- 残り時間スライダー ----
  const onSliderChange = (value: number) => {
    sliderSecRef.current = value
    setSliderSec(value)
  }
  const commitSlider = () => {
    if (!sliderDraggingRef.current) return
    sliderDraggingRef.current = false
    if (sliderSecRef.current !== null) {
      sendCommand({ type: 'SET_REMAINING', remainingMs: sliderSecRef.current * 1000 })
    }
  }

  const knobLeft = `calc(7px + ${(slide * 100).toFixed(2)}% - ${(slide * SLIDE_KNOB_SPAN).toFixed(1)}px)`
  const fillWidth = `${(slide * 100).toFixed(2)}%`
  const sliderPct =
    levelDurationSec > 0 ? Math.round((remaining / 1000 / levelDurationSec) * 100) : 0
  const sliderTrack = `linear-gradient(90deg, #9184d9 0%, #9184d9 ${sliderPct}%, #242b3b ${sliderPct}%, #242b3b 100%)`

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

            {tab === 'control' && (
              <>
                {/* 現在状態 */}
                <div className={styles.stateCard}>
                  <div className={styles.stateLevel}>{levelLabel}</div>
                  {/* 開始前は最初のレベルの持ち時間が入っている(静的表示) */}
                  <div className={waiting ? styles.stateClockWaiting : styles.stateClock}>
                    {formatClock(remaining)}
                  </div>
                  {snapshot?.blind && (
                    <div className={styles.stateBlinds}>
                      {formatChips(snapshot.blind.sb)} / {formatChips(snapshot.blind.bb)}
                      {snapshot.blind.ante > 0 && ` (${formatChips(snapshot.blind.ante)})`}
                    </div>
                  )}
                  {snapshot && (
                    <div className={styles.stateStats}>
                      <span>{snapshot.stats.currentPlayers}人</span>
                      <span>エントリー {snapshot.stats.totalEntries}</span>
                      <span>アドオン {snapshot.stats.addons}</span>
                    </div>
                  )}
                </div>

                {/* エントリー追加 */}
                <div className={styles.card}>
                  <div className={styles.cardLabel}>
                    エントリー追加
                    <span className={styles.cardLabelNote}> — チップ量を入力して記録</span>
                  </div>
                  <div className={styles.inputRow}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="チップ量"
                      className={styles.field}
                      value={entryChip}
                      onChange={(e) => updateEntryChip(e.target.value)}
                      aria-label="エントリーのチップ量"
                    />
                    <button
                      type="button"
                      className={styles.btnEntry}
                      disabled={!Number.isFinite(entryChipValue) || entryChipValue <= 0}
                      onClick={() =>
                        sendCommand({ type: 'HISTORY_ADD', command: 'entry', chip: entryChipValue })
                      }
                    >
                      エントリー
                    </button>
                  </div>
                  {quickChips('entry').length > 0 && (
                    <div className={styles.quickRow}>
                      {quickChips('entry').map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className={styles.quickChip}
                          onClick={() => addQuick('entry', chip)}
                        >
                          <IconPlus className={styles.quickIconEntry} />
                          {formatChips(chip)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* アドオン追加 */}
                <div className={styles.card}>
                  <div className={styles.cardLabel}>
                    アドオン追加
                    <span className={styles.cardLabelNote}> — チップ量を入力して記録</span>
                  </div>
                  <div className={styles.inputRow}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="チップ量"
                      className={styles.field}
                      value={addonChip}
                      onChange={(e) => updateAddonChip(e.target.value)}
                      aria-label="アドオンのチップ量"
                    />
                    <button
                      type="button"
                      className={styles.btnAddon}
                      disabled={!Number.isFinite(addonChipValue) || addonChipValue <= 0}
                      onClick={() =>
                        sendCommand({ type: 'HISTORY_ADD', command: 'addon', chip: addonChipValue })
                      }
                    >
                      アドオン
                    </button>
                  </div>
                  {quickChips('addon').length > 0 && (
                    <div className={styles.quickRow}>
                      {quickChips('addon').map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          className={styles.quickChip}
                          onClick={() => addQuick('addon', chip)}
                        >
                          <IconPlus className={styles.quickIconAddon} />
                          {formatChips(chip)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 開始前: スライドして開始 */}
                {waiting && (
                  <div className={styles.slideWrap}>
                    <div ref={trackRef} className={styles.slideTrack}>
                      <div className={styles.slideFill} style={{ width: fillWidth }}></div>
                      <div className={slide > 0.15 ? styles.slideHintActive : styles.slideHint}>
                        {startPending ? '開始しています…' : 'スライドして開始 →'}
                      </div>
                      <div
                        className={styles.slideKnob}
                        style={{ left: knobLeft }}
                        onPointerDown={onSlideDown}
                      >
                        <IconCaretDoubleRight className={styles.slideKnobIcon} />
                      </div>
                    </div>
                    <div className={styles.slideCaption}>
                      エントリー受付中 — 開始するとタイマーとバストが有効になります
                    </div>
                  </div>
                )}

                {/* 進行中: バスト+タイマー操作 */}
                {started && (
                  <>
                    <div className={styles.bustWrap}>
                      <button
                        type="button"
                        className={styles.bustBtn}
                        onClick={() => sendCommand({ type: 'HISTORY_ADD', command: 'bust' })}
                      >
                        <IconUserMinus className={styles.bustIcon} />
                        バスト
                      </button>
                    </div>

                    <div className={styles.card}>
                      <div className={styles.cardLabel}>
                        タイマー
                        <span className={styles.cardLabelNote}> — 再生・レベル移動・残り時間</span>
                      </div>
                      <div className={styles.timerRow}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="前のレベル"
                          onClick={() => sendCommand({ type: 'PREV_LEVEL' })}
                        >
                          <IconRewind className={styles.timerIcon} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtnAccent}
                          title={paused ? '再開' : '一時停止'}
                          onClick={() => sendCommand({ type: paused ? 'RESUME' : 'PAUSE' })}
                        >
                          {paused ? (
                            <IconPlay className={styles.timerIcon} />
                          ) : (
                            <IconPause className={styles.timerIcon} />
                          )}
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="次のレベル"
                          onClick={() => sendCommand({ type: 'NEXT_LEVEL' })}
                        >
                          <IconFastForward className={styles.timerIcon} />
                        </button>
                      </div>
                      <div className={styles.sliderCard}>
                        <input
                          type="range"
                          className={styles.range}
                          min={0}
                          max={levelDurationSec}
                          step={10}
                          value={Math.min(Math.round(remaining / 1000), levelDurationSec)}
                          style={{ background: sliderTrack }}
                          onPointerDown={() => {
                            sliderDraggingRef.current = true
                          }}
                          onChange={(e) => onSliderChange(Number(e.target.value))}
                          onPointerUp={commitSlider}
                          onTouchEnd={commitSlider}
                          onKeyDown={() => {
                            sliderDraggingRef.current = true
                          }}
                          onKeyUp={commitSlider}
                          aria-label="残り時間"
                        />
                        <div className={styles.sliderMeta}>
                          <span>残り {formatClock(remaining)}</span>
                          <span>
                            {snapshot?.levelDurationMs
                              ? `${Math.round(snapshot.levelDurationMs / 60_000)}分レベル`
                              : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* 履歴一覧(新しい順) */}
            {tab === 'history' && (
              <div className={styles.historyList}>
                {!snapshot || snapshot.histories.length === 0 ? (
                  <div className={styles.historyEmpty}>まだ記録がありません</div>
                ) : (
                  snapshot.histories
                    .slice()
                    .reverse()
                    .map((entry) => (
                      <div key={entry.id} className={styles.historyRow}>
                        <span className={styles.historyTag}>#{entry.id}</span>
                        <span
                          className={
                            entry.command === 'bust' ? styles.historyKindBust : styles.historyKind
                          }
                        >
                          {HISTORY_LABEL[entry.command]}
                        </span>
                        <span className={styles.historyAmount}>
                          {entry.chip !== undefined ? formatChips(entry.chip) : ''}
                        </span>
                        {entry.command !== 'bust' && (
                          <button
                            type="button"
                            className={styles.smallBtn}
                            onClick={() => editHistoryChip(entry.id, entry.chip)}
                          >
                            修正
                          </button>
                        )}
                        <button
                          type="button"
                          className={styles.smallBtn}
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
                    ))
                )}
              </div>
            )}
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
