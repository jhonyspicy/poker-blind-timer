import { formatBlind } from '../../../../domain/format'
import type { TournamentConfig, TournamentStats } from '../../../../domain/types'
import { round2AssetUrl } from './format'
import StoreBadge from './StoreBadge'
import styles from './WaitingScreen.module.css'
import { useFitText } from './useFitText'
import { useStageScale } from './useStageScale'

/** タイトルの上限幅。超えたら文字サイズを縮める(モック準拠) */
const TITLE_MAX_WIDTH = 1100

/** この文字数以上のブラインド値(例: 50,000)は列幅に収まらないため 1 段小さく表示する */
const LONG_BLIND_CHARS = 6

/**
 * Round2 の待機画面(デザインモック Tournament Waiting の移植)。
 * 背景画像の上に店名バッジ・トーナメント名・「まもなく開幕」・
 * STARTING BLINDS / ENTRIES のパネルを表示する
 */
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
  const titleRef = useFitText<HTMLDivElement>(config.title, TITLE_MAX_WIDTH, 'shrink')
  const firstBlind = config.structure.find((item) => item.kind === 'blind')
  // ANTE なし(0)の設定では列ごと省く(モックの showAnte = false 相当)
  const blinds = firstBlind
    ? [
        { label: 'SB', value: formatBlind(firstBlind.sb) },
        { label: 'BB', value: formatBlind(firstBlind.bb) },
        ...(firstBlind.ante > 0 ? [{ label: 'ANTE', value: formatBlind(firstBlind.ante) }] : []),
      ]
    : [
        { label: 'SB', value: '-' },
        { label: 'BB', value: '-' },
      ]
  const bgUrl = round2AssetUrl('images/waiting-bg.webp')
  return (
    <div className={styles.page}>
      <div
        className={styles.stage}
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          backgroundImage: bgUrl === null ? undefined : `url(${bgUrl})`,
        }}
      >
        <div className={styles.vignette} />

        <div className={styles.storeRow}>
          <StoreBadge storeName={storeName} size="large" />
        </div>

        <div className={styles.titleRow}>
          <div ref={titleRef} className={styles.title}>
            {config.title}
          </div>
        </div>

        <div className={styles.statusRow}>
          <div className={styles.status}>
            <div className={styles.statusJa}>まもなく開幕</div>
            <div className={styles.statusEn}>WAITING TO START</div>
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelCol}>
            <div className={styles.panelHeader}>STARTING BLINDS</div>
            <div
              className={styles.blindsGrid}
              style={{ gridTemplateColumns: `repeat(${blinds.length}, minmax(0, 1fr))` }}
            >
              {blinds.map((blind, index) => (
                <div
                  key={blind.label}
                  className={`${styles.blindCell} ${index > 0 ? styles.blindCellDivided : ''}`}
                >
                  <div className={styles.blindLabel}>{blind.label}</div>
                  <div
                    className={`${styles.blindValue} ${
                      blind.value.length >= LONG_BLIND_CHARS ? styles.blindValueLong : ''
                    }`}
                  >
                    {blind.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className={`${styles.panelCol} ${styles.panelColDivided}`}>
            <div className={styles.panelHeader}>ENTRIES</div>
            <div className={styles.entries}>{stats.totalEntries.toLocaleString('en-US')}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
