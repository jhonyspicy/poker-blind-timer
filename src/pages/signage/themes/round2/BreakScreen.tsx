import { formatBlind, formatChips, formatClock } from '../../../../domain/format'
import { durationMs, nextBlindLevel, remainingMs } from '../../../../domain/timer'
import type { SessionState, TournamentConfig, TournamentStats } from '../../../../domain/types'
import AdCarousel from './AdCarousel'
import styles from './BreakScreen.module.css'
import { formatAnte } from './format'
import PausedBanner from './PausedBanner'
import TabularNumber from './TabularNumber'
import { useStageScale } from './useStageScale'

/**
 * Round2 のブレイク画面(デザインモック Break Screen の移植)。
 * 左にブレイク残り時間・進捗バー・PLAYERS / AVERAGE STACK・NEXT BLINDS、
 * 右に広告カルーセルを表示する。残り 60 秒以下ではカルーセルを「まもなく再開」に切り替える
 */

/** この残り時間以下で「まもなく再開」を表示する(モック準拠) */
const RESUME_SOON_MS = 60_000

export default function BreakScreen({
  config,
  session,
  stats,
  now,
}: {
  config: TournamentConfig
  session: SessionState
  stats: TournamentStats
  now: number
}) {
  const scale = useStageScale()
  const { structure } = config
  const timer = session.timer
  const remaining = remainingMs(timer, structure, now)
  const currentItem =
    timer.status === 'running' || timer.status === 'paused' ? structure[timer.levelIndex] : null
  const totalMs = currentItem ? durationMs(currentItem) : 0
  const progress = totalMs > 0 ? Math.min(1, remaining / totalMs) : 0
  const next = nextBlindLevel(timer, structure, now)
  const nextBlind = next?.kind === 'blind' ? next : null
  const timeText = formatClock(remaining)
  const nextBlinds = [
    { label: 'SB', value: nextBlind ? formatBlind(nextBlind.sb) : '-' },
    { label: 'BB', value: nextBlind ? formatBlind(nextBlind.bb) : '-' },
    { label: 'ANTE', value: nextBlind ? formatAnte(nextBlind.ante) : '-' },
  ]
  const clockClass = [
    styles.clock,
    timeText.length > 5 ? styles.clockLong : '',
    remaining <= 0 ? styles.clockEnded : '',
    timer.status === 'paused' ? styles.clockPaused : '',
  ].join(' ')

  return (
    <div className={styles.page}>
      <div className={styles.stage} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className={styles.infoColumn}>
          <div>
            <div className={styles.breakLabel}>BREAK</div>
            <div className={clockClass}>
              <TabularNumber text={timeText} />
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} style={{ width: `${progress * 100}%` }} />
            </div>
          </div>

          <div className={styles.statsRow}>
            <div className={`${styles.statCol} ${styles.statColFirst}`}>
              <div className={styles.statLabel}>PLAYERS</div>
              <div className={styles.playersRow}>
                <span className={styles.statValue}>{stats.currentPlayers}</span>
                <span className={styles.playersTotal}>/ {stats.totalEntries}</span>
              </div>
            </div>
            <div className={`${styles.statCol} ${styles.statColSecond}`}>
              <div className={styles.statLabel}>AVERAGE STACK</div>
              <div className={styles.statValue}>
                {stats.averageStack === null ? '-' : formatChips(stats.averageStack)}
              </div>
            </div>
          </div>

          <div className={styles.nextBox}>
            <div className={styles.nextHeader}>NEXT BLINDS</div>
            <div className={styles.nextGrid}>
              {nextBlinds.map((blind, index) => (
                <div
                  key={blind.label}
                  className={`${styles.nextCol} ${index === 1 ? styles.nextColMiddle : ''}`}
                >
                  <div className={styles.nextLabel}>{blind.label}</div>
                  <div className={styles.nextValue}>{blind.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.divider} />

        <AdCarousel prizes={config.prizes} soon={remaining <= RESUME_SOON_MS} />

        <PausedBanner paused={timer.status === 'paused'} />
      </div>
    </div>
  )
}
