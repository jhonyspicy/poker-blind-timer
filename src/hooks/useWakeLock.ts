import { useEffect } from 'react'

/**
 * 画面スリープ防止(Screen Wake Lock API)。サイネージは長時間の常時表示、
 * リモコンは運営中の手元操作が前提のため、表示中はディスプレイの
 * 自動消灯・スリープを抑止する。
 * タブが非表示になるとロックはブラウザにより自動解放されるため、
 * 再表示時(visibilitychange)に取り直す。
 * 非対応ブラウザや取得失敗(省電力モード等)では何もしない(表示自体には影響しない)
 * @param enabled false の間はロックを取得せず、取得済みのロックは解放する
 *   (リモコンのトーナメント終了後など、抑止が不要になった場面で使う)
 */
export function useWakeLock(enabled = true) {
  useEffect(() => {
    if (!enabled) return
    if (!('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let disposed = false
    const request = async () => {
      try {
        const acquired = await navigator.wakeLock.request('screen')
        // 取得完了前にアンマウントされた場合は即解放する
        if (disposed) {
          void acquired.release()
          return
        }
        lock = acquired
      } catch {
        /* 非対応・省電力モードなどで取得できない場合は諦める */
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void lock?.release()
    }
  }, [enabled])
}
