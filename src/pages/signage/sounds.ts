import type { ThemeId } from '../../domain/theme'
import { assetUrl, themeAssetPath } from './preload'

/**
 * 効果音・アナウンスの再生。`public/themes/<テーマ名>/sounds/<イベント名>.ogg` を
 * 置くだけで有効になり、未配置・自動再生制限時は無音でスキップする(design.md D14)
 */
export type SoundEvent =
  | 'level-up-warning'
  | 'level-up'
  | 'break-start'
  | 'break-end'
  | 'pause'
  | 'resume'
  | 'entry'
  | 'add-on'
  | 'bust'
  | 'champion'

export function playSound(theme: ThemeId, event: SoundEvent): void {
  const url = assetUrl(themeAssetPath(theme, `sounds/${event}.ogg`))
  if (url === null) return
  const audio = new Audio(url)
  audio.play().catch(() => {
    /* 素材なし(404)・自動再生制限時は何もしない */
  })
}
