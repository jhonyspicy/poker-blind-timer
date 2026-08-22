import type { ComponentType } from 'react'
import type { ThemeId } from '../../domain/theme'

/**
 * サイネージの全画面演出イベント。「何が起きたか」だけを表し、見せ方(動画・静止画・
 * CSS 演出・演出なし)はテーマが決める。各トーナメントで 1 回だけ発火する。
 * 発火条件の判定は共有(useSignageController の applyMilestones)で、テーマは変更できない。
 *
 * 再生済みの記録(SessionState.playedEffects)はこの型ではなく string[] で保存しており、
 * イベントを増減しても保存済みデータとの互換は保たれる
 */
export type EffectEvent = 'tournament-start' | 'in-the-money' | 'heads-up' | 'champion'

/**
 * テーマが提供する全画面演出コンポーネントの props。
 * 演出はイベントごとに key を付けて作り直されるため、初期化は初回マウントで行ってよい
 */
export interface EffectOverlayProps {
  /** 素材の解決に使うテーマ id */
  theme: ThemeId
  event: EffectEvent
  /**
   * このイベントのドメインへの影響を進めてよい、という合図。
   * `tournament-start` ならタイマー起動、`champion` なら優勝画面への遷移を意味し、
   * それ以外のイベントでは無視される。演出のどの時点で呼ぶかはテーマが決める。
   * 2 回目以降の呼び出しは無視される。安定した参照が渡される
   */
  onAdvance: (event: EffectEvent) => void
  /**
   * 演出の終了。素材なし・再生失敗も含め必ず 1 回呼ぶこと。
   * 合図より先に呼ばれた場合は onAdvance も同時に行われる。安定した参照が渡される
   */
  onDone: (event: EffectEvent) => void
}

/** 演出コンポーネントの型。テーマ定義から参照する */
export type EffectOverlay = ComponentType<EffectOverlayProps>
