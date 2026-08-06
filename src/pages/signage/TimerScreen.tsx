import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { formatChips, formatClock } from '../../domain/format'
import {
  currentBlindLevelNumber,
  lateRegStatus,
  msUntilNextBreak,
  nextBlindLevel,
  remainingMs,
} from '../../domain/timer'
import type { TimerState, TournamentConfig, TournamentStats } from '../../domain/types'
import PauseTapeOverlay from './PauseTapeOverlay'
import TabularNumber from './TabularNumber'
import TimerBackground, { type TimerBackgroundHandle } from './TimerBackground'
import styles from './TimerScreen.module.css'

/**
 * タイマー画面(デザインモック Poker Timer Level Up v2 の移植)。
 * 1920×1080 基準を scale でフィットさせ、中央の円形ゲージは Canvas で描画する。
 * レベルアップ演出・一時停止テープ演出を含む
 */

/** レベルアップ演出で表示する値のセット */
interface DisplayVals {
  level: string
  blinds: string
  ante: string
  next: ReactNode
}

/** レベルアップ演出中の表示状態。null なら通常表示 */
interface LevelUpFx {
  /** トリガー識別子(levelIndex)。変わるたびに演出タイムラインを開始する */
  key: number
  from: DisplayVals
  rollLevel: boolean
  rollBlinds: boolean
  rollNext: boolean
  levelUpVisible: boolean
  timerHidden: boolean
  dimmed: boolean
}

