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

export type StructureItem = BlindLevel | BreakItem

export interface Prize {
  place: number
  description: string
}

export interface TournamentConfig {
  id: string
  shopName: string
  title: string
  prizes: Prize[]
  /** エントリー時に配られるチップ量。履歴の entry のデフォルト chip */
  startingStack: number
  /** アドオン / リバイを受け付けるか */
  addonEnabled: boolean
  /** アドオン 1 回あたりのチップ量。履歴の addon のデフォルト chip */
  addonChip: number
  structure: StructureItem[]
  /**
   * レイトレジストレーション締め切り位置。structure のこの index の項目が
   * 終了した時点で締め切り。null なら締め切りなし
   */
  lateRegEndIndex: number | null
  createdAt: number
  updatedAt: number
}

export type HistoryCommand = 'entry' | 'addon' | 'bust'

/** エントリー / アドオン / バストの操作履歴。統計はすべてここから導出する */
export interface HistoryEntry {
  /** サイネージが採番する連番 */
  id: number
  command: HistoryCommand
  /** entry / addon のチップ量(記録時点の値)。bust には無い */
  chip?: number
}

export type TimerState =
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
  timer: TimerState
  histories: HistoryEntry[]
  /** 次に採番する履歴 id */
  nextHistoryId: number
  /** リモコンからのタイトル変更(TITLE_UPDATE)の上書き値 */
  titleOverride: string | null
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
