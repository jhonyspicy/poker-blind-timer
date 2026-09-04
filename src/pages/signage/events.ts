/**
 * サイネージの全画面演出イベント。「何が起きたか」だけを表し、見せ方(動画・静止画・
 * CSS 演出・演出なし)はテーマが決める。各トーナメントで 1 回だけ発火する。
 * 発火条件の判定は共有(useSignageController の applyMilestones)で、テーマは変更できない。
 *
 * 再生済みの記録(SessionState.playedEffects)はこの型ではなく string[] で保存しており、
 * イベントを増減しても保存済みデータとの互換は保たれる
 */
export type EffectEvent = 'tournament-start' | 'in-the-money' | 'heads-up' | 'champion'
