import styles from './PausedBanner.module.css'

/**
 * 一時停止オーバーレイ(デザインモック Pause Overlay の移植)。
 * 画面を暗転し、金罫のバンドに一時停止アイコンと PAUSED を表示する。
 * タイマー画面・ブレイク画面の両方で 1920×1080 の stage 内に重ねる
 */
export default function PausedBanner({ paused }: { paused: boolean }) {
  if (!paused) return null
  return (
    <div className={styles.overlay}>
      <div className={styles.dim} />
      <div className={styles.band}>
        <div className={styles.stripesL} />
        <div className={styles.stripesR} />
        <div className={styles.pauseIcon}>
          <div className={styles.pauseBar} />
          <div className={styles.pauseBar} />
        </div>
        <div className={styles.label}>PAUSED</div>
      </div>
    </div>
  )
}
