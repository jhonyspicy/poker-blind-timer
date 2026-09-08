import { formatBlind, formatChips, formatClock } from '../../../../domain/format'
import { lateRegStatus, nextBlindLevel, remainingMs } from '../../../../domain/timer'
import type { SessionState, TournamentConfig, TournamentStats } from '../../../../domain/types'
import { formatAnte } from './format'
import PausedBanner from './PausedBanner'
import styles from './BreakScreen.module.css'
import TabularNumber from './TabularNumber'
import { useStageScale } from './useStageScale'

/**
 * GILDED のブレイク画面(デザインモック Break Screen v2 の移植)。
 * 左にプライズ一覧(インマネ後は支払済み PAID / 次の支払い NEXT を表示)、
 * 右にブレイク残りのカウントダウン・PLAYERS / AVERAGE STACK・状況バッジ
 * (レイトレジ受付中 / バブル / インマネ)・NEXT BLINDS を表示する
 */

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const
const CORNER_LAYERS = [
  { offset: 20, size: 150 },
  { offset: 38, size: 84 },
  { offset: 56, size: 40 },
] as const

/** 四隅の三重ブラケット装飾 */
function CornerBrackets() {
  return (
    <>
      {CORNERS.flatMap((corner) =>
        CORNER_LAYERS.map(({ offset, size }) => (
          <div
            key={`${corner}-${size}`}
            className={`${styles.corner} ${styles[corner]}`}
            style={{
              width: size,
              height: size,
              ...(corner[0] === 't' ? { top: offset } : { bottom: offset }),
              ...(corner[1] === 'l' ? { left: offset } : { right: offset }),
            }}
          />
        )),
      )}
    </>
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

/** プライズ文(自由テキスト)の長さに応じた段階縮小 */
function prizeAmountClass(description: string): string {
  const len = description.length
  if (len <= 10) return styles.prizeAmount
  if (len <= 16) return `${styles.prizeAmount} ${styles.prizeAmountMedium}`
  return `${styles.prizeAmount} ${styles.prizeAmountLong}`
}

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
  const { structure, prizes } = config
  const timer = session.timer
  const remaining = remainingMs(timer, structure, now)
  const next = nextBlindLevel(timer, structure, now)
  const nextBlind = next?.kind === 'blind' ? next : null
  const lateReg = lateRegStatus(timer, structure, now)

  // 状況バッジ: レイトレジ受付中 > インマネ > バブル(インマネ前)の順に 1 つだけ表示する。
  // インマネはレイトレジ受付中には確定しない(演出イベントと同じ判定方針)
  const players = stats.currentPlayers
  const paidCount = prizes.length
  const regOpen = lateReg.kind === 'open'
  const inMoney = !regOpen && paidCount > 0 && players >= 1 && players <= paidCount
  const preBubble = !regOpen && !inMoney && paidCount > 0 && players > paidCount
  const nextPayout = inMoney ? prizes.find((prize) => prize.place === players) : null

  const timeText = formatClock(remaining)
  return (
    <div className={styles.page}>
      <div className={styles.stage} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <CornerBrackets />

        <div className={styles.titleBlock}>
          <div className={styles.title}>{config.title}</div>
          <div className={styles.titleRule} />
        </div>

        <div className={styles.vDivider} />

        {/* 左: プライズ一覧 */}
        <div className={styles.prizeColumn}>
          <div className={styles.prizeHeaderRow}>
            <div className={styles.headerLine} />
            <div className={styles.prizeHeader}>Prizes</div>
            <div className={styles.headerLine} />
          </div>
          <div className={styles.prizeList}>
            {prizes.map((prize) => {
              const settled = inMoney && prize.place > players
              const isNext = inMoney && prize.place === players
              return (
                <div
                  key={prize.place}
                  className={styles.prizeRow}
                  style={{ opacity: settled ? 0.35 : 1 }}
                >
                  <div className={styles.prizeRankGroup}>
                    <div className={`${styles.prizeRank} ${isNext ? styles.prizeRankNext : ''}`}>
                      {rankLabel(prize.place)}
                    </div>
                    <div className={styles.prizeTag}>{isNext ? 'NEXT' : settled ? 'PAID' : ''}</div>
                  </div>
                  <div className={prizeAmountClass(prize.description)}>{prize.description}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 右: カウントダウンと統計 */}
        <div className={styles.clockColumn}>
          <div className={styles.breakBadge}>Break</div>
          <div className={`${styles.clock} ${timeText.length > 5 ? styles.clockLong : ''}`}>
            <TabularNumber text={timeText} />
          </div>

          <div className={styles.statsRow}>
            <div className={styles.statCol}>
              <div className={styles.statLabel}>Players / Entries</div>
              <div className={styles.statValue}>
                {players} / {stats.totalEntries}
              </div>
            </div>
            <div className={styles.statDivider} />
            <div className={styles.statCol}>
              <div className={styles.statLabel}>Average Stack</div>
              <div className={styles.statValue}>
                {stats.averageStack === null ? '-' : formatChips(stats.averageStack)}
              </div>
            </div>
          </div>

          {regOpen && lateReg.kind === 'open' && (
            <div className={styles.statusBadge}>
              <div className={styles.statusLabel}>Late Reg Closes In</div>
              <div className={styles.statusValue}>
                <TabularNumber text={formatClock(lateReg.msUntilClose)} />
              </div>
            </div>
          )}
          {preBubble && (
            <div className={styles.statusBadge}>
              <div className={styles.statusLabel}>To the Money</div>
              <div className={styles.statusValue}>
                {players - paidCount} {players - paidCount === 1 ? 'Player' : 'Players'}
              </div>
            </div>
          )}
          {inMoney && (
            <div className={`${styles.statusBadge} ${styles.inMoneyBadge}`}>
              <div className={styles.inMoneyTitle}>In The Money</div>
              {nextPayout && (
                <div className={styles.inMoneySub}>
                  NEXT PAYOUT&ensp;{rankLabel(nextPayout.place)}&ensp;{nextPayout.description}
                </div>
              )}
            </div>
          )}

          <div className={styles.spacer} />

          <div className={styles.nextBlock}>
            <div className={styles.prizeHeaderRow}>
              <div className={styles.headerLine} />
              <div className={styles.nextHeader}>Next Blinds</div>
              <div className={styles.headerLine} />
            </div>
            <div className={styles.blindsRow}>
              <div className={styles.blindCol}>
                <div className={styles.statLabel}>SB</div>
                <div className={styles.blindValue}>
                  {nextBlind ? formatBlind(nextBlind.sb) : '-'}
                </div>
              </div>
              <div className={styles.statDividerSlim} />
              <div className={styles.blindCol}>
                <div className={styles.statLabel}>BB</div>
                <div className={styles.blindValue}>
                  {nextBlind ? formatBlind(nextBlind.bb) : '-'}
                </div>
              </div>
              <div className={styles.statDividerSlim} />
              <div className={styles.blindCol}>
                <div className={styles.statLabel}>ANTE</div>
                <div className={styles.blindValue}>
                  {nextBlind ? formatAnte(nextBlind.ante) : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <PausedBanner paused={timer.status === 'paused'} />
      </div>
    </div>
  )
}
