import { useEffect, useRef, useState } from 'react'
import styles from './VideoOverlay.module.css'

export type VideoEvent = 'tournament-start' | 'in-the-money' | 'heads-up' | 'champion'

/**
 * 演出動画のオーバーレイ再生。webm(映像のみ・透過可)+ogg(音声)を同時再生する。
 * `public/videos/<イベント名>.webm` が無ければ即座に onDone を呼んで何も表示しない。
 * 呼び出し側は key={event} を付けてイベントごとに作り直すこと
 */
export default function VideoOverlay({ event, onDone }: { event: VideoEvent; onDone: () => void }) {
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
      onDone()
    }
    const onCanPlay = () => {
      setVisible(true)
      void video.play().catch(finish)
      void audioRef.current?.play().catch(() => {
        /* 音声は無くても映像だけ再生する */
      })
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
    }
  }, [event, onDone])

  const base = `${import.meta.env.BASE_URL}videos/${event}`
  return (
    <div className={styles.overlay} style={{ opacity: visible ? 1 : 0 }}>
      <video ref={videoRef} className={styles.video} src={`${base}.webm`} playsInline />
      <audio ref={audioRef} src={`${base}.ogg`} />
    </div>
  )
}
