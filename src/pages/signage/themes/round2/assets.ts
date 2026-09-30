import type { EffectEvent } from '../../events'
import type { SoundEvent } from '../../sounds'

/** 演出動画の素材と進行の合図の時刻 */
interface EffectVideo {
  /** 素材のファイル名(videos/<名前>.webm + .ogg) */
  name: string
  /**
   * 再生開始から進行の合図までの時間。開始はタイマー起動 = タイマー画面への切り替え、
   * 優勝はタイマー停止 = 優勝画面への切り替えの時刻になる(インマネはドメインへの影響なし)
   */
  advanceMs: number
}

/**
 * 演出動画を持つイベント。ここに無いイベント(HEADS UP)は演出を表示しない
 */
export const EFFECT_VIDEOS: Partial<Record<EffectEvent, EffectVideo>> = {
  'tournament-start': { name: 'shuffle-up-and-deal', advanceMs: 6_000 },
  'in-the-money': { name: 'in-the-money', advanceMs: 7_000 },
  champion: { name: 'champion', advanceMs: 7_000 },
}

/**
 * 共有層の効果音イベントのうち、Round2 が素材を持つもの(sounds/<イベント名>.ogg)。
 * level-up-warning(10 秒前予告)は 1 分前予告に置き換えるため、素材を置かず無効化している
 */
const SOUND_EVENTS: readonly SoundEvent[] = [
  'level-up',
  'break-start',
  'break-end',
  'pause',
  'resume',
  'entry',
  'add-on',
  'bust',
]

/** レベル終了 1 分前の予告(テーマ独自のタイミングで鳴らす) */
export const LEVEL_UP_WARNING_SOUND = 'sounds/level-up-warning-1min.ogg'

/** ブレイク終了 1 分前の「まもなく再開」の案内(テーマ独自のタイミングで鳴らす) */
export const RESUME_SOON_SOUND = 'sounds/resume-soon.ogg'

/** レジクロ前の最後のレベルが始まったときの告知(テーマ独自のタイミングで鳴らす) */
export const LATE_REG_LAST_LEVEL_SOUND = 'sounds/late-reg-last-level.ogg'

/** 広告カルーセルの画像スライド(テーマディレクトリ起点の相対パス)。表示順もこの順 */
export const ROUND2_AD_IMAGES = {
  drinks: [
    'images/ads/01-highball-beer.webp',
    'images/ads/02-gin-soda.webp',
    'images/ads/03-soft-drink.webp',
    'images/ads/04-cast-drink.webp',
  ],
  gtoWizard: 'images/ads/06-gto-wizard.webp',
} as const

/**
 * Round2 テーマの先読み対象(テーマディレクトリ起点の相対パス)。
 * 先読みはこの宣言だけを見るため、実際に配置している素材のみを列挙する。
 *
 * - videos/<名前>.webm + .ogg: 全画面演出(EFFECT_VIDEOS。映像は透過、音声は別ファイル)
 * - sounds/*.ogg: 共有層の効果音(SOUND_EVENTS)と、テーマ独自の 1 分前予告・まもなく再開の案内・レジクロ前最終レベルの告知
 * - images/waiting-bg.webp / images/champion.webp: 待機 / 優勝画面の背景
 * - videos/timer-background.webm: タイマー画面のループ背景(音声なし)
 * - images/ads/*: ブレイク画面の広告カルーセル(prize-bg はプライズ一覧スライドの背景)
 * - images/resume-soon.webp: ブレイク終盤の「まもなく再開」
 */
export const ROUND2_THEME_ASSETS: readonly string[] = [
  'images/waiting-bg.webp',
  'images/champion.webp',
  'videos/timer-background.webm',
  ...Object.values(EFFECT_VIDEOS).flatMap(({ name }) => [
    `videos/${name}.webm`,
    `videos/${name}.ogg`,
  ]),
  ...SOUND_EVENTS.map((event) => `sounds/${event}.ogg`),
  LEVEL_UP_WARNING_SOUND,
  RESUME_SOON_SOUND,
  LATE_REG_LAST_LEVEL_SOUND,
  ...ROUND2_AD_IMAGES.drinks,
  ROUND2_AD_IMAGES.gtoWizard,
  'images/ads/prize-bg.webp',
  'images/resume-soon.webp',
]
