import { useEffect, useMemo, useRef, useState } from 'react'
import { formatBlind, formatChips, formatClock } from '../../../../domain/format'
import {
  currentBlindLevelNumber,
  lateRegStatus,
  msUntilNextBreak,
  nextBlindLevel,
  remainingMs,
} from '../../../../domain/timer'
import type { TimerState, TournamentConfig, TournamentStats } from '../../../../domain/types'
import styles from './ClockScreen.module.css'
import { formatAnte, rankSuffix, round2AssetUrl, splitAmount } from './format'
import PausedBanner from './PausedBanner'
import StoreBadge from './StoreBadge'
import TabularNumber from './TabularNumber'
import { useFitText } from './useFitText'
import { useStageScale } from './useStageScale'

/**
 * Round2 のタイマー画面(デザインモック Tournament Clock の移植)。
 * ループ動画の背景に、ヘッダー(店名バッジ・タイトル)、左 PRIZE LIST、
 * 中央のレベル + カウントダウン + ブラインド、その下に NEXT BLINDS / NEXT BREAK、
 * 右に PLAYERS / AVERAGE STACK / ADD-ON / LATE REGISTRATION を表示する。
 * ブレイク中は専用の BreakScreen へ切り替える
 */

/** 残り時間がこの値以下になったらカウントダウンを警告色にする(モック準拠) */
const TIME_WARNING_MS = 60_000

/** レベルアップ時に中央パネルを発光させる時間 */
const LEVEL_UP_GLOW_MS = 1_200

/** タイトルの上限幅。超えたら文字サイズを縮める */
const TITLE_MAX_WIDTH = 1800

/** プライズ文(自由テキスト)の長さに応じた段階縮小 */
function prizeAmountClass(text: string): string {
  if (text.length <= 8) return styles.prizeAmount
  if (text.length <= 14) return `${styles.prizeAmount} ${styles.prizeAmountMedium}`
  return `${styles.prizeAmount} ${styles.prizeAmountLong}`
}

/** パネル四隅の角飾り */
function PanelCorners() {
  return (
    <>
      <div className={`${styles.corner} ${styles.tl}`} />
      <div className={`${styles.corner} ${styles.tr}`} />
      <div className={`${styles.corner} ${styles.bl}`} />
      <div className={`${styles.corner} ${styles.br}`} />
    </>
  )
}

