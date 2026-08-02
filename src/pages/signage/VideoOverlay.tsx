import { useEffect, useRef, useState } from 'react'
import styles from './VideoOverlay.module.css'

export type VideoEvent = 'tournament-start' | 'in-the-money' | 'heads-up' | 'champion'

/**
 * 演出動画のオーバーレイ再生。webm(映像のみ・透過可)+ogg(音声)を同時再生する。
 * `public/videos/<イベント名>.webm` が無ければ即座に onDone を呼んで何も表示しない。
 * 呼び出し側は key={event} を付けてイベントごとに作り直すこと
 */
export default function VideoOverlay({
  event,
  onDone,
  onStarted,
}: {
  event: VideoEvent
  /** 再生終了・失敗・素材なしのときに 1 回呼ばれる。安定した参照を渡すこと */
  onDone: (event: VideoEvent) => void
  /** 実際に再生が始まったときに 1 回呼ばれる(開始演出などの予約に使う)。安定した参照を渡すこと */
  onStarted?: (event: VideoEvent) => void
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const doneRef = useRef(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    doneRef.current = false
    const video = videoRef.current
    if (!video) return
    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      audioRef.current?.pause()
      onDone(event)
    }
    // 再生停滞の監視: currentTime が 5 秒進まなければ終了扱いにして
    // オーバーレイ(と後続の演出待ち)が永久に残らないようにする
    let watchdog: number | null = null
    let lastTime = -1
    let stallSeconds = 0
    const onCanPlay = () => {
      setVisible(true)
      void video
        .play()
        .then(() => onStarted?.(event))
        .catch(finish)
      void audioRef.current?.play().catch(() => {
        /* 音声は無くても映像だけ再生する */
      })
      watchdog ??= window.setInterval(() => {
        if (doneRef.current) return
        if (video.currentTime > lastTime) {
          lastTime = video.currentTime
          stallSeconds = 0
        } else if (++stallSeconds >= 5) {
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
      if (watchdog !== null) window.clearInterval(watchdog)
    }
  }, [event, onDone, onStarted])

  const base = `${import.meta.env.BASE_URL}videos/${event}`
  return (
    <div className={styles.overlay} style={{ opacity: visible ? 1 : 0 }}>
      <video ref={videoRef} className={styles.video} src={`${base}.webm`} playsInline />
      <audio ref={audioRef} src={`${base}.ogg`} />
    </div>
  )
}
