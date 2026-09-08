import { formatBlind } from '../../../../domain/format'
import type { TournamentConfig, TournamentStats } from '../../../../domain/types'
import styles from './WaitingScreen.module.css'
import { useStageScale } from './useStageScale'

/**
 * GILDED の待機画面(デザインモック Tournament Waiting の移植)。
 * 深緑の地に金の外枠 + 四隅の段状装飾を重ね、店名・タイトル・
 * WAITING TO START バッジ・ENTRIES / 1ST PRIZE・最初のブラインドを表示する
 */

/** 四隅の段状アール・デコ装飾。transform の反転で 4 隅に使い回す */
function CornerOrnament({ corner }: { corner: 'tl' | 'tr' | 'bl' | 'br' }) {
  return (
    <div className={`${styles.corner} ${styles[corner]}`}>
      <div className={styles.cornerL1} />
      <div className={styles.cornerL2} />
      <div className={styles.cornerL3} />
      <div className={styles.cornerL4} />
    </div>
  )
}

/** 全角 1 / 半角 0.5 で数えた表示幅。フォント縮小の段階判定に使う */
function visualLength(text: string): number {
  let len = 0
  for (const ch of text) {
    len += ch.charCodeAt(0) > 0xff ? 1 : 0.5
  }
  return len
}

/** 長いタイトルは段階的に縮小して枠に収める */
function titleClass(title: string): string {
  const len = visualLength(title)
  if (len <= 10) return styles.title
  if (len <= 16) return `${styles.title} ${styles.titleMedium}`
  return `${styles.title} ${styles.titleLong}`
}

/** 長いプライズ文(自由テキスト)も同様に縮小する */
function prizeClass(description: string): string {
  const len = visualLength(description)
  if (len <= 5) return styles.bigValue
  if (len <= 10) return `${styles.bigValue} ${styles.bigValueMedium}`
  return `${styles.bigValue} ${styles.bigValueLong}`
}

export default function WaitingScreen({
  storeName,
  config,
  stats,
}: {
  storeName: string
  config: TournamentConfig
  stats: TournamentStats
}) {
  const scale = useStageScale()
  const firstBlind = config.structure.find((item) => item.kind === 'blind')
  const firstPrize = config.prizes.find((prize) => prize.place === 1)
  return (
    <div className={styles.page}>
      <div className={styles.stage} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className={styles.noise} />
        <div className={styles.frame} />
        <CornerOrnament corner="tl" />
        <CornerOrnament corner="tr" />
        <CornerOrnament corner="bl" />
        <CornerOrnament corner="br" />

        <div className={styles.content}>
          <div className={styles.top}>
            <div className={styles.club}>{storeName}</div>
            <div className={titleClass(config.title)}>{config.title}</div>

            <div className={styles.statusRow}>
              <div className={styles.statusLineL} />
              <div className={styles.statusBadge}>
                <div className={styles.statusText}>WAITING TO START</div>
              </div>
              <div className={styles.statusLineR} />
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statCol}>
                <div className={styles.smallLabel}>ENTRIES</div>
                <div className={styles.bigValue}>{stats.totalEntries}</div>
              </div>
              <div className={styles.vDividerTall} />
              <div className={styles.statCol}>
                <div className={styles.smallLabel}>1ST PRIZE</div>
                <div className={firstPrize ? prizeClass(firstPrize.description) : styles.bigValue}>
                  {firstPrize ? firstPrize.description : '-'}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.bottom}>
            <div className={styles.blindsLabelRow}>
              <div className={styles.blindsLabel}>STARTING BLINDS</div>
            </div>
            <div className={styles.blindsGrid}>
              <div className={styles.statCol}>
                <div className={styles.blindKey}>SB</div>
                <div className={styles.blindValue}>
                  {firstBlind ? formatBlind(firstBlind.sb) : '-'}
                </div>
              </div>
              <div className={styles.vDivider} />
              <div className={styles.statCol}>
                <div className={styles.blindKey}>BB</div>
                <div className={styles.blindValue}>
                  {firstBlind ? formatBlind(firstBlind.bb) : '-'}
                </div>
              </div>
              <div className={styles.vDivider} />
              <div className={styles.statCol}>
                <div className={styles.blindKey}>ANTE</div>
                <div className={styles.blindValue}>
                  {firstBlind ? formatBlind(firstBlind.ante) : '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
