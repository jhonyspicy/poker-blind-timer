import { describe, expect, it } from 'vitest'
import {
  currentBlindLevelNumber,
  isOnBreak,
  lateRegStatus,
  msUntilNextBreak,
  nextBlindLevel,
  nextLevel,
  pauseTimer,
  prevLevel,
  remainingMs,
  resolveTimer,
  resumeTimer,
  startTimer,
} from './timer'
import type { StructureItem } from './types'

const MIN = 60_000

function blind(sb: number, bb: number, ante: number, durationMinutes: number): StructureItem {
  return { kind: 'blind', sb, bb, ante, durationMinutes }
}

// L1(20分) → L2(20分) → ブレイク(10分) → L3(15分)
const structure: StructureItem[] = [
  blind(100, 200, 200, 20),
  blind(200, 400, 400, 20),
  { kind: 'break', durationMinutes: 10 },
  blind(300, 600, 600, 15),
]

const T0 = 1_700_000_000_000

describe('resolveTimer / remainingMs', () => {
  it('レベル内では状態が変わらず残り時間が減る', () => {
    const state = startTimer(T0)
    const now = T0 + 5 * MIN
    expect(resolveTimer(state, structure, now)).toEqual(state)
    expect(remainingMs(state, structure, now)).toBe(15 * MIN)
  })

  it('残り時間 0 で次のレベルへ 1 回だけ遷移する(冪等)', () => {
    const state = startTimer(T0)
    const now = T0 + 20 * MIN
    const once = resolveTimer(state, structure, now)
    expect(once).toEqual({ status: 'running', levelIndex: 1, levelStartedAt: T0 + 20 * MIN })
    // 同じ now で何度 resolve しても結果は同じ
    expect(resolveTimer(once, structure, now)).toEqual(once)
  })

  it('非アクティブで複数レベル経過しても正しい位置に追いつく', () => {
    const state = startTimer(T0)
    // 45 分経過: L1(20) + L2(20) を消化し、ブレイク開始 5 分後
    const now = T0 + 45 * MIN
    const resolved = resolveTimer(state, structure, now)
    expect(resolved).toEqual({ status: 'running', levelIndex: 2, levelStartedAt: T0 + 40 * MIN })
    expect(remainingMs(state, structure, now)).toBe(5 * MIN)
    expect(isOnBreak(state, structure, now)).toBe(true)
  })

  it('最終レベルの残り時間が 0 になると finished になる', () => {
    const state = startTimer(T0)
    const total = (20 + 20 + 10 + 15) * MIN
    expect(resolveTimer(state, structure, T0 + total)).toEqual({ status: 'finished' })
    expect(remainingMs(state, structure, T0 + total)).toBe(0)
  })
})

describe('pause / resume', () => {
  it('一時停止中は時間が進まない', () => {
    const state = startTimer(T0)
    const paused = pauseTimer(state, structure, T0 + 5 * MIN)
    expect(paused).toEqual({ status: 'paused', levelIndex: 0, elapsedInLevelMs: 5 * MIN })
    // 1 時間放置しても残り時間は変わらない
    expect(remainingMs(paused, structure, T0 + 65 * MIN)).toBe(15 * MIN)
  })

  it('再開すると新しい基準時刻から続きが進む', () => {
    const state = startTimer(T0)
    const paused = pauseTimer(state, structure, T0 + 5 * MIN)
    const resumed = resumeTimer(paused, T0 + 65 * MIN)
    expect(remainingMs(resumed, structure, T0 + 65 * MIN)).toBe(15 * MIN)
    expect(remainingMs(resumed, structure, T0 + 70 * MIN)).toBe(10 * MIN)
  })

  it('レベル境界をまたいだ一時停止は追いついてから停止する', () => {
    const state = startTimer(T0)
    const paused = pauseTimer(state, structure, T0 + 25 * MIN)
    expect(paused).toEqual({ status: 'paused', levelIndex: 1, elapsedInLevelMs: 5 * MIN })
  })
})

describe('nextLevel / prevLevel', () => {
  it('次のレベルへ進むと継続時間がリセットされる', () => {
    const state = startTimer(T0)
    const now = T0 + 5 * MIN
    const next = nextLevel(state, structure, now)
    expect(next).toEqual({ status: 'running', levelIndex: 1, levelStartedAt: now })
    expect(remainingMs(next, structure, now)).toBe(20 * MIN)
  })

  it('最終レベルから進むと finished', () => {
    const last = { status: 'running', levelIndex: 3, levelStartedAt: T0 } as const
    expect(nextLevel(last, structure, T0 + MIN)).toEqual({ status: 'finished' })
  })

  it('先頭レベルから戻っても先頭に留まる', () => {
    const state = startTimer(T0)
    const now = T0 + 5 * MIN
    expect(prevLevel(state, structure, now)).toEqual({
      status: 'running',
      levelIndex: 0,
      levelStartedAt: now,
    })
  })

  it('finished から戻ると最終レベルが最初から始まる', () => {
    const now = T0 + 100 * MIN
    expect(prevLevel({ status: 'finished' }, structure, now)).toEqual({
      status: 'running',
      levelIndex: 3,
      levelStartedAt: now,
    })
  })

  it('一時停止中のレベル移動は一時停止を維持する', () => {
    const paused = { status: 'paused', levelIndex: 0, elapsedInLevelMs: 5 * MIN } as const
    expect(nextLevel(paused, structure, T0)).toEqual({
      status: 'paused',
      levelIndex: 1,
      elapsedInLevelMs: 0,
    })
  })
})

