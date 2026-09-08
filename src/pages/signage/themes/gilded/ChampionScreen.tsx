import { resolveThemeId } from '../../../../domain/theme'
import type { TournamentConfig } from '../../../../domain/types'
import { assetUrl, themeAssetPath } from '../../preload'
import styles from './ChampionScreen.module.css'
import { useStageScale } from './useStageScale'

/**
 * GILDED の優勝画面(デザインモック Champion Screen の移植)。
 * 背景画像は `public/themes/gilded/images/champion.png` を置くと表示される(無ければ深緑の地)。
 * 店名・トーナメント名・CHAMPION の金グラデ文字と王冠の飾り罫を上部に重ねる
 */
export default function ChampionScreen({
  storeName,
  config,
}: {
  storeName: string
  config: TournamentConfig
}) {
  const scale = useStageScale()
  const imageUrl = assetUrl(themeAssetPath(resolveThemeId(config.theme), 'images/champion.png'))
  const backgroundImage = imageUrl === null ? undefined : `url(${imageUrl})`
  return (
    <div className={styles.page}>
      <div
        className={styles.stage}
        style={{ transform: `translate(-50%, -50%) scale(${scale})`, backgroundImage }}
      >
        <div className={styles.textBlock}>
          <div className={styles.club}>{storeName}</div>
          <div className={styles.title}>{config.title}</div>
          <div className={styles.champion}>Champion</div>
          <svg
            viewBox="0 0 1200 90"
            width="1200"
            height="90"
            className={styles.crownRule}
            fill="none"
            stroke="#c9a24e"
            strokeWidth="4"
          >
            <defs>
              <linearGradient id="gildedCrownGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f0d489" />
                <stop offset="0.55" stopColor="#c9a24e" />
                <stop offset="1" stopColor="#e6c26c" />
              </linearGradient>
            </defs>
            <path d="M 0 48 H 470 L 500 30 H 520" />
            <path d="M 1200 48 H 730 L 700 30 H 680" />
            <path
              d="M 540 66 L 528 22 L 572 44 L 600 6 L 628 44 L 672 22 L 660 66 Z"
              fill="url(#gildedCrownGold)"
              stroke="none"
            />
            <path d="M 600 26 L 616 46 L 600 66 L 584 46 Z" fill="#0a1916" />
            <path d="M 540 74 H 660" strokeWidth="5" />
          </svg>
        </div>
      </div>
    </div>
  )
}
