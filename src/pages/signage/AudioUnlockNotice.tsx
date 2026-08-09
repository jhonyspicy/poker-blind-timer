import { useEffect, useState } from 'react'
import styles from './AudioUnlockNotice.module.css'

/**
 * 音声の自動再生がブロックされているかの判定。AudioContext の初期状態を使う
 * (自動再生が許可されていれば running、ブロックされていれば suspended になる)
 */
function isAutoplayBlocked(): boolean {
  if (typeof AudioContext === 'undefined') return false
  const probe = new AudioContext()
  const blocked = probe.state === 'suspended'
  void probe.close().catch(() => {})
  return blocked
}

/**
 * 音声の自動再生がブロックされているときの案内表示。
 * リロード直後のサイネージはユーザー操作を一度も受けておらず、ブラウザの
 * 自動再生制限で効果音・演出音声が鳴らない。ブロック中だけ案内を表示し、
 * 画面のどこかへの一度の操作(クリック / タップ / キー入力)で解除する
 */
export default function AudioUnlockNotice() {
  const [blocked, setBlocked] = useState(isAutoplayBlocked)

  useEffect(() => {
    if (!blocked) return
    // 操作自体がページに再生許可(sticky activation)を与えるため、
    // 以降の Audio.play() はそのまま成功するようになる
    const unlock = () => setBlocked(false)
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [blocked])

  if (!blocked) return null
  return <div className={styles.notice}>🔇 画面をクリックすると音声が有効になります</div>
}
