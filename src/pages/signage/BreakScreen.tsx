import { formatChips, formatClock } from '../../domain/format'
import { lateRegStatus, nextBlindLevel, remainingMs } from '../../domain/timer'
import type { SessionState, TournamentConfig, TournamentStats } from '../../domain/types'
import BreakBackground from './BreakBackground'
import styles from './BreakScreen.module.css'
import PauseTapeOverlay from './PauseTapeOverlay'
import TabularNumber from './TabularNumber'

/**
 * ブレイク画面(デザインモック Break Screen の移植)。
 * 3D チップスタック背景の上に、BREAK 見出し・カウントダウン・
 * NEXT BLINDS / PLAYERS / AVG STACK の 3 カラムを重ねる
 */
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
  const { structure } = config
  const timer = session.timer
  const remaining = remainingMs(timer, structure, now)
  const next = nextBlindLevel(timer, structure, now)
  const nextBlind = next?.kind === 'blind' ? next : null
  // 次のブラインドのレベル番号 = そのブラインドまでに何個ブラインドがあるか
  const nextLevelNumber = (() => {
    if (!nextBlind) return null
    let count = 0
    for (const item of structure) {
      if (item.kind === 'blind') count += 1
      if (item === nextBlind) return count
    }
    return null
  })()
  const lateReg = lateRegStatus(timer, structure, now)
  const notice = config.entryNotice?.trim()

  return (
    <div className={styles.page}>
      <div className={styles.frame}>
        <BreakBackground />
        <div className={styles.shadeCenter}></div>
        <div className={styles.shadeBottom}></div>
        <div className={styles.vignette}></div>

        <div className={styles.content}>
          <div className={styles.top}>
            <div className={styles.breakTitleRow}>
              <div className={styles.ruleL}></div>
              <div className={styles.breakTitle}>Break</div>
              <div className={styles.ruleR}></div>
            </div>
            <div className={styles.tournamentName}>{config.title}</div>
          </div>

          <div className={styles.middle}>
            <div className={styles.time}>
              <TabularNumber text={formatClock(remaining)} />
            </div>
            {notice && lateReg.kind === 'open' && (
              <div className={styles.entryNotice}>{notice}</div>
            )}
          </div>

          <div className={styles.bottom}>
            <div className={styles.statsGrid}>
              <div className={styles.statCol}>
                <div className={styles.statLabel}>Next Blinds</div>
                <div className={styles.statValueGold}>
                  {nextBlind ? `${formatChips(nextBlind.sb)} / ${formatChips(nextBlind.bb)}` : '-'}
                </div>
                <div className={styles.statSubLine}>
                  {nextBlind
                    ? `Ante ${formatChips(nextBlind.ante)}` +
                      (nextLevelNumber !== null ? ` · Level ${nextLevelNumber}` : '')
                    : ''}
                </div>
              </div>

              <div className={styles.statColMid}>
                <div className={styles.statLabel}>Players</div>
                <div className={styles.playersRow}>
                  <span className={styles.playersLeft}>{stats.currentPlayers}</span>
                  <span className={styles.playersSlash}>/</span>
                  <span className={styles.playersTotal}>{stats.totalEntries}</span>
                </div>
              </div>

              <div className={styles.statCol}>
                <div className={styles.statLabel}>Avg Stack</div>
                <div className={styles.statValue}>
                  {stats.averageStack === null ? '-' : formatChips(stats.averageStack)}
                </div>
                <div className={styles.statSubLine}>
                  {stats.averageStack !== null && nextBlind
                    ? `${Math.round(stats.averageStack / nextBlind.bb)} BB`
                    : ''}
                </div>
              </div>
            </div>
          </div>
        </div>

        <PauseTapeOverlay paused={timer.status === 'paused'} />
      </div>
    </div>
  )
}
