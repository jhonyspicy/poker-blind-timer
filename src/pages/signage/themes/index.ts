import type { ComponentType } from 'react'
import { resolveThemeId, type ThemeId } from '../../../domain/theme'
import type {
  SessionState,
  TournamentConfig,
  TimerState,
  TournamentStats,
} from '../../../domain/types'
import DefaultBreakScreen from './default/BreakScreen'
import DefaultChampionScreen from './default/ChampionScreen'
import DefaultTimerScreen from './default/TimerScreen'
import DefaultWaitingScreen from './default/WaitingScreen'

/**
 * サイネージのテーマ = 画面コンポーネント一式 + 素材ディレクトリ(public/themes/<id>/)。
 * タイマー進行・同期・素材先読み・動画再生の機構は共有で、テーマが差し替えるのは
 * 見た目と素材のみ。テーマの追加は default ディレクトリを雛形に一式を作り、
 * ここと src/domain/theme.ts の THEMES に登録する
 */
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
}

const SIGNAGE_THEMES: Record<ThemeId, SignageTheme> = {
  default: {
    WaitingScreen: DefaultWaitingScreen,
    TimerScreen: DefaultTimerScreen,
    BreakScreen: DefaultBreakScreen,
    ChampionScreen: DefaultChampionScreen,
  },
}

/** テーマ id からコンポーネント一式を解決する。未指定・不明は標準テーマ */
export function resolveTheme(theme: string | undefined): SignageTheme {
  return SIGNAGE_THEMES[resolveThemeId(theme)]
}
