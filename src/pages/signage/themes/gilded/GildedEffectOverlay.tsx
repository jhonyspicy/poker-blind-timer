import { useEffect, useMemo, useRef } from 'react'
import type { EffectEvent } from '../../events'
import { playGildedSound } from './sounds'
import styles from './GildedEffectOverlay.module.css'

/**
 * GILDED の演出: CSS アニメーションの全画面オーバーレイ。動画素材に依存しない。
 * 表示開始から 2 秒で進行の合図(tournament-start = タイマー起動)、5 秒で終了を返す。
 * prefers-reduced-motion 時はフェードのみに簡易化し、即座に合図を返す。
 * HEADS UP と優勝は演出を表示せず、即座に終了を返す(優勝は終了 = 合図として扱われ、
 * タイマー停止と優勝画面への遷移が演出なしで即時に行われる)。
 * 呼び出し側は key={event} を付けてイベントごとに作り直すこと
 */

/** 表示開始から進行の合図までの時間 */
const ADVANCE_DELAY_MS = 2_000

/** 演出全体の長さ。CSS 側のフェードアウト(overlayLife)と同期させること */
const DONE_DELAY_MS = 5_000

/** モーション低減時の長さ。CSS 側の overlayLifeReduced と同期させること */
const REDUCED_DONE_DELAY_MS = 1_500

/** 演出を表示するイベントと文言。ここに無いイベントは演出なしで即座に消化する */
const EVENT_LABELS: Partial<Record<EffectEvent, { title: string; sub: string }>> = {
  'tournament-start': { title: 'TOURNAMENT START', sub: 'Good Luck, Players' },
  'in-the-money': { title: 'IN THE MONEY', sub: 'All Remaining Players Are Paid' },
}

export default function GildedEffectOverlay({
  event,
  onAdvance,
  onDone,
}: {
  event: EffectEvent
  /** SignageThemeProps.onAdvance をそのまま渡す。合図の時刻はこのコンポーネントが決める */
  onAdvance: (event: EffectEvent) => void
  /** SignageThemeProps.onDone をそのまま渡す。必ず 1 回呼ぶ */
  onDone: (event: EffectEvent) => void
}) {
  const reducedMotion = useMemo(() => matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const labels = EVENT_LABELS[event]
  // StrictMode のエフェクト二重実行で音が重ならないよう、イベントごとに 1 回だけ再生する
  const playedRef = useRef(false)

  useEffect(() => {
    // 演出なしのイベントは待たずに消化する(終了 = 合図として共有層が処理する)
    if (!labels) {
      onDone(event)
      return
    }
    // 演出音声(sounds/<イベント名>.ogg)を表示開始と同時に鳴らす。未配置は無音でスキップ
    if (!playedRef.current) {
      playedRef.current = true
      playGildedSound(`sounds/${event}.ogg`)
    }
    const timeouts: number[] = []
    if (reducedMotion) {
      onAdvance(event)
      timeouts.push(window.setTimeout(() => onDone(event), REDUCED_DONE_DELAY_MS))
    } else {
      timeouts.push(window.setTimeout(() => onAdvance(event), ADVANCE_DELAY_MS))
      timeouts.push(window.setTimeout(() => onDone(event), DONE_DELAY_MS))
    }
    return () => timeouts.forEach(clearTimeout)
  }, [event, labels, onAdvance, onDone, reducedMotion])

  if (!labels) return null
  const { title, sub } = labels
  return (
    <div className={styles.overlay}>
      <div className={styles.band}>
        <div className={styles.ruleTop} />
        <div className={styles.title}>{title}</div>
        <div className={styles.sub}>{sub}</div>
        <div className={styles.ruleBottom} />
      </div>
    </div>
  )
}
