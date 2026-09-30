import styles from './PausedBanner.module.css'

/**
 * 一時停止オーバーレイ。モックに一時停止のデザインが無いため、Round2 の
 * パネル意匠(ネイビー地 + シアン罫)で帯を作り、画面を暗転して PAUSED を表示する。
 * 帯はカウントダウンの下に置き、止まっている残り時間は見えるままにする。
 * タイマー画面・ブレイク画面の両方で 1920×1080 の stage 内に重ねる
 */
export default function PausedBanner({ paused }: { paused: boolean }) {
  if (!paused) return null
  return (
    <div className={styles.overlay}>
      <div className={styles.dim} />
      <div className={styles.band}>
        <div className={styles.pauseIcon}>
          <div className={styles.pauseBar} />
          <div className={styles.pauseBar} />
        </div>
        <div className={styles.label}>PAUSED</div>
      </div>
    </div>
  )
}
