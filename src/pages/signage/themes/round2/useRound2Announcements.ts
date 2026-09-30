import { useEffect, useRef } from 'react'
import { remainingMs, resolveTimer } from '../../../../domain/timer'
import type { SessionState, StructureItem } from '../../../../domain/types'
import { LATE_REG_LAST_LEVEL_SOUND, LEVEL_UP_WARNING_SOUND, RESUME_SOON_SOUND } from './assets'
import { playRound2Sound } from './format'

/**
 * 終了予告を鳴らす残り時間。ブレイクではブレイク画面が「まもなく再開」画像に
 * 切り替わるタイミング(BreakScreen の RESUME_SOON_MS)と揃えている
 */
const END_WARNING_LEAD_MS = 60_000

/**
 * レジクロ前最後のレベルのアナウンスを、レベル開始からこの時間だけ遅らせる。
 * 同じ瞬間に共有層がレベル開始の音声を鳴らすため、重ならないよう後に回す。
 * 通常はレベルアップ音(約 2.3 秒)、ブレイク明けはブレイク終了の音声(約 3.9 秒)が鳴る
 */
const LATE_REG_LAST_LEVEL_DELAY_MS = 2_500
const LATE_REG_LAST_LEVEL_AFTER_BREAK_DELAY_MS = 4_200

/** レイトレジ締切マーカーの直前にある最後のブラインドレベルの位置。マーカーが無ければ null */
function lastLevelBeforeLateRegClose(structure: StructureItem[]): number | null {
  const markerIndex = structure.findIndex((item) => item.kind === 'lateRegClose')
  for (let i = markerIndex - 1; i >= 0; i--) {
    if (structure[i].kind === 'blind') return i
  }
  return null
}

/**
 * Round2 独自のタイミングで鳴らすアナウンス。どの画面の局面でも鳴らせるよう Root で使う。
 *
 * - 終了 1 分前の予告(レベル / ブレイクごとに 1 回)。ブラインドレベルはレベル終了の予告、
 *   ブレイクは「まもなく再開」の案内を鳴らす。
 *   共有層の 10 秒前予告音(sounds/level-up-warning.ogg)は素材を置かないことで無効化している
 * - レジクロ前の最後のレベルが始まったときの告知。締切に気づかずスロープレイするのを防ぐ目的
 *
 * どちらもリロード直後にすでに条件を満たしている場合は鳴らさない(進行中の変化だけを拾う)
 */
export function useRound2Announcements(
  session: SessionState,
  structure: StructureItem[],
  now: number,
): void {
  const resolved = resolveTimer(session.timer, structure, now)
  const levelIndex = resolved.status === 'running' ? resolved.levelIndex : null
  /** 終了 1 分前の区間にいれば鳴らす音声。区間外は null */
  const warningSound = (() => {
    if (resolved.status !== 'running') return null
    const remaining = remainingMs(resolved, structure, now)
    if (remaining <= 0 || remaining > END_WARNING_LEAD_MS) return null
    const kind = structure[resolved.levelIndex]?.kind
    if (kind === 'blind') return LEVEL_UP_WARNING_SOUND
    if (kind === 'break') return RESUME_SOON_SOUND
    return null
  })()

  // ---- 終了 1 分前(レベル終了の予告 / ブレイクのまもなく再開) ----
  // undefined = 初回(リロード直後)。初回に予告区間内なら鳴らさずに再生済み扱いにする
  const warnedLevelRef = useRef<number | null | undefined>(undefined)
  useEffect(() => {
    const isFirst = warnedLevelRef.current === undefined
    if (warningSound === null || levelIndex === null) {
      if (isFirst) warnedLevelRef.current = null
      return
    }
    if (warnedLevelRef.current === levelIndex) return
    warnedLevelRef.current = levelIndex
    if (!isFirst) playRound2Sound(warningSound)
  }, [warningSound, levelIndex])

  // ---- レジクロ前の最後のレベルの開始 ----
  const lastLevel = lastLevelBeforeLateRegClose(structure)
  // 最後のレベルがブレイク明け(直前の項目がブレイク)なら、共有層はブレイク終了の音声を鳴らす
  const lastLevelAfterBreak = lastLevel !== null && structure[lastLevel - 1]?.kind === 'break'
  // undefined = 初回(リロード直後)。開始前(waiting)は -1 として扱い、開始直後の最初のレベルが
  // 最後のレベルに当たる場合も鳴らす
  const prevLevelRef = useRef<number | undefined>(undefined)
  // 一時停止中もレベルは変わっていないため同じ位置として扱う(開始直後の一時停止で告知を取り消さない)
  const currentLevel =
    resolved.status === 'waiting'
      ? -1
      : resolved.status === 'running' || resolved.status === 'paused'
        ? resolved.levelIndex
        : undefined
  useEffect(() => {
    const prev = prevLevelRef.current
    if (currentLevel !== undefined) prevLevelRef.current = currentLevel
    if (
      prev === undefined ||
      currentLevel === undefined ||
      lastLevel === null ||
      currentLevel !== lastLevel ||
      prev >= currentLevel
    ) {
      return
    }
    const timeout = window.setTimeout(
      () => playRound2Sound(LATE_REG_LAST_LEVEL_SOUND),
      lastLevelAfterBreak ? LATE_REG_LAST_LEVEL_AFTER_BREAK_DELAY_MS : LATE_REG_LAST_LEVEL_DELAY_MS,
    )
    return () => clearTimeout(timeout)
  }, [currentLevel, lastLevel, lastLevelAfterBreak])
}
