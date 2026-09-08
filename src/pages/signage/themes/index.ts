import type { ComponentType } from 'react'
import { resolveThemeId, type ThemeId } from '../../../domain/theme'
import type { SessionState, TournamentConfig, TournamentStats } from '../../../domain/types'
import type { EffectEvent } from '../events'
import { DEFAULT_THEME_ASSETS } from './default/assets'
import DefaultRoot from './default/Root'
import { GILDED_THEME_ASSETS } from './gilded/assets'
import GildedRoot from './gilded/Root'

/**
 * サイネージのテーマ = Root コンポーネント 1 個 + 素材ディレクトリ(public/themes/<id>/)+
 * 宣言メタデータ(先読み素材・演出の上限時間)。
 * いつ・どの画面や演出を表示するかはテーマの全権で、共有層(useSignageController)は
 * タイマー進行・同期・状態の永続化・演出イベントの検知・先読みを担い、確定済みの
 * ドメイン状態と演出イベントを Root へ渡すだけでテーマの内部構成には関与しない。
 *
 * テーマの追加手順:
 *   1. default ディレクトリを雛形に Root コンポーネントを作る
 *   2. 先読みする素材を assets に列挙し、public/themes/<id>/ に配置する
 *   3. ここの SIGNAGE_THEMES と src/domain/theme.ts の THEMES に登録する
 */

/** サイネージの局面。共有層が算出する参考値で、テーマは無視してよい */
export type SignagePhase = 'waiting' | 'timer' | 'break' | 'champion'

/** 演出の上限時間の既定値。テーマが effectTimeoutMs で上書きできる */
export const DEFAULT_EFFECT_TIMEOUT_MS = 20_000

/** テーマの Root が受け取るもの。生のリモコンメッセージは渡らず、確定済みの状態のみ */
export interface SignageThemeProps {
  /** 素材の解決に使うテーマ id */
  theme: ThemeId
  session: SessionState
  /** セッション限定の上書きを反映した実効 config */
  config: TournamentConfig
  /** 操作履歴から導出済みの統計 */
  stats: TournamentStats
  roomName: string
  now: number
  /** 共有層が算出した局面(参考値)。従っても独自に表示を組み立ててもよい */
  phase: SignagePhase
  /**
   * 発生中の演出イベント。null なら演出なし。
   * テーマは非 null のイベントを必ず消化する義務がある: 演出を表示しない場合も
   * 含めて onDone を必ず呼ぶこと(呼ばないと共有層の上限時間まで進行が待たされる)
   */
  effectEvent: EffectEvent | null
  /**
   * このイベントのドメインへの影響を進めてよい、という合図。
   * `tournament-start` ならタイマー起動、`champion` ならタイマー停止を意味し、
   * それ以外のイベントでは無視される。演出のどの時点で呼ぶかはテーマが決める。
   * 2 回目以降の呼び出しは無視される。安定した参照が渡される
   */
  onAdvance: (event: EffectEvent) => void
  /**
   * 演出の終了。素材なし・再生失敗・演出を表示しない場合も含め必ず 1 回呼ぶこと。
   * 合図より先に呼ばれた場合は onAdvance も同時に行われる。安定した参照が渡される
   */
  onDone: (event: EffectEvent) => void
}

export interface SignageTheme {
  Root: ComponentType<SignageThemeProps>
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
    Root: DefaultRoot,
    assets: DEFAULT_THEME_ASSETS,
  },
  gilded: {
    Root: GildedRoot,
    // 演出は CSS のみで動画素材を持たない。音声素材のみ先読みする
    assets: GILDED_THEME_ASSETS,
  },
}

/** テーマ id からテーマ定義を解決する。未指定・不明は標準テーマ */
export function resolveTheme(theme: string | undefined): SignageTheme {
  return SIGNAGE_THEMES[resolveThemeId(theme)]
}
