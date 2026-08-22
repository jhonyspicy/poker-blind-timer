import type { ComponentType } from 'react'
import { resolveThemeId, type ThemeId } from '../../../domain/theme'
import type {
  SessionState,
  TournamentConfig,
  TimerState,
  TournamentStats,
} from '../../../domain/types'
import type { EffectOverlay } from '../events'
import { DEFAULT_THEME_ASSETS } from './default/assets'
import DefaultBreakScreen from './default/BreakScreen'
import DefaultChampionScreen from './default/ChampionScreen'
import DefaultTimerScreen from './default/TimerScreen'
import DefaultVideoEffectOverlay from './default/VideoEffectOverlay'
import DefaultWaitingScreen from './default/WaitingScreen'

/**
 * サイネージのテーマ = 画面コンポーネント一式 + 全画面演出 + 素材ディレクトリ
 * (public/themes/<id>/)。タイマー進行・同期・状態の永続化・演出イベントの検知条件・
 * 先読みの機構は共有で、テーマが差し替えるのは見た目・素材・演出の実装方式とタイミング。
 *
 * テーマの追加手順:
 *   1. default ディレクトリを雛形に画面コンポーネント一式を作る
 *   2. 演出を持つなら EffectOverlay を実装する(動画・静止画・CSS 演出のいずれでもよい)
 *   3. 先読みする素材を assets に列挙し、public/themes/<id>/ に配置する
 *   4. ここの SIGNAGE_THEMES と src/domain/theme.ts の THEMES に登録する
 */

/** 演出の上限時間の既定値。テーマが effectTimeoutMs で上書きできる */
export const DEFAULT_EFFECT_TIMEOUT_MS = 20_000

export interface SignageTheme {
  WaitingScreen: ComponentType<{
    storeName: string
    config: TournamentConfig
    stats: TournamentStats
  }>
  TimerScreen: ComponentType<{
    config: TournamentConfig
    timer: TimerState
    stats: TournamentStats
    now: number
  }>
  BreakScreen: ComponentType<{
    config: TournamentConfig
    session: SessionState
    stats: TournamentStats
    now: number
  }>
  ChampionScreen: ComponentType<{ storeName: string; config: TournamentConfig }>
  /**
   * 全画面演出。省略すると「演出なし」となり、イベント発生時に共有層が合図と終了を
   * 即座に行う(開始操作でそのままタイマーが動き出す)
   */
  EffectOverlay?: EffectOverlay
  /**
   * 先読みする素材(テーマディレクトリ起点の相対パス)。宣言した素材だけを取得する。
   * 省略すると先読みしない(再生時に都度ダウンロードする)
   */
  assets?: readonly string[]
  /**
   * 演出 1 件あたりの上限時間(ms)。この時間内に合図・終了が返らないと共有層が
   * 肩代わりして次へ進める。長い演出を持つテーマだけ指定する
   */
  effectTimeoutMs?: number
}

const SIGNAGE_THEMES: Record<ThemeId, SignageTheme> = {
  default: {
    WaitingScreen: DefaultWaitingScreen,
    TimerScreen: DefaultTimerScreen,
    BreakScreen: DefaultBreakScreen,
    ChampionScreen: DefaultChampionScreen,
    EffectOverlay: DefaultVideoEffectOverlay,
    assets: DEFAULT_THEME_ASSETS,
  },
}

/** テーマ id からコンポーネント一式を解決する。未指定・不明は標準テーマ */
export function resolveTheme(theme: string | undefined): SignageTheme {
  return SIGNAGE_THEMES[resolveThemeId(theme)]
}
