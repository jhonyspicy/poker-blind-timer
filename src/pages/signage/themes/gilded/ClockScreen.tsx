import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatBlind, formatChips, formatClock } from '../../../../domain/format'
import {
  currentBlindLevelNumber,
  lateRegStatus,
  msUntilNextBreak,
  nextBlindLevel,
  remainingMs,
} from '../../../../domain/timer'
import type { TimerState, TournamentConfig, TournamentStats } from '../../../../domain/types'
import { formatAnte } from './format'
import PausedBanner from './PausedBanner'
import { playGildedSound } from './sounds'
import styles from './ClockScreen.module.css'
import TabularNumber from './TabularNumber'
import { useStageScale } from './useStageScale'

/**
 * GILDED のタイマー画面(デザインモック Tournament Clock の移植)。
 * ヘッダー(店名・タイトル)、左 PRIZE LIST、中央のレベルバッジ + カウントダウン +
 * ブラインド、右 PLAYERS / AVERAGE STACK / ADD-ON、下段 NEXT BREAK / LATE REGISTRATION。
 * ブレイク中は専用の BreakScreen(デザインモック Break Screen v2)へ切り替える。
 * レベルアップ演出は値のロール切替 + 背景の発光ブーストのみで行う(LEVEL UP の文字は出さない)
 */

/** 残り時間がこの値以下になったらカウントダウンを金色で警告表示する */
const TIME_WARNING_MS = 60_000

/**
 * レベル終了の予告アナウンス(GILDED 専用音声)を再生する先行時間。
 * 共有層の 10 秒前予告音(sounds/level-up-warning.ogg)は素材を置かないことで無効化し、
 * 代わりにこのタイミングで専用ファイル(level-up-warning-announce.ogg)を鳴らす
 */
const LEVEL_UP_WARNING_LEAD_MS = 60_000

/** レベルアップ演出で切り替える値のセット */
interface DisplayVals {
  badge: string
  blinds: string
  ante: string
}

/** レベルアップ演出中の状態。null なら通常表示 */
interface LevelUpFx {
  /** トリガー識別子(levelIndex)。変わるたびに演出タイムラインを開始する */
  key: number
  from: DisplayVals
  rolled: boolean
  boost: boolean
}

/**
 * 縦スライドで値が切り替わる表示。演出中(from あり)のみ旧値と新値をスタックし、
 * 通常時は静的表示にして巻き戻しアニメーションが見えないようにする
 */
