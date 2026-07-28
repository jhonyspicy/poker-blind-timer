import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionState, TournamentConfig } from '../domain/types'
import {
  clearSession,
  deleteConfig,
  getConfig,
  listConfigs,
  loadSession,
  resetDBForTesting,
  saveConfig,
  saveSession,
} from './db'

function makeConfig(id: string, updatedAt: number): TournamentConfig {
  return {
    id,
    shopName: 'Test Shop',
    title: 'Test Tournament',
    prizes: [{ place: 1, description: '¥10,000' }],
    startingStack: 25000,
    addonEnabled: true,
    addonChip: 30000,
    structure: [{ kind: 'blind', sb: 100, bb: 200, ante: 200, durationMinutes: 20 }],
    lateRegEndIndex: 0,
    createdAt: updatedAt,
    updatedAt,
  }
}

beforeEach(() => {
  // 各テストを空の IndexedDB から始める
  globalThis.indexedDB = new IDBFactory()
  resetDBForTesting()
})

describe('configs ストア', () => {
  it('保存した設定を読み込める', async () => {
    const config = makeConfig('a', 1000)
    await saveConfig(config)
    expect(await getConfig('a')).toEqual(config)
  })

  it('一覧は更新日時の新しい順で返る', async () => {
    await saveConfig(makeConfig('old', 1000))
    await saveConfig(makeConfig('new', 2000))
    const list = await listConfigs()
    expect(list.map((c) => c.id)).toEqual(['new', 'old'])
  })

  it('同じ id への保存は上書きになる', async () => {
    await saveConfig(makeConfig('a', 1000))
    await saveConfig({ ...makeConfig('a', 2000), title: 'Updated' })
    const list = await listConfigs()
    expect(list).toHaveLength(1)
    expect(list[0].title).toBe('Updated')
  })

  it('削除すると一覧から消える', async () => {
    await saveConfig(makeConfig('a', 1000))
    await deleteConfig('a')
    expect(await listConfigs()).toEqual([])
    expect(await getConfig('a')).toBeUndefined()
  })
})

describe('session ストア', () => {
  const session: SessionState = {
    configId: 'a',
    timer: { status: 'running', levelIndex: 0, levelStartedAt: 1_700_000_000_000 },
    histories: [
      { id: 1, command: 'entry', chip: 25000 },
      { id: 2, command: 'bust' },
    ],
    nextHistoryId: 3,
    titleOverride: null,
  }

  it('保存したスナップショットを復元できる', async () => {
    await saveSession(session)
    expect(await loadSession()).toEqual(session)
  })

  it('保存は常に 1 件で上書きされる', async () => {
    await saveSession(session)
    const paused: SessionState = {
      ...session,
      timer: { status: 'paused', levelIndex: 0, elapsedInLevelMs: 60_000 },
    }
    await saveSession(paused)
    expect(await loadSession()).toEqual(paused)
  })

  it('クリアすると復元されない', async () => {
    await saveSession(session)
    await clearSession()
    expect(await loadSession()).toBeUndefined()
  })
})
