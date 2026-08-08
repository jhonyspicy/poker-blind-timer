import { describe, expect, it } from 'vitest'
import {
  applyStructureUpdate,
  effectiveConfig,
  effectiveStructure,
  structuresEqual,
} from './structureUpdate'
import type { SessionState, StructureItem, TournamentConfig } from './types'

const MIN = 60_000
const T0 = 1_700_000_000_000

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

const config: TournamentConfig = {
  id: 'config-1',
  title: 'テスト',
  prizes: [],
  structure,
  createdAt: T0,
  updatedAt: T0,
}

function session(overrides?: Partial<SessionState>): SessionState {
  return {
    configId: config.id,
    channelId: 'ch',
    timer: { status: 'running', levelIndex: 0, levelStartedAt: T0 },
    histories: [],
    nextHistoryId: 1,
    ...overrides,
  }
}

describe('applyStructureUpdate', () => {
  it('未来のみの変更は採用され structureOverride に入る', () => {
    // L1 進行中に L2 以降を変更する
    const incoming: StructureItem[] = [
      structure[0],
      blind(200, 400, 400, 15),
      { kind: 'break', durationMinutes: 5 },
      blind(300, 600, 600, 15),
      blind(400, 800, 800, 15),
    ]
    const next = applyStructureUpdate(session(), config, incoming, T0 + 5 * MIN)
    expect(next).not.toBeNull()
    expect(next?.structureOverride).toEqual(incoming)
  })

  it('進行中の項目に触れる変更は拒否される', () => {
    // L1 進行中に L1 の継続時間を変更する
    const incoming: StructureItem[] = [blind(100, 200, 200, 30), ...structure.slice(1)]
    expect(applyStructureUpdate(session(), config, incoming, T0 + 5 * MIN)).toBeNull()
  })

  it('通過済みの項目に触れる変更は拒否される', () => {
    // L2 進行中(25 分経過)に L1 を変更する
    const incoming: StructureItem[] = [blind(50, 100, 100, 20), ...structure.slice(1)]
    expect(applyStructureUpdate(session(), config, incoming, T0 + 25 * MIN)).toBeNull()
  })

  it('自動遷移との競合で拒否される(境界は適用時点の解決結果)', () => {
    // リモコンは L1 進行中の表示をもとに L2 を編集したが、適用時点では
    // すでに L2 へ自動遷移している(25 分経過)
    const incoming: StructureItem[] = [
      structure[0],
      blind(200, 400, 400, 30),
      ...structure.slice(2),
    ]
    expect(applyStructureUpdate(session(), config, incoming, T0 + 25 * MIN)).toBeNull()
  })

  it('一時停止中もプレフィックス一致で判定される', () => {
    const paused = session({ timer: { status: 'paused', levelIndex: 1, elapsedInLevelMs: MIN } })
    const touchesCurrent: StructureItem[] = [
      structure[0],
      blind(200, 400, 400, 30),
      ...structure.slice(2),
    ]
    expect(applyStructureUpdate(paused, config, touchesCurrent, T0)).toBeNull()
    const futureOnly: StructureItem[] = [
      structure[0],
      structure[1],
      { kind: 'break', durationMinutes: 15 },
      blind(300, 600, 600, 15),
    ]
    expect(applyStructureUpdate(paused, config, futureOnly, T0)?.structureOverride).toEqual(
      futureOnly,
    )
  })

  it('waiting 中は全項目を編集できる', () => {
    const waiting = session({ timer: { status: 'waiting' } })
    const incoming: StructureItem[] = [blind(50, 100, 0, 10)]
    expect(applyStructureUpdate(waiting, config, incoming, T0)?.structureOverride).toEqual(incoming)
  })

  it('finished では拒否される', () => {
    const finished = session({ timer: { status: 'finished' } })
    expect(applyStructureUpdate(finished, config, structure, T0)).toBeNull()
  })

  it('検証ルール違反(ブラインド 0 件・SB 非正・締切重複)は拒否される', () => {
    const waiting = session({ timer: { status: 'waiting' } })
    expect(
      applyStructureUpdate(waiting, config, [{ kind: 'break', durationMinutes: 10 }], T0),
    ).toBeNull()
    expect(applyStructureUpdate(waiting, config, [blind(0, 200, 200, 20)], T0)).toBeNull()
    expect(
      applyStructureUpdate(
        waiting,
        config,
        [blind(100, 200, 200, 20), { kind: 'lateRegClose' }, { kind: 'lateRegClose' }],
        T0,
      ),
    ).toBeNull()
  })

  it('現在項目まで届かない短いストラクチャーは拒否される', () => {
    // L2 進行中(25 分経過)に項目 1 つだけの全量が届いた場合
    const incoming: StructureItem[] = [structure[0]]
    expect(applyStructureUpdate(session(), config, incoming, T0 + 25 * MIN)).toBeNull()
  })

  it('2 回目の編集は前回の上書き(実効ストラクチャー)を基準に判定する', () => {
    const overridden = session({
      structureOverride: [structure[0], blind(200, 400, 400, 10), blind(300, 600, 600, 10)],
    })
    // 実効ストラクチャーでは 35 分経過時点で L3(levelIndex 2)進行中。
    // 元の config.structure 基準ならまだ L2 進行中のため、実効基準であることを確認できる
    const touchesCurrent: StructureItem[] = [
      structure[0],
      blind(200, 400, 400, 10),
      blind(300, 600, 600, 20),
    ]
    expect(applyStructureUpdate(overridden, config, touchesCurrent, T0 + 35 * MIN)).toBeNull()
    const futureOnly: StructureItem[] = [
      structure[0],
      blind(200, 400, 400, 10),
      blind(300, 600, 600, 10),
      blind(400, 800, 800, 10),
    ]
    expect(
      applyStructureUpdate(overridden, config, futureOnly, T0 + 35 * MIN)?.structureOverride,
    ).toEqual(futureOnly)
  })

  it('config と元セッションは変更しない', () => {
    const base = session()
    const incoming: StructureItem[] = [...structure, blind(400, 800, 800, 15)]
    const next = applyStructureUpdate(base, config, incoming, T0 + 5 * MIN)
    expect(next).not.toBe(base)
    expect(base.structureOverride).toBeUndefined()
    expect(config.structure).toEqual(structure)
  })
})

describe('effectiveStructure / effectiveConfig', () => {
  it('上書きが無ければ設定のストラクチャーを返す', () => {
    expect(effectiveStructure(session(), config)).toBe(structure)
    expect(effectiveConfig(session(), config)).toBe(config)
  })

  it('上書きがあれば structure だけ差し替えた config を返す', () => {
    const override: StructureItem[] = [blind(100, 200, 0, 10)]
    const overridden = session({ structureOverride: override })
    expect(effectiveStructure(overridden, config)).toBe(override)
    const cfg = effectiveConfig(overridden, config)
    expect(cfg.structure).toBe(override)
    expect(cfg.title).toBe(config.title)
    expect(config.structure).toBe(structure)
  })
})

describe('structuresEqual', () => {
  it('項目単位で一致を判定する', () => {
    expect(structuresEqual(structure, [...structure])).toBe(true)
    expect(structuresEqual(structure, structure.slice(0, 3))).toBe(false)
    expect(structuresEqual(structure, [blind(100, 200, 200, 21), ...structure.slice(1)])).toBe(
      false,
    )
    expect(
      structuresEqual([{ kind: 'break', durationMinutes: 10 }], [{ kind: 'lateRegClose' }]),
    ).toBe(false)
  })
})
