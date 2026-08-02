import type { TournamentConfig } from '../../domain/types'
import styles from './ChampionScreen.module.css'

/**
 * 優勝画面(デザインモック Champion Signage の移植)。
 * 背景画像は `public/images/champion.png` を置くと表示される(無ければ黒背景)。
 * 店名・トーナメント名は縁取り+金グラデの 2 層で重ねる
 */
export default function ChampionScreen({
  storeName,
  config,
}: {
  storeName: string
  config: TournamentConfig
}) {
  const backgroundImage = `url(${import.meta.env.BASE_URL}images/champion.png)`
  return (
    <div className={styles.page}>
      <div className={styles.frame} style={{ backgroundImage }}>
        <div className={styles.topShade}></div>
        <div className={styles.header}>
          <div className={styles.layered}>
            <div className={styles.venueOutline} aria-hidden>
              {storeName}
            </div>
            <div className={styles.venueGold}>{storeName}</div>
          </div>
          <div className={styles.divider}></div>
          <div className={styles.layered}>
            <div className={styles.titleOutline} aria-hidden>
              {config.title}
            </div>
            <div className={styles.titleGold}>{config.title}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
