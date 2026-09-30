import styles from './StoreBadge.module.css'
import { useFitText } from './useFitText'

/** large の店名を伸縮して収める幅(バッジ内の白枠の内側。モックの 484px) */
const LARGE_TEXT_WIDTH = 484

/** compact(タイマー画面ヘッダー)の店名の上限幅。これを超える長い店名だけ縮める */
const COMPACT_TEXT_MAX_WIDTH = 900

const CORNERS = ['tl', 'tr', 'bl', 'br'] as const
const EDGES = ['top', 'bottom', 'left', 'right'] as const

/**
 * Round2 の店名ロゴバッジ(青地に白の角飾りと罫)。
 * large は待機 / 優勝画面の固定サイズで、店名を枠の幅いっぱいに横伸縮する(モック準拠)。
 * compact はタイマー画面ヘッダー用で、文字量に合わせて広がる
 */
export default function StoreBadge({
  storeName,
  size,
}: {
  storeName: string
  size: 'large' | 'compact'
}) {
  const textRef = useFitText<HTMLDivElement>(
    storeName,
    size === 'large' ? LARGE_TEXT_WIDTH : COMPACT_TEXT_MAX_WIDTH,
    size === 'large' ? 'fill' : 'shrink',
  )
  return (
    <div className={`${styles.badge} ${styles[size]}`}>
      {CORNERS.map((corner) => (
        <div key={corner} className={`${styles.corner} ${styles[corner]}`} />
      ))}
      {EDGES.map((edge) => (
        <div key={edge} className={`${styles.edge} ${styles[edge]}`} />
      ))}
      <div ref={textRef} className={styles.text}>
        {storeName}
      </div>
    </div>
  )
}