export default function ClockScreen({
  storeName,
  config,
  timer,
  stats,
  now,
}: {
  storeName: string
  config: TournamentConfig
  timer: TimerState
  stats: TournamentStats
  now: number
}) {
  const { structure } = config
  const scale = useStageScale()
  const titleRef = useFitText<HTMLDivElement>(config.title, TITLE_MAX_WIDTH, 'shrink')
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  // 表示中に先読みが完了しても src を差し替えない(動画が最初から再生し直しになる)よう一度だけ解決する
  const videoUrl = useMemo(() => round2AssetUrl('videos/timer-background.webm'), [])
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // 背景動画はブラウザの省電力・自動再生制限で止まることがあるため、表示に戻ったときと
  // 画面操作(音声有効化のクリック等)のときに再生し直す(モックと同じ救済)
  useEffect(() => {
    const play = () => {
      const video = videoRef.current
      if (!video || !video.paused || document.visibilityState !== 'visible') return
      video.muted = true
      void video.play().catch(() => {
        /* 自動再生が拒否されたら背景なしのまま表示を続ける */
      })
    }
    play()
    document.addEventListener('visibilitychange', play)
    document.addEventListener('pointerdown', play)
    return () => {
      document.removeEventListener('visibilitychange', play)
      document.removeEventListener('pointerdown', play)
    }
  }, [])

  // ---- 表示値の導出 ----
  const paused = timer.status === 'paused'
  const levelIndex = timer.status === 'running' || timer.status === 'paused' ? timer.levelIndex : 0
  const currentItem = structure[levelIndex]
  const remaining = remainingMs(timer, structure, now)
  const upcoming = nextBlindLevel(timer, structure, now)
  const displayBlind = currentItem?.kind === 'blind' ? currentItem : null
  const followingBlind = upcoming?.kind === 'blind' ? upcoming : null
  const levelNumber = currentBlindLevelNumber(timer, structure, now)
  const breakMs = msUntilNextBreak(timer, structure, now)
  const nextBreakItem = structure.slice(levelIndex + 1).find((item) => item.kind === 'break')
  const lateReg = lateRegStatus(timer, structure, now)
  const timeText = formatClock(remaining)

  // ---- レベルアップの発光 ----
  // レベルが進んだ「そのレンダー中」に発光を開始する(レンダー中の派生 state 更新パターン)
  const [shownLevel, setShownLevel] = useState(levelIndex)
  const [glowKey, setGlowKey] = useState<number | null>(null)
  if (shownLevel !== levelIndex) {
    if (!reducedMotion && levelIndex > shownLevel && structure[levelIndex]?.kind === 'blind') {
      setGlowKey(levelIndex)
    }
    setShownLevel(levelIndex)
  }
  useEffect(() => {
    if (glowKey === null) return
    const timeout = window.setTimeout(() => setGlowKey(null), LEVEL_UP_GLOW_MS)
    return () => clearTimeout(timeout)
  }, [glowKey])

  const lateRegText =
    lateReg.kind === 'open'
      ? formatClock(lateReg.msUntilClose)
      : lateReg.kind === 'closed'
        ? '00:00'
        : '--:--'
  const clockClass = [
    styles.clock,
    timeText.length > 5 ? styles.clockLong : '',
    remaining <= TIME_WARNING_MS ? styles.clockWarning : '',
    paused ? styles.clockPaused : '',
  ].join(' ')

  return (
    <div className={styles.page}>
      <div className={styles.stage} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {videoUrl !== null && (
          <video
            ref={videoRef}
            className={styles.video}
            src={videoUrl}
            autoPlay
            loop
            muted
            playsInline
            aria-hidden
          />
        )}
        <div className={styles.shade} />

        <header className={styles.header}>
          <StoreBadge storeName={storeName} size="compact" />
          <div ref={titleRef} className={styles.title}>
            {config.title}
          </div>
        </header>

        {/* 左: PRIZE LIST */}
        <section className={`${styles.panel} ${styles.prizePanel}`}>
          <PanelCorners />
          <div className={styles.panelTitle}>PRIZE LIST</div>
          <div className={styles.prizeList}>
            {config.prizes.map((prize) => {
              const split = splitAmount(prize.description)
              return (
                <div key={prize.place} className={styles.prizeRow}>
                  <div className={styles.prizeRank}>
                    {prize.place}
                    {rankSuffix(prize.place)}
                  </div>
                  {split ? (
                    <div className={styles.prizeValue}>
                      <span className={styles.prizeNumber}>{split.amount}</span>
                      <span className={styles.prizeUnit}>{split.unit}</span>
                    </div>
                  ) : (
                    <div className={prizeAmountClass(prize.description)}>{prize.description}</div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* 中央: カウントダウンと現在のブラインド */}
        <section
          className={`${styles.panel} ${styles.clockPanel} ${glowKey !== null ? styles.clockPanelGlow : ''}`}
        >
          <PanelCorners />
          <div className={styles.levelLabel}>
            {levelNumber === null ? 'LEVEL —' : `LEVEL ${String(levelNumber).padStart(2, '0')}`}
          </div>
          <div className={clockClass}>
            <TabularNumber text={timeText} />
          </div>
          <div className={styles.blindsHeadingRow}>
            <div className={styles.rule} />
            <div className={styles.blindsHeading}>BLINDS</div>
            <div className={styles.rule} />
          </div>
          <div className={styles.blinds}>
            {displayBlind
              ? `${formatBlind(displayBlind.sb)} / ${formatBlind(displayBlind.bb)}`
              : '-'}
          </div>
          <div className={styles.ante}>
            ANTE&ensp;{displayBlind ? formatAnte(displayBlind.ante) : '-'}
          </div>
        </section>

        {/* 中央下: NEXT BLINDS / NEXT BREAK */}
        <section className={`${styles.panel} ${styles.nextPanel}`}>
          <PanelCorners />
          <div className={styles.nextCell}>
            <div className={styles.nextLabel}>NEXT BLINDS</div>
            <div className={styles.nextValue}>
              {followingBlind
                ? `${formatBlind(followingBlind.sb)} / ${formatBlind(followingBlind.bb)}`
                : '-'}
            </div>
            <div className={styles.nextNote}>
              ANTE&ensp;{followingBlind ? formatAnte(followingBlind.ante) : '-'}
            </div>
          </div>
          <div className={styles.nextDivider} />
          <div className={styles.nextCell}>
            <div className={styles.nextLabel}>NEXT BREAK</div>
            <div className={styles.nextValue}>
              <TabularNumber text={breakMs === null ? '--:--' : formatClock(breakMs)} />
            </div>
            <div className={styles.nextNote}>
              {nextBreakItem ? `${nextBreakItem.durationMinutes} MIN BREAK` : ' '}
            </div>
          </div>
        </section>

        {/* 右: PLAYERS と統計 */}
        <section className={`${styles.panel} ${styles.playersPanel}`}>
          <PanelCorners />
          <div className={styles.panelTitle}>PLAYERS</div>
          <div className={styles.playersRow}>
            <div className={styles.playersValue}>{stats.currentPlayers}</div>
            <div className={styles.playersTotal}>/ {stats.totalEntries}</div>
          </div>
          <div className={styles.statList}>
            <div className={`${styles.statCell} ${styles.statCellDivided}`}>
              <div className={styles.statLabel}>AVERAGE STACK</div>
              <div className={styles.statValue}>
                {stats.averageStack === null ? '-' : formatChips(stats.averageStack)}
              </div>
            </div>
            <div className={`${styles.statCell} ${styles.statCellDivided}`}>
              <div className={styles.statLabel}>ADD-ON</div>
              <div className={styles.statValue}>{stats.addons}</div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.statLabel}>LATE REGISTRATION</div>
              <div className={styles.statValue}>
                <TabularNumber text={lateRegText} />
              </div>
              <div
                className={`${styles.lateRegStatus} ${
                  lateReg.kind === 'open' ? styles.lateRegOpen : styles.lateRegClosed
                }`}
              >
                {lateReg.kind === 'open' ? 'OPEN' : lateReg.kind === 'closed' ? 'CLOSED' : '—'}
              </div>
            </div>
          </div>
        </section>

        <PausedBanner paused={paused} />
      </div>
    </div>
  )
}
