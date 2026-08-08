import { deriveStats } from '../domain/stats'
import {
  currentBlindLevelNumber,
  durationMs,
  isOnBreak,
  remainingMs,
  resolveTimer,
} from '../domain/timer'
import type { SessionState, TournamentConfig } from '../domain/types'
import type { StateSnapshot } from './messages'

/** サイネージの現在状態からリモコン向けスナップショットを作る */
export function buildSnapshot(
  config: TournamentConfig,
  session: SessionState,
  now: number,
): StateSnapshot {
  const timer = resolveTimer(session.timer, config.structure, now)
  const currentItem =
    timer.status === 'running' || timer.status === 'paused'
      ? config.structure[timer.levelIndex]
      : null
  // 開始前は最初のブラインドを見せる(リモコンの待機画面用)
  const firstBlind =
    timer.status === 'waiting'
      ? (config.structure.find((item) => item.kind === 'blind') ?? null)
      : null
  const blind =
    currentItem?.kind === 'blind' ? currentItem : firstBlind?.kind === 'blind' ? firstBlind : null
  return {
    publishedAt: now,
    status: timer.status,
    isBreak: isOnBreak(timer, config.structure, now),
    levelNumber: currentBlindLevelNumber(timer, config.structure, now),
    blind: blind ? { sb: blind.sb, bb: blind.bb, ante: blind.ante } : null,
    remainingMs: remainingMs(timer, config.structure, now),
    levelDurationMs:
      currentItem && currentItem.kind !== 'lateRegClose' ? durationMs(currentItem) : null,
    title: config.title,
    histories: session.histories,
    stats: deriveStats(session.histories),
    structure: config.structure,
    currentIndex: timer.status === 'running' || timer.status === 'paused' ? timer.levelIndex : null,
  }
}
