import type { EffectEvent } from '../../events'
import type { SoundEvent } from '../../sounds'

/** 標準テーマが演出動画を持つイベント。webm(映像)+ ogg(音声)の 2 ファイル構成 */
const VIDEO_EVENTS: readonly EffectEvent[] = [
  'tournament-start',
  'in-the-money',
  'heads-up',
  'champion',
]

/** 標準テーマが効果音を持つイベント */
const SOUND_EVENTS: readonly SoundEvent[] = [
  'level-up-warning',
  'level-up',
  'break-start',
  'pause',
  'resume',
]

/**
 * 標準テーマの先読み対象(テーマディレクトリ起点の相対パス)。
 * 先読みはこの宣言だけを見るため、実際に配置している素材のみを列挙する
 */
export const DEFAULT_THEME_ASSETS: readonly string[] = [
  ...VIDEO_EVENTS.flatMap((event) => [`videos/${event}.webm`, `videos/${event}.ogg`]),
  ...SOUND_EVENTS.map((event) => `sounds/${event}.ogg`),
  'images/champion.png',
]
