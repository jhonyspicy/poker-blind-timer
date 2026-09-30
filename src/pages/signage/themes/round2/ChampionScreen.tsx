import type { TournamentConfig } from '../../../../domain/types'
import styles from './ChampionScreen.module.css'
import { round2AssetUrl } from './format'
import StoreBadge from './StoreBadge'
import { useFitText } from './useFitText'
import { useStageScale } from './useStageScale'

/** タイトルの上限幅(モックの 88cqw)。超えたら文字サイズを縮める */
const TITLE_MAX_WIDTH = 1690

/**
 * Round2 の優勝画面(デザインモック Champion Screen の移植)。
 * 「CHAMPION」を描き込んだ背景画像(images/champion.png)の上に、
 * 店名バッジとトーナメント名を重ねる。背景が無ければ濃紺の地
 */
export default function ChampionScreen({
  storeName,
  config,
}: {
  storeName: string
  config: TournamentConfig
}) {
  const scale = useStageScale()
  const titleRef = useFitText<HTMLDivElement>(config.title, TITLE_MAX_WIDTH, 'shrink')
  const bgUrl = round2AssetUrl('images/champion.png')
  return (
    <div className={styles.page}>
      <div
        className={styles.stage}
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          backgroundImage: bgUrl === null ? undefined : `url(${bgUrl})`,
        }}
      >
        <div className={styles.storeRow}>
          <StoreBadge storeName={storeName} size="large" />
        </div>
        <div className={styles.titleRow}>
          <div ref={titleRef} className={styles.title}>
            {config.title}
          </div>
        </div>
      </div>
    </div>
  )
}
