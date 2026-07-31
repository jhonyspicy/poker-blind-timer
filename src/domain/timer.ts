import type { StructureItem, TimerState } from './types'

const MS_PER_MINUTE = 60_000

export function durationMs(item: StructureItem): number {
  // レイトレジ締め切りマーカーは時間を持たず、到達すると即座に次へ進む
  return item.kind === 'lateRegClose' ? 0 : item.durationMinutes * MS_PER_MINUTE
}

export function startTimer(now: number): TimerState {
  return { status: 'running', levelIndex: 0, levelStartedAt: now }
}

/**
 * 実時間の経過を状態へ反映する。残り時間が 0 を過ぎたレベルを順に消化し、
 * 必要なら finished へ遷移する。純関数なので何度呼んでも同じ結果になり、
 * タブ非アクティブ後の復帰でも正しいレベル・残り時間に追いつく。
 */
export function resolveTimer(
  state: TimerState,
  structure: StructureItem[],
  now: number,
): TimerState {
  if (state.status !== 'running') return state

  let { levelIndex, levelStartedAt } = state
  for (;;) {
    const current = structure[levelIndex]
    if (!current) return { status: 'finished' }
    const duration = durationMs(current)
    if (now - levelStartedAt < duration) {
      // 変化が無ければ同一参照を返し、呼び出し側の不要な再レンダー・再保存を防ぐ
      return levelIndex === state.levelIndex
        ? state
        : { status: 'running', levelIndex, levelStartedAt }
    }
    if (levelIndex >= structure.length - 1) {
      return { status: 'finished' }
    }
    // 経過分を繰り越して次レベルの開始時刻を実時間に合わせる
    levelIndex += 1
    levelStartedAt += duration
  }
}

/** 現在レベルの残り時間(ms)。finished は 0、waiting は最初の項目の持ち時間 */
export function remainingMs(state: TimerState, structure: StructureItem[], now: number): number {
  const resolved = resolveTimer(state, structure, now)
  if (resolved.status === 'finished') return 0
  if (resolved.status === 'waiting') {
    return structure.length > 0 ? durationMs(structure[0]) : 0
  }
  const duration = durationMs(structure[resolved.levelIndex])
  if (resolved.status === 'paused') {
    return Math.max(0, duration - resolved.elapsedInLevelMs)
  }
  return Math.max(0, duration - (now - resolved.levelStartedAt))
}

export function pauseTimer(state: TimerState, structure: StructureItem[], now: number): TimerState {
  const resolved = resolveTimer(state, structure, now)
  if (resolved.status !== 'running') return resolved
  return {
    status: 'paused',
    levelIndex: resolved.levelIndex,
    elapsedInLevelMs: now - resolved.levelStartedAt,
  }
}

export function resumeTimer(state: TimerState, now: number): TimerState {
  if (state.status !== 'paused') return state
  return {
    status: 'running',
    levelIndex: state.levelIndex,
    levelStartedAt: now - state.elapsedInLevelMs,
  }
}

/** 次のレベルへ手動で進む。一時停止中は一時停止のまま次レベルの先頭に移る。開始前は何もしない */
export function nextLevel(state: TimerState, structure: StructureItem[], now: number): TimerState {
  const resolved = resolveTimer(state, structure, now)
  if (resolved.status === 'finished' || resolved.status === 'waiting') return resolved
  // 時間を持たないマーカーには停止できないので飛ばす
  let nextIndex = resolved.levelIndex + 1
  while (structure[nextIndex]?.kind === 'lateRegClose') nextIndex += 1
  if (nextIndex >= structure.length) return { status: 'finished' }
  return resolved.status === 'paused'
    ? { status: 'paused', levelIndex: nextIndex, elapsedInLevelMs: 0 }
    : { status: 'running', levelIndex: nextIndex, levelStartedAt: now }
}

