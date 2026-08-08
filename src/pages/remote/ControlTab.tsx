import { useEffect, useRef, useState } from 'react'
import { formatBlind, formatChips, formatClock } from '../../domain/format'
import type { HistoryCommand } from '../../domain/types'
import type { RemoteCommandInput, StateSnapshot } from '../../realtime/messages'
import styles from './ControlTab.module.css'
import {
  IconCaretDoubleRight,
  IconFastForward,
  IconPause,
  IconPlay,
  IconPlus,
  IconRewind,
  IconUserMinus,
} from './icons'

/** START 送信後にサイネージから応答が無い場合、開始スライダーを元に戻すまでの時間 */
const START_TIMEOUT_MS = 15_000
/** 履歴から拾うクイックチップの最大数 */
const QUICK_CHIP_MAX = 5
/** 開始スライダーのノブ幅+左右余白(px)。ドラッグ可動域の計算に使う */
const SLIDE_KNOB_SPAN = 76

interface ControlTabProps {
  snapshot: StateSnapshot
  sendCommand: (input: RemoteCommandInput) => void
  /** 現在状態カードの参照。親がスクロールで隠れたか監視し、コンパクトバーの表示を切り替える */
  stateCardRef: (node: HTMLDivElement | null) => void
  /** レベル表示ラベル(親のコンパクトバーと共通) */
  levelLabel: string
  /** 表示上の残り時間(ms)。スライダードラッグ中は手元の値が入る */
  remaining: number
  /** 残り時間スライダーの操作。値は親が保持する(コンパクトバーの表示にも使うため) */
  onSliderDragStart: () => void
  onSliderChange: (valueSec: number) => void
  onSliderCommit: () => void
}

/**
 * リモコンのコントロールタブ。現在状態の表示、エントリー / アドオンの記録、
 * トーナメント開始(スライド)、バスト、一時停止 / 再開・レベル移動・
 * 残り時間の変更を行う
 */
export default function ControlTab({
  snapshot,
  sendCommand,
  stateCardRef,
  levelLabel,
  remaining,
  onSliderDragStart,
  onSliderChange,
  onSliderCommit,
}: ControlTabProps) {
  // チップ量入力。記録したら次の入力に備えて空に戻す(繰り返しはクイックチップで行う)
  const [entryChip, setEntryChip] = useState('')
  const [addonChip, setAddonChip] = useState('')

  // 開始スライダー(スライドして開始)
  const [slide, setSlide] = useState(0)
  const [startPending, setStartPending] = useState(false)
  const slideRef = useRef(0)
  const trackRef = useRef<HTMLDivElement | null>(null)

  const running = snapshot.status === 'running'
  const paused = snapshot.status === 'paused'
  const waiting = snapshot.status === 'waiting'
  const started = running || paused

  // 開始が反映されたら開始スライダーを解放する。
  // props(snapshot)の変化に応じた状態調整なので、effect ではなく render 中に行う
  if (!waiting && (startPending || slide !== 0)) {
    setStartPending(false)
    setSlide(0)
  }

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

  const levelDurationSec = snapshot.levelDurationMs
    ? Math.round(snapshot.levelDurationMs / 1000)
    : 0
  const entryChipValue = Number.parseInt(entryChip.replace(/[^\d]/g, ''), 10)
  const addonChipValue = Number.parseInt(addonChip.replace(/[^\d]/g, ''), 10)

  const addEntry = () => {
    sendCommand({ type: 'HISTORY_ADD', command: 'entry', chip: entryChipValue })
    setEntryChip('')
  }
  const addAddon = () => {
    sendCommand({ type: 'HISTORY_ADD', command: 'addon', chip: addonChipValue })
    setAddonChip('')
  }
  const addBust = () => {
    // 残り 2 人でのバストは優勝を確定させ、以降の操作は取り消せないため確認を挟む
    if (
      snapshot.stats.currentPlayers === 2 &&
      !window.confirm('優勝を決定します。この操作は取り消せません。本当によろしいですか?')
    ) {
      return
    }
    sendCommand({ type: 'HISTORY_ADD', command: 'bust' })
  }

  /** 履歴に出てくるチップ量(重複なし・降順)をクイック入力候補にする */
  const quickChips = (command: HistoryCommand): number[] =>
    [
      ...new Set(
        snapshot.histories
          .filter((h) => h.command === command && h.chip !== undefined)
          .map((h) => h.chip as number),
      ),
    ]
      .sort((a, b) => b - a)
      .slice(0, QUICK_CHIP_MAX)

  const addQuick = (command: HistoryCommand, chip: number) => {
    sendCommand({ type: 'HISTORY_ADD', command, chip })
  }

  // ---- 開始スライダーのドラッグ ----
  const onSlideDown = (e: React.PointerEvent) => {
    if (startPending) return
    const track = trackRef.current
    if (!track) return
    e.preventDefault()
    // render 中に ref を書けないため、ドラッグ開始時に表示中の位置と同期する
    slideRef.current = slide
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

  const knobLeft = `calc(7px + ${(slide * 100).toFixed(2)}% - ${(slide * SLIDE_KNOB_SPAN).toFixed(1)}px)`
  const fillWidth = `${(slide * 100).toFixed(2)}%`
  const sliderPct =
    levelDurationSec > 0 ? Math.round((remaining / 1000 / levelDurationSec) * 100) : 0
  const sliderTrack = `linear-gradient(90deg, #9184d9 0%, #9184d9 ${sliderPct}%, #242b3b ${sliderPct}%, #242b3b 100%)`

  return (
    <>
      {/* 現在状態 */}
      <div ref={stateCardRef} className={styles.stateCard}>
        <div className={styles.stateLevel}>{levelLabel}</div>
        {/* 開始前は最初のレベルの持ち時間が入っている(静的表示) */}
        <div className={waiting ? styles.stateClockWaiting : styles.stateClock}>
          {formatClock(remaining)}
        </div>
        {snapshot.blind && (
          <div className={styles.stateBlinds}>
            {formatBlind(snapshot.blind.sb)} / {formatBlind(snapshot.blind.bb)}
            {snapshot.blind.ante > 0 && ` (${formatBlind(snapshot.blind.ante)})`}
          </div>
        )}
        <div className={styles.stateStats}>
          <span>{snapshot.stats.currentPlayers}人</span>
          <span>エントリー {snapshot.stats.totalEntries}</span>
          <span>アドオン {snapshot.stats.addons}</span>
        </div>
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
            onChange={(e) => setEntryChip(e.target.value)}
            aria-label="エントリーのチップ量"
          />
          <button
            type="button"
            className={styles.btnEntry}
            disabled={!Number.isFinite(entryChipValue) || entryChipValue <= 0}
            onClick={addEntry}
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
            onChange={(e) => setAddonChip(e.target.value)}
            aria-label="アドオンのチップ量"
          />
          <button
            type="button"
            className={styles.btnAddon}
            disabled={!Number.isFinite(addonChipValue) || addonChipValue <= 0}
            onClick={addAddon}
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
            <button type="button" className={styles.bustBtn} onClick={addBust}>
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
                onPointerDown={onSliderDragStart}
                onChange={(e) => onSliderChange(Number(e.target.value))}
                onPointerUp={onSliderCommit}
                onTouchEnd={onSliderCommit}
                onKeyDown={onSliderDragStart}
                onKeyUp={onSliderCommit}
                aria-label="残り時間"
              />
              <div className={styles.sliderMeta}>
                <span>残り {formatClock(remaining)}</span>
                <span>
                  {snapshot.levelDurationMs
                    ? `${Math.round(snapshot.levelDurationMs / 60_000)}分レベル`
                    : ''}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
