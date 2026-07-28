import { describe, expect, it } from 'vitest'
import { addHistory, deleteHistory, deriveStats, updateHistoryChip } from './stats'
import type { HistoryEntry } from './types'

// spec のシナリオ: entry(25000) × 3、addon(30000) × 1、bust × 1
const histories: HistoryEntry[] = [
  { id: 1, command: 'entry', chip: 25000 },
  { id: 2, command: 'entry', chip: 25000 },
  { id: 3, command: 'entry', chip: 25000 },
  { id: 4, command: 'addon', chip: 30000 },
  { id: 5, command: 'bust' },
]

describe('deriveStats', () => {
  it('履歴から統計を導出する', () => {
    expect(deriveStats(histories)).toEqual({
      totalEntries: 3,
      currentPlayers: 2,
      addons: 1,
      totalChips: 105000,
      averageStack: 52500,
    })
  })

  it('プレイヤーが 0 のとき平均チップは null', () => {
    expect(deriveStats([])).toEqual({
      totalEntries: 0,
      currentPlayers: 0,
      addons: 0,
      totalChips: 0,
      averageStack: null,
    })
    const allBusted: HistoryEntry[] = [
      { id: 1, command: 'entry', chip: 25000 },
      { id: 2, command: 'bust' },
    ]
    // バストしてもチップは場に残る想定だが、表示上プレイヤー 0 なら平均は null
    expect(deriveStats(allBusted).averageStack).toBeNull()
  })

  it('平均チップは四捨五入した整数になる', () => {
    const h: HistoryEntry[] = [
      { id: 1, command: 'entry', chip: 25000 },
      { id: 2, command: 'entry', chip: 25000 },
      { id: 3, command: 'entry', chip: 25001 },
    ]
    expect(deriveStats(h).averageStack).toBe(25000)
  })
})

describe('addHistory', () => {
  it('id を採番して末尾に追加する', () => {
    const result = addHistory(histories, 6, { command: 'entry', chip: 25000 })
    expect(result.histories).toHaveLength(6)
    expect(result.histories[5]).toEqual({ id: 6, command: 'entry', chip: 25000 })
    expect(result.nextHistoryId).toBe(7)
  })
})

describe('updateHistoryChip', () => {
  it('id 指定でチップ量を修正し統計に反映される', () => {
    const updated = updateHistoryChip(histories, 4, 40000)
    expect(updated.find((h) => h.id === 4)?.chip).toBe(40000)
    expect(deriveStats(updated).averageStack).toBe(57500)
  })

  it('bust と存在しない id は変更しない', () => {
    expect(updateHistoryChip(histories, 5, 40000)).toEqual(histories)
    expect(updateHistoryChip(histories, 999, 40000)).toEqual(histories)
  })
})

describe('deleteHistory', () => {
  it('id 指定で削除し統計が再計算される', () => {
    const deleted = deleteHistory(histories, 4)
    expect(deleted).toHaveLength(4)
    expect(deriveStats(deleted)).toEqual({
      totalEntries: 3,
      currentPlayers: 2,
      addons: 0,
      totalChips: 75000,
      averageStack: 37500,
    })
  })

  it('存在しない id の削除は何もしない(重複受信に安全)', () => {
    expect(deleteHistory(histories, 999)).toEqual(histories)
  })
})
