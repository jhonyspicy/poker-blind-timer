/** ブラインドレベル。ブレイクもストラクチャー内の 1 項目として扱い、進行ロジックを単純化する */
export interface BlindLevel {
  kind: 'blind'
  sb: number
  bb: number
  ante: number
  durationMinutes: number
}

export interface BreakItem {
  kind: 'break'
  durationMinutes: number
}

/**
 * レイトレジストレーション締め切りマーカー。ストラクチャー内に 1 つだけ置け、
 * タイマーがこの位置に到達した時点で受付終了となる(継続時間は持たない)
 */
export interface LateRegCloseItem {
  kind: 'lateRegClose'
}

export type StructureItem = BlindLevel | BreakItem | LateRegCloseItem

export interface Prize {
  place: number
  description: string
}

/** 店舗情報。トーナメント設定とは独立に 1 件だけ保持する */
export interface RoomInfo {
  name: string
}

export interface TournamentConfig {
  id: string
  title: string
  prizes: Prize[]
  structure: StructureItem[]
  createdAt: number
  updatedAt: number
}

export type HistoryCommand = 'entry' | 'addon' | 'bust'

/** エントリー / アドオン / バストの操作履歴。統計はすべてここから導出する */
export interface HistoryEntry {
  /** サイネージが採番する連番 */
  id: number
  command: HistoryCommand
  /** entry / addon のチップ量(記録時に入力した値)。bust には無い */
  chip?: number
}

export type TimerState =
  | {
      /** 開始前(待機画面)。リモコンの START までタイマーは進行しない */
      status: 'waiting'
    }
  | {
      status: 'running'
      levelIndex: number
      /** 現在レベルの開始基準時刻(エポック ms)。残り時間は now との差分から算出する */
      levelStartedAt: number
    }
  | {
      status: 'paused'
      levelIndex: number
      /** 一時停止時点でのレベル内経過時間(ms)。再開時に新しい基準時刻を計算する */
      elapsedInLevelMs: number
    }
  | { status: 'finished' }

/** 進行中トーナメントのスナップショット。IndexedDB に保存しリロード時に復元する */
export interface SessionState {
  configId: string
  /** ペアリングに使用する Ably チャンネル ID。サイネージのリロード時の再接続に使う */
  channelId: string
  timer: TimerState
  histories: HistoryEntry[]
  /** 次に採番する履歴 id */
  nextHistoryId: number
  /**
   * 再生済みの演出イベント名(各トーナメント 1 回だけ再生するため)。
   * 旧データには存在しないため省略可
   */
  playedEffects?: string[]
}

export interface TournamentStats {
  totalEntries: number
  currentPlayers: number
  addons: number
  /** entry と addon の chip 合計。バストしてもチップは場に残る */
  totalChips: number
  /** totalChips ÷ currentPlayers。プレイヤーが 0 のときは null */
  averageStack: number | null
}