function Roll({
  from,
  current,
  rolled,
  height,
  animate,
  className,
}: {
  from: ReactNode | null
  current: ReactNode
  rolled: boolean
  height: number
  animate: boolean
  className: string
}) {
  const line = (value: ReactNode, key: string) => (
    <div key={key} className={className} style={{ height, lineHeight: `${height}px` }}>
      {value}
    </div>
  )
  if (from === null) {
    return <div style={{ height, overflow: 'hidden' }}>{line(current, 'current')}</div>
  }
  return (
    <div style={{ height, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(${rolled ? '-50%' : '0%'})`,
          transition: animate ? 'transform 0.55s cubic-bezier(0.33, 0, 0.15, 1)' : 'none',
        }}
      >
        {line(from, 'from')}
        {line(current, 'current')}
      </div>
    </div>
  )
}

function rankLabel(place: number): string {
  const suffix =
    place % 10 === 1 && place !== 11
      ? 'st'
      : place % 10 === 2 && place !== 12
        ? 'nd'
        : place % 10 === 3 && place !== 13
          ? 'rd'
          : 'th'
  return `${place}${suffix}`
}

/** プライズ文(自由テキスト)の長さに応じた段階縮小(2 行クランプと併用) */
function prizeAmountClass(description: string): string {
  const len = description.length
  if (len <= 8) return styles.prizeAmount
  if (len <= 14) return `${styles.prizeAmount} ${styles.prizeAmountMedium}`
  return `${styles.prizeAmount} ${styles.prizeAmountLong}`
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
  const [fx, setFx] = useState<LevelUpFx | null>(null)
  const fxTimeouts = useRef<number[]>([])
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // ---- 表示値の導出 ----
  const paused = timer.status === 'paused'
  const levelIndex = timer.status === 'running' || timer.status === 'paused' ? timer.levelIndex : 0
  const currentItem = structure[levelIndex]
  const remaining = remainingMs(timer, structure, now)
  const upcoming = nextBlindLevel(timer, structure, now)
  const displayBlind = currentItem?.kind === 'blind' ? currentItem : null
  const followingBlind = upcoming?.kind === 'blind' ? upcoming : null
  const levelNumber = currentBlindLevelNumber(timer, structure, now)
  const badgeText =
    levelNumber === null ? 'LEVEL —' : `LEVEL ${String(levelNumber).padStart(2, '0')}`
  const blindsText = displayBlind
    ? `${formatBlind(displayBlind.sb)} / ${formatBlind(displayBlind.bb)}`
    : '-'
  const anteText = displayBlind ? formatAnte(displayBlind.ante) : '-'
  const timeText = formatClock(remaining)
  const breakMs = msUntilNextBreak(timer, structure, now)
  const nextBreakItem = (() => {
    for (let i = levelIndex + 1; i < structure.length; i++) {
      const item = structure[i]
      if (item.kind === 'break') return item
    }
    return null
  })()
  const lateReg = lateRegStatus(timer, structure, now)

  // ---- レベルアップ演出のトリガー ----
  // 直前レベルの表示値を state に保持し、レベルが切り替わった「そのレンダー中」に
  // 旧値を fx へ確保する(default テーマと同じ、レンダー中の派生 state 更新パターン)
  const currentVals: DisplayVals = { badge: badgeText, blinds: blindsText, ante: anteText }
  const [display, setDisplay] = useState<{ index: number; vals: DisplayVals }>({
    index: levelIndex,
    vals: currentVals,
  })
  if (display.index !== levelIndex) {
    if (levelIndex > display.index && structure[levelIndex]?.kind === 'blind') {
      setFx({ key: levelIndex, from: display.vals, rolled: false, boost: true })
    }
    setDisplay({ index: levelIndex, vals: currentVals })
  }

  // ---- レベルアップ演出のタイムライン ----
  const fxKey = fx?.key ?? null
  useEffect(() => {
    if (fxKey === null) return
    const timeouts = fxTimeouts.current
    const t = (ms: number, fn: () => void) => {
      timeouts.push(window.setTimeout(fn, ms))
    }
    if (reducedMotion) {
      // モーション低減: ロール・発光なしで即座に新しい値を表示する
      t(0, () => setFx((p) => p && { ...p, rolled: true, boost: false }))
      t(600, () => setFx(null))
    } else {
      t(400, () => setFx((p) => p && { ...p, rolled: true }))
      t(1100, () => setFx((p) => p && { ...p, boost: false }))
      t(1600, () => setFx(null))
    }
    return () => {
      timeouts.forEach(clearTimeout)
      timeouts.length = 0
    }
  }, [fxKey, reducedMotion])

  // ---- レベル終了 1 分前の予告アナウンス ----
  // ブラインドレベル進行中のみ対象(ブレイクでは鳴らさない)。レベルごとに 1 回だけ再生する
  const warnedLevelRef = useRef<number | null>(null)
  const shouldWarn =
    timer.status === 'running' &&
    displayBlind !== null &&
    remaining > 0 &&
    remaining <= LEVEL_UP_WARNING_LEAD_MS
  useEffect(() => {
    if (!shouldWarn || warnedLevelRef.current === levelIndex) return
    warnedLevelRef.current = levelIndex
    playGildedSound('sounds/level-up-warning-announce.ogg')
  }, [shouldWarn, levelIndex])

  const warning = remaining <= TIME_WARNING_MS
  const timeClass = [
    styles.time,
    timeText.length > 5 ? styles.timeLong : '',
    warning ? styles.timeWarning : '',
  ].join(' ')
  return (
    <div className={styles.page}>
      <div
        className={`${styles.stage} ${fx?.boost ? styles.stageBoost : ''}`}
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <header className={styles.header}>
          <div className={styles.club}>{storeName}</div>
          <div className={styles.title}>{config.title}</div>
        </header>

        <div className={styles.body}>
          {/* 左: PRIZE LIST */}
          <section className={styles.prizePanel}>
            <div className={styles.prizeHeader}>PRIZE LIST</div>
            <div className={styles.prizeList}>
              {config.prizes.map((prize) => (
                <div
                  key={prize.place}
                  className={`${styles.prizeRow} ${prize.place === 1 ? styles.prizeRowFirst : ''}`}
                >
                  <span className={styles.prizePlace}>{rankLabel(prize.place)}</span>
                  <span className={prizeAmountClass(prize.description)}>{prize.description}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 中央 */}
          <section className={styles.center}>
            <div className={styles.badgeRow}>
              <div className={styles.badgeLine} />
              <div className={styles.badge}>
                <Roll
                  from={fx ? fx.from.badge : null}
                  current={badgeText}
                  rolled={fx?.rolled ?? false}
                  height={56}
                  animate={!reducedMotion}
                  className={styles.badgeText}
                />
              </div>
              <div className={styles.badgeLine} />
            </div>
            <div className={styles.timerArea}>
              <div className={timeClass}>
                <TabularNumber text={timeText} />
              </div>
            </div>
            <div className={styles.centerRule} />
            <div className={styles.blindsGrid}>
              <div>
                <div className={styles.smallLabel}>BLINDS</div>
                <Roll
                  from={fx ? fx.from.blinds : null}
                  current={blindsText}
                  rolled={fx?.rolled ?? false}
                  height={98}
                  animate={!reducedMotion}
                  className={styles.blindsValue}
                />
              </div>
              <div className={styles.blindsDivider} />
              <div>
                <div className={styles.smallLabel}>ANTE</div>
                <Roll
                  from={fx ? fx.from.ante : null}
                  current={anteText}
                  rolled={fx?.rolled ?? false}
                  height={98}
                  animate={!reducedMotion}
                  className={styles.blindsValue}
                />
              </div>
            </div>
            <div className={styles.nextRow}>
              <span className={styles.nextLabel}>NEXT BLINDS</span>
              <span className={styles.nextValue}>
                {followingBlind
                  ? `${formatBlind(followingBlind.sb)} / ${formatBlind(followingBlind.bb)}`
                  : '-'}
              </span>
              <span className={styles.nextLabel}>ANTE</span>
              <span className={styles.nextValue}>
                {followingBlind ? formatAnte(followingBlind.ante) : '-'}
              </span>
            </div>
          </section>

          {/* 右: 統計 */}
          <section className={styles.statsPanel}>
            <div className={`${styles.statCell} ${styles.statCellDivided}`}>
              <div className={styles.smallLabel}>PLAYERS</div>
              <div className={styles.playersRow}>
                <span className={styles.playersValue}>{stats.currentPlayers}</span>
                <span className={styles.playersTotal}>/ {stats.totalEntries}</span>
              </div>
            </div>
            <div className={`${styles.statCell} ${styles.statCellDivided}`}>
              <div className={styles.smallLabel}>AVERAGE STACK</div>
              <div className={styles.statValue}>
                {stats.averageStack === null ? '-' : formatChips(stats.averageStack)}
              </div>
            </div>
            <div className={styles.statCell}>
              <div className={styles.smallLabel}>ADD-ON</div>
              <div className={styles.statValue}>{stats.addons}</div>
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <div className={`${styles.footerCell} ${styles.footerCellDivided}`}>
            <div className={styles.footerLabel}>NEXT BREAK</div>
            <div className={styles.footerValue}>
              <TabularNumber text={breakMs === null ? '--:--' : formatClock(breakMs)} />
            </div>
            {nextBreakItem && (
              <div className={styles.footerNote}>{nextBreakItem.durationMinutes} MIN BREAK</div>
            )}
          </div>
          <div className={styles.footerCell}>
            <div className={styles.footerLabel}>LATE REGISTRATION</div>
            <div className={styles.footerValue}>
              <TabularNumber
                text={
                  lateReg.kind === 'open'
                    ? formatClock(lateReg.msUntilClose)
                    : lateReg.kind === 'closed'
                      ? '00:00'
                      : '--:--'
                }
              />
            </div>
            <div
              className={`${styles.lateRegBadge} ${
                lateReg.kind === 'open' ? styles.lateRegOpen : styles.lateRegClosed
              }`}
            >
              {lateReg.kind === 'open' ? 'OPEN' : lateReg.kind === 'closed' ? 'CLOSED' : '—'}
            </div>
          </div>
        </footer>

        <PausedBanner paused={paused} />
      </div>
    </div>
  )
}
