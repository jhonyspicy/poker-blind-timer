import { deriveStats } from '../domain/stats'
import { currentBlindLevelNumber, isOnBreak, remainingMs, resolveTimer } from '../domain/timer'
import type { SessionState, TournamentConfig } from '../domain/types'
import type { StateSnapshot } from './messages'

/** サイネージの現在状態からリモコン向けスナップショットを作る */
export function buildSnapshot(
  config: TournamentConfig,
  session: SessionState,
  now: number,
): StateSnapshot {
  const timer = resolveTimer(session.timer, config.structure, now)
  const currentItem = timer.status === 'finished' ? null : config.structure[timer.levelIndex]
  const blind = currentItem?.kind === 'blind' ? currentItem : null
  return {
    publishedAt: now,
    status: timer.status,
    isBreak: isOnBreak(timer, config.structure, now),
    levelNumber: currentBlindLevelNumber(timer, config.structure, now),
    blind: blind ? { sb: blind.sb, bb: blind.bb, ante: blind.ante } : null,
    remainingMs: remainingMs(timer, config.structure, now),
    title: session.titleOverride ?? config.title,
    histories: session.histories,
    stats: deriveStats(session.histories),
  }
}