/**
 * 縦スライドで値が切り替わる表示。
 * 演出中(from あり)は「旧値が上へスライドアウトし、新値が下からスライドイン」。
 * 通常時(from = null)はスタックを持たない静的表示にして、
 * 演出終了時に巻き戻しアニメーションが見えないようにする
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

export default function TimerScreen({
  config,
  timer,
  stats,
  now,
}: {
  config: TournamentConfig
  timer: TimerState
  stats: TournamentStats
  now: number
}) {
  const { structure } = config
  const [scale, setScale] = useState(() =>
    Math.min(window.innerWidth / 1920, window.innerHeight / 1080),
  )
  const [fx, setFx] = useState<LevelUpFx | null>(null)
  const bgRef = useRef<TimerBackgroundHandle | null>(null)
  const fxTimeouts = useRef<number[]>([])
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  // ---- 表示値の導出 ----
  const paused = timer.status === 'paused'
  const levelIndex = timer.status === 'running' || timer.status === 'paused' ? timer.levelIndex : 0
  const currentItem = structure[levelIndex]
  const currentBlind = currentItem?.kind === 'blind' ? currentItem : null
  const remaining = remainingMs(timer, structure, now)
  // 開始前(waiting)は開始演出の途中でこの画面を先に見せるため、レベル 1 の内容で表示する
  const waitingPreview = timer.status === 'waiting'
  const levelText = String(
    currentBlindLevelNumber(timer, structure, now) ?? (waitingPreview && currentBlind ? 1 : '-'),
  )
  const blindsText = currentBlind
    ? `${formatChips(currentBlind.sb)} / ${formatChips(currentBlind.bb)}`
    : '-'
  const anteText = currentBlind ? formatChips(currentBlind.ante) : '-'
  const next = waitingPreview
    ? (structure.filter((item) => item.kind === 'blind')[1] ?? null)
    : nextBlindLevel(timer, structure, now)
  const nextNode: ReactNode =
    next && next.kind === 'blind' ? (
      <>
        {formatChips(next.sb)} / {formatChips(next.bb)}{' '}
        <span className={styles.nextAnte}>(ANTE {formatChips(next.ante)})</span>
      </>
    ) : (
      '-'
    )
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
  const prizeListRef = useRef<HTMLDivElement | null>(null)
  const [prizeOverflow, setPrizeOverflow] = useState(false)

  // ---- レベルアップ演出のトリガー ----
  // 直前レベルの表示値を state に保持し、レベルが切り替わった「そのレンダー中」に
  // 旧値を fx へ確保する。エフェクトで拾うと新値が 1 フレーム見えてしまう
  // (React 公式の「レンダー中の派生 state 更新」パターン)
  const currentVals: DisplayVals = {
    level: levelText,
    blinds: blindsText,
    ante: anteText,
    next: nextNode,
  }
  const [display, setDisplay] = useState<{ index: number; vals: DisplayVals }>({
    index: levelIndex,
    vals: currentVals,
  })
  if (display.index !== levelIndex) {
    if (levelIndex > display.index && structure[levelIndex]?.kind === 'blind') {
      setFx({
        key: levelIndex,
        from: display.vals,
        rollLevel: false,
        rollBlinds: false,
        rollNext: false,
        levelUpVisible: false,
        timerHidden: true,
        dimmed: true,
      })
    }
    setDisplay({ index: levelIndex, vals: currentVals })
  }

  // ---- スケーリング ----
  useEffect(() => {
    const onResize = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ---- PRIZE LIST のはみ出し検知 ----
  useEffect(() => {
    const el = prizeListRef.current
    if (!el) return
    const check = () => setPrizeOverflow(el.scrollHeight > el.clientHeight + 2)
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---- レベルアップ演出のタイムライン(fx がセットされたら段階的に進める) ----
  const fxKey = fx?.key ?? null
  useEffect(() => {
    if (fxKey === null) return
    const timeouts = fxTimeouts.current
    const t = (ms: number, fn: () => void) => {
      timeouts.push(window.setTimeout(fn, ms))
    }
    if (reducedMotion) {
      // モーション低減: ロールなしで LEVEL UP 表示のみ
      t(0, () =>
        setFx(
          (p) =>
            p && { ...p, levelUpVisible: true, rollLevel: true, rollBlinds: true, rollNext: true },
        ),
      )
      t(900, () => setFx((p) => p && { ...p, levelUpVisible: false, timerHidden: false }))
      t(1500, () => setFx(null))
    } else {
      bgRef.current?.levelUp()
      t(500, () => setFx((p) => p && { ...p, levelUpVisible: true, rollLevel: true }))
      t(750, () => setFx((p) => p && { ...p, rollBlinds: true }))
      t(1000, () => setFx((p) => p && { ...p, rollNext: true }))
      t(1500, () => setFx((p) => p && { ...p, levelUpVisible: false }))
      t(1750, () => setFx((p) => p && { ...p, timerHidden: false }))
      t(2250, () => setFx((p) => p && { ...p, dimmed: false }))
      t(3100, () => setFx(null))
    }
    return () => {
      timeouts.forEach(clearTimeout)
      timeouts.length = 0
    }
  }, [fxKey, reducedMotion])

  // ---- レンダリング ----
  const sideOpacity = fx?.dimmed ? 0.35 : 1
  const timeStyle = {
    fontSize: timeText.length > 5 ? 240 : 340,
    textShadow: `0 0 ${fx ? 28 : 0}px rgba(233,178,60,.35)`,
    opacity: fx?.timerHidden ? 0 : 1,
    transform: `scale(${fx?.timerHidden ? 0.86 : 1})`,
  }

  return (
    <div className={styles.page}>
      <TimerBackground ref={bgRef} />
      <div className={styles.stage} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className={styles.title}>{config.title}</div>
        <div className={styles.grid}>
          {/* 左: PRIZE LIST */}
          <div className={`${styles.prizePanel} ${styles.side}`} style={{ opacity: sideOpacity }}>
            <div className={styles.prizeHeader}>PRIZE LIST</div>
            <div
              ref={prizeListRef}
              className={`${styles.prizeList} ${prizeOverflow ? styles.prizeListFade : ''}`}
            >
              {config.prizes.map((prize) => (
                <div key={prize.place} className={styles.prizeRow}>
                  <div className={styles.prizeRank}>{rankLabel(prize.place)}</div>
                  <div className={styles.prizeValue}>{prize.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 中央 */}
          <div className={styles.center}>
            <div className={styles.levelBadgeRow}>
              <div className={styles.levelChevron}>《</div>
              <div className={styles.levelBadge}>
                <div className={styles.levelLabel}>LEVEL</div>
                <Roll
                  from={fx ? fx.from.level : null}
                  current={levelText}
                  rolled={fx?.rollLevel ?? false}
                  height={44}
                  animate={!reducedMotion}
                  className={styles.levelValue}
                />
              </div>
              <div className={styles.levelChevron}>》</div>
            </div>
            <div className={styles.timerArea}>
              <div className={styles.time} style={timeStyle}>
                <TabularNumber text={timeText} />
              </div>
              <div className={styles.levelUpText} style={{ opacity: fx?.levelUpVisible ? 1 : 0 }}>
                LEVEL UP
              </div>
            </div>
            <div className={styles.blindsLabel}>BLINDS</div>
            <div className={styles.blindsRoll}>
              <Roll
                from={fx ? fx.from.blinds : null}
                current={blindsText}
                rolled={fx?.rollBlinds ?? false}
                height={110}
                animate={!reducedMotion}
                className={styles.blindsValue}
              />
            </div>
            <div className={styles.anteRow}>
              <div className={styles.anteLabel}>ANTE</div>
              <Roll
                from={fx ? fx.from.ante : null}
                current={anteText}
                rolled={fx?.rollBlinds ?? false}
                height={88}
                animate={!reducedMotion}
                className={styles.anteValue}
              />
            </div>
            <div className={styles.divider}>
              <div className={styles.dividerLineL}></div>
              <div>◆</div>
              <div className={styles.dividerLineR}></div>
            </div>
            <div className={styles.nextLabel}>
              <div className={styles.nextChevron}>»</div>
              <div>NEXT BLINDS</div>
            </div>
            <div className={styles.nextRoll}>
              <Roll
                from={fx ? fx.from.next : null}
                current={nextNode}
                rolled={fx?.rollNext ?? false}
                height={58}
                animate={!reducedMotion}
                className={styles.nextValue}
              />
            </div>
          </div>

          {/* 右パネル */}
          <div className={`${styles.rightColumn} ${styles.side}`} style={{ opacity: sideOpacity }}>
            <div className={styles.statPair}>
              <div className={styles.statCellDivided}>
                <div className={styles.statLabel}>PLAYERS</div>
                <div className={styles.statValue}>
                  {stats.currentPlayers}{' '}
                  <span className={styles.statSub}>/ {stats.totalEntries}</span>
                </div>
              </div>
              <div className={styles.statCell}>
                <div className={styles.statLabel}>ADD-ON</div>
                <div className={styles.statValue}>{stats.addons}</div>
              </div>
            </div>
            <div className={styles.avgCard}>
              <div className={styles.statLabel}>AVERAGE STACK</div>
              <div className={styles.avgValue}>
                {stats.averageStack === null ? '-' : formatChips(stats.averageStack)}
              </div>
            </div>
            <div className={styles.breakCard}>
              <div className={styles.breakLabel}>NEXT BREAK</div>
              <div className={styles.breakValue}>
                <TabularNumber text={breakMs === null ? '--:--' : formatClock(breakMs)} />
              </div>
              <div className={styles.breakFooter}>
                <div className={styles.breakTimeLabel}>BREAK TIME</div>
                <div className={styles.breakTimeValue}>
                  {nextBreakItem ? formatClock(nextBreakItem.durationMinutes * 60_000) : '--:--'}
                </div>
              </div>
            </div>
            <div className={styles.lateRegCard}>
              <div className={styles.lateRegHeader}>
                <div className={styles.lateRegLabel}>LATE REGISTRATION</div>
                {lateReg.kind === 'open' && <div className={styles.lateRegEndsIn}>Ends in</div>}
              </div>
              <div className={styles.lateRegValue}>
                <TabularNumber
                  text={
                    lateReg.kind === 'none'
                      ? '--:--'
                      : lateReg.kind === 'closed'
                        ? 'CLOSED'
                        : formatClock(lateReg.msUntilClose)
                  }
                />
              </div>
            </div>
          </div>
        </div>
        <PauseTapeOverlay paused={paused} />
      </div>
    </div>
  )
}
