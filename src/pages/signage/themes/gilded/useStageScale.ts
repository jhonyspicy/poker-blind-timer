import { useEffect, useState } from 'react'

export const STAGE_WIDTH = 1920
export const STAGE_HEIGHT = 1080

/**
 * 1920×1080 の固定ステージを画面サイズへフィットさせる scale。
 * GILDED の各画面はこの値を stage 要素の transform に適用する
 */
export function useStageScale(): number {
  const fit = () => Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT)
  const [scale, setScale] = useState(fit)
  useEffect(() => {
    const onResize = () => setScale(fit())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return scale
}