describe('表示用の導出値', () => {
  it('ブラインドレベル番号はブレイクを数えない', () => {
    const state = startTimer(T0)
    expect(currentBlindLevelNumber(state, structure, T0)).toBe(1)
    // ブレイク中(40〜50分)は null
    expect(currentBlindLevelNumber(state, structure, T0 + 45 * MIN)).toBeNull()
    // ブレイク後の L3
    expect(currentBlindLevelNumber(state, structure, T0 + 55 * MIN)).toBe(3)
  })

  it('次のブラインドはブレイクを飛ばして返す', () => {
    const state = startTimer(T0)
    // L2 進行中(20〜40分)の次のブラインドはブレイクを飛ばして L3
    const next = nextBlindLevel(state, structure, T0 + 25 * MIN)
    expect(next).toEqual(blind(300, 600, 600, 15))
    // 最後のレベル中は null
    expect(nextBlindLevel(state, structure, T0 + 55 * MIN)).toBeNull()
  })

  it('次のブレイクまでの残り時間はレベルをまたいで合算する', () => {
    const state = startTimer(T0)
    // 5 分経過: L1 残り 15 分 + L2 20 分 = 35 分
    expect(msUntilNextBreak(state, structure, T0 + 5 * MIN)).toBe(35 * MIN)
    // ブレイク中は null
    expect(msUntilNextBreak(state, structure, T0 + 45 * MIN)).toBeNull()
    // ブレイク後は以降にブレイクが無いので null
    expect(msUntilNextBreak(state, structure, T0 + 55 * MIN)).toBeNull()
  })

  it('レイトレジ締め切りまでの残り時間と締め切り後の状態', () => {
    const state = startTimer(T0)
    // 締め切りマーカー = L2 終了直後(index 2)
    expect(lateRegStatus(state, lateRegStructure, T0 + 5 * MIN)).toEqual({
      kind: 'open',
      msUntilClose: 35 * MIN,
    })
    expect(lateRegStatus(state, lateRegStructure, T0 + 45 * MIN)).toEqual({ kind: 'closed' })
    // マーカーが無ければ none
    expect(lateRegStatus(state, structure, T0)).toEqual({ kind: 'none' })
  })
})

// L1(20分) → L2(20分) → レイトレジ締め切り → ブレイク(10分) → L3(15分)
const lateRegStructure: StructureItem[] = [
  blind(100, 200, 200, 20),
  blind(200, 400, 400, 20),
  { kind: 'lateRegClose' },
  { kind: 'break', durationMinutes: 10 },
  blind(300, 600, 600, 15),
]

describe('レイトレジ締め切りマーカー(時間なし項目)', () => {
  it('自動遷移はマーカーを即座に通過する', () => {
    const state = startTimer(T0)
    // L1 + L2 = 40 分ちょうどでマーカーを飛ばしてブレイクへ
    expect(resolveTimer(state, lateRegStructure, T0 + 40 * MIN)).toEqual({
      status: 'running',
      levelIndex: 3,
      levelStartedAt: T0 + 40 * MIN,
    })
    expect(remainingMs(state, lateRegStructure, T0 + 45 * MIN)).toBe(5 * MIN)
  })

  it('手動のレベル移動はマーカーを飛ばす', () => {
    // L2(index 1)進行中に「次へ」→ マーカーを飛ばしてブレイク(index 3)
    const onL2 = { status: 'running', levelIndex: 1, levelStartedAt: T0 } as const
    expect(nextLevel(onL2, lateRegStructure, T0 + MIN)).toEqual({
      status: 'running',
      levelIndex: 3,
      levelStartedAt: T0 + MIN,
    })
    // ブレイク(index 3)から「前へ」→ マーカーを飛ばして L2(index 1)
    const onBreak = { status: 'running', levelIndex: 3, levelStartedAt: T0 } as const
    expect(prevLevel(onBreak, lateRegStructure, T0 + MIN)).toEqual({
      status: 'running',
      levelIndex: 1,
      levelStartedAt: T0 + MIN,
    })
  })

  it('マーカーがあっても合計時間・終了判定は変わらない', () => {
    const state = startTimer(T0)
    const total = (20 + 20 + 10 + 15) * MIN
    expect(resolveTimer(state, lateRegStructure, T0 + total)).toEqual({ status: 'finished' })
  })
})
