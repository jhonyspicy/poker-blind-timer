import type { TournamentConfig } from '../../domain/types'
import ChipFloatBackground from './ChipFloatBackground'
import styles from './WaitingScreen.module.css'

/**
 * 待機画面。プレイヤー・ディーラーの準備を待つ間に表示する。
 * 店名・トーナメント名・最初のブラインドをチップ浮遊背景の上に重ねる
 */
export default function WaitingScreen({
  storeName,
  config,
}: {
  storeName: string
  config: TournamentConfig
}) {
  const firstBlind = config.structure.find((item) => item.kind === 'blind')
  return (
    <div className={styles.page}>
      <ChipFloatBackground />
      <div className={styles.uiLayer}>
        <div className={styles.uiCenter}>
          <h1 className={`${styles.storeName} ${styles.goldText}`}>{storeName}</h1>
          <h2 className={`${styles.tournamentName} ${styles.goldText}`}>{config.title}</h2>
          {firstBlind && (
            <div className={styles.entryPlate}>
              <div className={styles.entryLabel}>
                <span className={styles.rule}></span>BLINDS
                <span className={styles.rule}></span>
              </div>
              <div className={styles.blinds}>
                <div className={styles.blindItem}>
                  <span className={styles.blindKey}>SB</span>
                  <span className={`${styles.blindVal} ${styles.goldText}`}>
                    {firstBlind.sb.toLocaleString()}
                  </span>
                </div>
                <span className={styles.blindSep}></span>
                <div className={styles.blindItem}>
                  <span className={styles.blindKey}>BB</span>
                  <span className={`${styles.blindVal} ${styles.goldText}`}>
                    {firstBlind.bb.toLocaleString()}
                  </span>
                </div>
                <span className={styles.blindSep}></span>
                <div className={styles.blindItem}>
                  <span className={styles.blindKey}>ANTE</span>
                  <span className={`${styles.blindVal} ${styles.goldText}`}>
                    {firstBlind.ante.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
