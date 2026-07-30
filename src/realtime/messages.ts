import type { HistoryCommand, HistoryEntry, TournamentStats } from '../domain/types'

/**
 * リモコン → サイネージのコマンド。増減量ではなく操作意図を送り、適用結果は
 * サイネージが決定する。requestId はリモコンが生成する一意な値で、サイネージは
 * 処理済み requestId を無視して重複適用を防ぐ。
 */
export type RemoteCommand =
  | { type: 'HISTORY_ADD'; requestId: string; command: HistoryCommand; chip?: number }
  | { type: 'HISTORY_UPDATE'; requestId: string; id: number; chip: number }
  | { type: 'HISTORY_DELETE'; requestId: string; id: number }
  | { type: 'PAUSE'; requestId: string }
  | { type: 'RESUME'; requestId: string }
  | { type: 'NEXT_LEVEL'; requestId: string }
  | { type: 'PREV_LEVEL'; requestId: string }
  | { type: 'TITLE_UPDATE'; requestId: string; title: string }
  | { type: 'REQUEST_STATE'; requestId: string }

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** requestId 付与前のコマンド(リモコンの送信 API 用) */
export type RemoteCommandInput = DistributiveOmit<RemoteCommand, 'requestId'>

/** サイネージ → リモコンの状態スナップショット */
export interface StateSnapshot {
  /** publish 時点のエポック ms。リモコンは経過分を差し引いて残り時間を表示する */
  publishedAt: number
  status: 'running' | 'paused' | 'finished'
  isBreak: boolean
  /** ブレイクを数えないブラインドレベル番号(1 始まり)。ブレイク中・終了時は null */
  levelNumber: number | null
  blind: { sb: number; bb: number; ante: number } | null
  remainingMs: number
  title: string
  histories: HistoryEntry[]
  stats: TournamentStats
}

/** Ably チャンネル上のメッセージ name */
export const MESSAGE_NAME = {
  command: 'command',
  state: 'state',
} as const
