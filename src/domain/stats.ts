import type { HistoryEntry, TournamentStats } from './types'

/**
 * 操作履歴から統計を導出する。カウンタを持たず、履歴が唯一の情報源なので
 * 履歴の修正・削除やコマンドの重複排除後も常に一貫した値になる。
 */
export function deriveStats(histories: HistoryEntry[]): TournamentStats {
  let totalEntries = 0
  let busts = 0
  let addons = 0
  let totalChips = 0
  for (const h of histories) {
    switch (h.command) {
      case 'entry':
        totalEntries += 1
        totalChips += h.chip ?? 0
        break
      case 'addon':
        addons += 1
        totalChips += h.chip ?? 0
        break
      case 'bust':
        // バストしてもチップは場に残るため totalChips は減らさない
        busts += 1
        break
    }
  }
  const currentPlayers = totalEntries - busts
  return {
    totalEntries,
    currentPlayers,
    addons,
    totalChips,
    averageStack: currentPlayers > 0 ? Math.round(totalChips / currentPlayers) : null,
  }
}

/**
 * 優勝が確定したか。現在プレイヤーが 1 人まで絞られた状態。
 * エントリーが 1 件だけの開始直後(bust 無し)は優勝とみなさない
 */
export function isChampionDecided(stats: TournamentStats): boolean {
  return stats.totalEntries >= 2 && stats.currentPlayers === 1
}

export interface AddHistoryResult {
  histories: HistoryEntry[]
  nextHistoryId: number
}

export function addHistory(
  histories: HistoryEntry[],
  nextHistoryId: number,
  entry: Omit<HistoryEntry, 'id'>,
): AddHistoryResult {
  return {
    histories: [...histories, { ...entry, id: nextHistoryId }],
    nextHistoryId: nextHistoryId + 1,
  }
}

/** id 指定でチップ量を修正する。bust や存在しない id には何もしない */
export function updateHistoryChip(
  histories: HistoryEntry[],
  id: number,
  chip: number,
): HistoryEntry[] {
  return histories.map((h) => (h.id === id && h.command !== 'bust' ? { ...h, chip } : h))
}

/** id 指定で履歴を削除する。存在しない id には何もしない(重複受信に安全) */
export function deleteHistory(histories: HistoryEntry[], id: number): HistoryEntry[] {
  return histories.filter((h) => h.id !== id)
}
