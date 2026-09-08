import { assetUrl, themeAssetPath } from '../../preload'

/**
 * GILDED 専用音声の再生。共有層の効果音(SoundEvent)とはタイミングや対象が異なる
 * テーマ独自のアナウンスをここから鳴らす。素材なし(404)・自動再生制限時は無音でスキップする
 */
export function playGildedSound(relativePath: string): void {
  const url = assetUrl(themeAssetPath('gilded', relativePath))
  if (url === null) return
  void new Audio(url).play().catch(() => {
    /* 素材なし・自動再生制限時は何もしない */
  })
}
