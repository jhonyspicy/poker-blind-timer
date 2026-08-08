import { validateStructure } from './config'
import { resolveTimer } from './timer'
import type { SessionState, StructureItem, TournamentConfig } from './types'

/** セッション限定の上書きを反映した実効ストラクチャー */
export function effectiveStructure(
  session: SessionState,
  config: TournamentConfig,
): StructureItem[] {
  return session.structureOverride ?? config.structure
}

/**
 * セッション限定の上書きを反映した実効 config。サイネージのタイマー進行・
 * スナップショット生成・画面描画はすべてこれを使う(保存済み設定は不変)
 */
export function effectiveConfig(session: SessionState, config: TournamentConfig): TournamentConfig {
  return session.structureOverride ? { ...config, structure: session.structureOverride } : config
}

function itemEquals(a: StructureItem, b: StructureItem): boolean {
  if (a.kind === 'blind' && b.kind === 'blind') {
    return (
      a.sb === b.sb && a.bb === b.bb && a.ante === b.ante && a.durationMinutes === b.durationMinutes
    )
  }
  if (a.kind === 'break' && b.kind === 'break') {
    return a.durationMinutes === b.durationMinutes
  }
  return a.kind === 'lateRegClose' && b.kind === 'lateRegClose'
}

/** 項目単位の完全一致。リモコンが適用結果の判定(送信内容との比較)にも使う */
export function structuresEqual(a: StructureItem[], b: StructureItem[]): boolean {
  return a.length === b.length && a.every((item, i) => itemEquals(item, b[i]))
}

/**
 * リモコンからのストラクチャー編集(STRUCTURE_UPDATE)を検証して適用する。
 * 採用できる場合は structureOverride を差し替えた次のセッションを、
 * 拒否する場合は null を返す(呼び出し側はスナップショットを配信し直して再同期させる)。
 *
 * 「未来のみ編集可」は先頭〜現在項目のプレフィックス一致で強制する。境界は
 * リモコンの表示ではなく適用時点のタイマー解決結果で判定するため、編集中に
 * レベルが自動遷移した場合、遷移後の現在項目に触れる編集は自動的に拒否される
 */
export function applyStructureUpdate(
  session: SessionState,
  config: TournamentConfig,
  incoming: StructureItem[],
  now: number,
): SessionState | null {
  if (validateStructure(incoming).length > 0) return null
  const current = effectiveStructure(session, config)
  const timer = resolveTimer(session.timer, current, now)
  if (timer.status === 'finished') return null
  if (timer.status === 'running' || timer.status === 'paused') {
    // 進行中・通過済みの項目(現在項目を含むプレフィックス)の改変を拒否する
    if (incoming.length <= timer.levelIndex) return null
    for (let i = 0; i <= timer.levelIndex; i++) {
      if (!itemEquals(current[i], incoming[i])) return null
    }
  }
  return { ...session, structureOverride: incoming }
}
