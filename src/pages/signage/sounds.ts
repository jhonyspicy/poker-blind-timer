import { assetUrl } from './preload'

/**
 * 効果音・アナウンスの再生。`public/sounds/<イベント名>.ogg` を置くだけで有効になり、
 * 未配置・自動再生制限時は無音でスキップする(design.md D14)
 */
export type SoundEvent = 'level-up-warning' | 'level-up' | 'break-start' | 'pause' | 'resume'

export function playSound(event: SoundEvent): void {
  const url = assetUrl(`${import.meta.env.BASE_URL}sounds/${event}.ogg`)
  if (url === null) return
  const audio = new Audio(url)
  audio.play().catch(() => {
    /* 素材なし(404)・自動再生制限時は何もしない */
  })
}
