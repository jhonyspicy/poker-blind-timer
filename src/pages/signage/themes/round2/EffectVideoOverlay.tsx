import { useEffect, useMemo, useRef, useState } from 'react'
import type { EffectEvent } from '../../events'
import styles from './EffectVideoOverlay.module.css'
import { EFFECT_VIDEOS } from './assets'
import { round2AssetUrl } from './format'

/**
 * Round2 の演出: 動画のオーバーレイ再生。webm(映像のみ・透過)+ ogg(音声)を同時再生する
 * (透過 webm に音声を含めると再生バグがあるため分離している。標準テーマと同じ方式)。
 * 素材を持たないイベント(HEADS UP)や素材なし(404)は即座に onDone を呼んで何も表示しない。
 * テーマ間の結合を避けるため標準テーマの実装を共有せず、Round2 内に持つ。
 * 呼び出し側は key={event} を付けてイベントごとに作り直すこと
 */

interface EffectVideoOverlayProps {
  event: EffectEvent
  /** SignageThemeProps.onAdvance をそのまま渡す。合図の時刻はこのコンポーネントが決める */
  onAdvance: (event: EffectEvent) => void
  /** SignageThemeProps.onDone をそのまま渡す。素材なし・再生失敗でも必ず 1 回呼ぶ */
  onDone: (event: EffectEvent) => void
}

/** 再生停滞とみなすまでの秒数。オーバーレイが永久に残らないようにするための監視 */
const STALL_LIMIT_SECONDS = 5

export default function EffectVideoOverlay({ event, onAdvance, onDone }: EffectVideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const doneRef = useRef(false)
  const [visible, setVisible] = useState(false)
  // 表示中に先読みが完了しても URL を差し替えない(再生が最初からやり直しになる)よう、
  // イベントごとに一度だけ解決する
  const urls = useMemo(() => {
    const video = EFFECT_VIDEOS[event]
    if (video === undefined) return { video: null, audio: null, advanceMs: 0 }
    const base = `videos/${video.name}`
    return {
      video: round2AssetUrl(`${base}.webm`),
      audio: round2AssetUrl(`${base}.ogg`),
      advanceMs: video.advanceMs,
    }
  }, [event])

  useEffect(() => {
    doneRef.current = false
    if (urls.video === null) {
      // 素材を持たないイベント、または先読みで素材なし(404)と判明済み。待たずに即スキップする
      onDone(event)
      return
    }
    const video = videoRef.current
    if (!video) return
    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      audioRef.current?.pause()
      onDone(event)
    }
    // 再生停滞の監視: currentTime が一定時間進まなければ終了扱いにして
    // オーバーレイ(と後続の演出待ち)が永久に残らないようにする
    let watchdog: number | null = null
    let advanceTimer: number | null = null
    let lastTime = -1
    let stallSeconds = 0
    const onCanPlay = () => {
      setVisible(true)
      void video
        .play()
        .then(() => {
          // 再生開始を基準に合図を予約する。再生されなかった場合は finish 側から
          // 共有層が合図を補完するため、ここでは予約しない
          advanceTimer ??= window.setTimeout(() => onAdvance(event), urls.advanceMs)
        })
        .catch(finish)
      void audioRef.current?.play().catch(() => {
        /* 音声は無くても映像だけ再生する */
      })
      watchdog ??= window.setInterval(() => {
        if (doneRef.current) return
        if (video.currentTime > lastTime) {
          lastTime = video.currentTime
          stallSeconds = 0
        } else if (++stallSeconds >= STALL_LIMIT_SECONDS) {
          finish()
        }
      }, 1000)
    }
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('ended', finish)
    video.addEventListener('error', finish)
    // 素材が無い場合でも error が発火しない環境向けの保険
    const timeout = window.setTimeout(() => {
      if (video.readyState === 0) finish()
    }, 3000)
    return () => {
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('ended', finish)
      video.removeEventListener('error', finish)
      window.clearTimeout(timeout)
      if (advanceTimer !== null) window.clearTimeout(advanceTimer)
      if (watchdog !== null) window.clearInterval(watchdog)
    }
  }, [event, onAdvance, onDone, urls])

  if (urls.video === null) return null
  return (
    <div className={styles.overlay} style={{ opacity: visible ? 1 : 0 }}>
      <video ref={videoRef} className={styles.video} src={urls.video} playsInline />
      {urls.audio !== null && <audio ref={audioRef} src={urls.audio} />}
    </div>
  )
}
