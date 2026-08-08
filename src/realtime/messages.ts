import type { HistoryCommand, HistoryEntry, StructureItem, TournamentStats } from '../domain/types'

/**
 * リモコン → サイネージのコマンド。増減量ではなく操作意図を送り、適用結果は
 * サイネージが決定する。requestId はリモコンが生成する一意な値で、サイネージは
 * 処理済み requestId を無視して重複適用を防ぐ。
 */
export type RemoteCommand =
  | { type: 'START'; requestId: string }
  | { type: 'HISTORY_ADD'; requestId: string; command: HistoryCommand; chip?: number }
  | { type: 'HISTORY_UPDATE'; requestId: string; id: number; chip: number }
  | { type: 'HISTORY_DELETE'; requestId: string; id: number }
  | { type: 'PAUSE'; requestId: string }
  | { type: 'RESUME'; requestId: string }
  | { type: 'NEXT_LEVEL'; requestId: string }
  | { type: 'PREV_LEVEL'; requestId: string }
  | { type: 'SET_REMAINING'; requestId: string; remainingMs: number }
  /** ストラクチャー編集(全量)。未来の項目のみの変更かどうかはサイネージが検証する */
  | { type: 'STRUCTURE_UPDATE'; requestId: string; structure: StructureItem[] }
  | { type: 'REQUEST_STATE'; requestId: string }

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** requestId 付与前のコマンド(リモコンの送信 API 用) */
export type RemoteCommandInput = DistributiveOmit<RemoteCommand, 'requestId'>

/** サイネージ → リモコンの状態スナップショット */
export interface StateSnapshot {
  /** publish 時点のエポック ms。リモコンは経過分を差し引いて残り時間を表示する */
  publishedAt: number
  status: 'waiting' | 'running' | 'paused' | 'finished'
  isBreak: boolean
  /** ブレイクを数えないブラインドレベル番号(1 始まり)。ブレイク中・終了時は null */
  levelNumber: number | null
  blind: { sb: number; bb: number; ante: number } | null
  remainingMs: number
  /** 現在レベルの持ち時間(ms)。残り時間スライダーの最大値に使う。進行中以外は null */
  levelDurationMs: number | null
  title: string
  histories: HistoryEntry[]
  stats: TournamentStats
  /** 実効ストラクチャー全量(セッション限定の上書き適用後)。リモコンの編集画面用 */
  structure: StructureItem[]
  /** 解決済みの現在項目 index。waiting / finished は null */
  currentIndex: number | null
}

/** Ably チャンネル上のメッセージ name */
export const MESSAGE_NAME = {
  command: 'command',
  state: 'state',
} as const