/** 前のレベルへ手動で戻る。finished からは最終レベルの先頭に戻る。開始前は何もしない */
export function prevLevel(state: TimerState, structure: StructureItem[], now: number): TimerState {
  if (structure.length === 0) return { status: 'finished' }
  const resolved = resolveTimer(state, structure, now)
  if (resolved.status === 'waiting') return resolved
  const from = resolved.status === 'finished' ? structure.length : resolved.levelIndex
  // 時間を持たないマーカーには停止できないので飛ばす
  let prevIndex = from - 1
  while (prevIndex >= 0 && structure[prevIndex]?.kind === 'lateRegClose') prevIndex -= 1
  if (prevIndex < 0) {
    // 先頭側にマーカーしか無い場合は現在位置(または先頭)を最初からやり直す
    prevIndex = resolved.status === 'finished' ? structure.length - 1 : resolved.levelIndex
  }
  return resolved.status === 'paused'
    ? { status: 'paused', levelIndex: prevIndex, elapsedInLevelMs: 0 }
    : { status: 'running', levelIndex: prevIndex, levelStartedAt: now }
}

/** 現在ストラクチャー上のブレイク中かどうか */
export function isOnBreak(state: TimerState, structure: StructureItem[], now: number): boolean {
  const resolved = resolveTimer(state, structure, now)
  if (resolved.status === 'finished' || resolved.status === 'waiting') return false
  return structure[resolved.levelIndex]?.kind === 'break'
}

/** 現在のブラインドレベル番号(1 始まり、ブレイクは数えない)。finished / waiting は null */
export function currentBlindLevelNumber(
  state: TimerState,
  structure: StructureItem[],
  now: number,
): number | null {
  const resolved = resolveTimer(state, structure, now)
  if (resolved.status === 'finished' || resolved.status === 'waiting') return null
  let count = 0
  for (let i = 0; i <= resolved.levelIndex; i++) {
    if (structure[i]?.kind === 'blind') count += 1
  }
  return structure[resolved.levelIndex]?.kind === 'blind' ? count : null
}

/** 現在位置から見て次のブラインドレベル。無ければ null */
export function nextBlindLevel(
  state: TimerState,
  structure: StructureItem[],
  now: number,
): StructureItem | null {
  const resolved = resolveTimer(state, structure, now)
  if (resolved.status === 'finished' || resolved.status === 'waiting') return null
  for (let i = resolved.levelIndex + 1; i < structure.length; i++) {
    if (structure[i].kind === 'blind') return structure[i]
  }
  return null
}

/**
 * 次のブレイク開始までの残り時間(ms)。現在ブレイク中、または以降にブレイクが
 * 無い場合は null
 */
export function msUntilNextBreak(
  state: TimerState,
  structure: StructureItem[],
  now: number,
): number | null {
  const resolved = resolveTimer(state, structure, now)
  if (resolved.status === 'finished' || resolved.status === 'waiting') return null
  if (structure[resolved.levelIndex]?.kind === 'break') return null
  let total = remainingMs(resolved, structure, now)
  for (let i = resolved.levelIndex + 1; i < structure.length; i++) {
    if (structure[i].kind === 'break') return total
    total += durationMs(structure[i])
  }
  return null
}

export type LateRegStatus =
  { kind: 'none' } | { kind: 'open'; msUntilClose: number } | { kind: 'closed' }

/**
 * レイトレジストレーション締め切りまでの残り時間。
 * ストラクチャー内の lateRegClose マーカーにタイマーが到達した時点でクローズ
 */
export function lateRegStatus(
  state: TimerState,
  structure: StructureItem[],
  now: number,
): LateRegStatus {
  const closeIndex = structure.findIndex((item) => item.kind === 'lateRegClose')
  if (closeIndex === -1) return { kind: 'none' }
  const resolved = resolveTimer(state, structure, now)
  if (resolved.status === 'finished') return { kind: 'closed' }
  if (resolved.status === 'waiting') {
    // 開始前は締め切りまでの全項目分
    let total = 0
    for (let i = 0; i < closeIndex; i++) total += durationMs(structure[i])
    return { kind: 'open', msUntilClose: total }
  }
  if (resolved.levelIndex >= closeIndex) return { kind: 'closed' }
  let total = remainingMs(resolved, structure, now)
  for (let i = resolved.levelIndex + 1; i < closeIndex; i++) {
    total += durationMs(structure[i])
  }
  return { kind: 'open', msUntilClose: total }
}
