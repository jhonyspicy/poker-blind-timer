import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SessionState, TournamentConfig } from '../domain/types'
import {
  clearSession,
  deleteConfig,
  getConfig,
  listConfigs,
  loadRoom,
  loadSession,
  resetDBForTesting,
  saveConfig,
  saveRoom,
  saveSession,
} from './db'

function makeConfig(id: string, updatedAt: number): TournamentConfig {
  return {
    id,
    title: 'Test Tournament',
    prizes: [{ place: 1, description: '¥10,000' }],
    structure: [{ kind: 'blind', sb: 100, bb: 200, ante: 200, durationMinutes: 20 }],
    createdAt: updatedAt,
    updatedAt,
  }
}

/** v1/v2 スキーマ相当の設定データを作る(廃止済みフィールドを含む) */
function makeLegacyConfig(id: string, updatedAt: number, lateRegEndIndex: number | null) {
  return {
    ...makeConfig(id, updatedAt),
    shopName: 'Legacy Shop',
    startingStack: 25000,
    addonEnabled: true,
    addonChip: 30000,
    lateRegEndIndex,
  }
}

/** 旧バージョンのスキーマで DB を直接作る(マイグレーションテスト用) */
function createLegacyDB(
  version: number,
  seed: (db: IDBDatabase, tx: IDBTransaction) => void,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const req = indexedDB.open('poker-blind-timer', version)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('configs', { keyPath: 'id' })
      db.createObjectStore('session')
      if (version >= 2) db.createObjectStore('room')
      seed(db, req.transaction!)
    }
    req.onsuccess = () => {
      req.result.close()
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
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
    channelId: 'test-channel-id',
    timer: { status: 'running', levelIndex: 0, levelStartedAt: 1_700_000_000_000 },
    histories: [
      { id: 1, command: 'entry', chip: 25000 },
      { id: 2, command: 'bust' },
    ],
    nextHistoryId: 3,
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

describe('room ストア', () => {
  it('保存した店舗情報を読み込める', async () => {
    await saveRoom({ name: 'Black Spade' })
    expect(await loadRoom()).toEqual({ name: 'Black Spade' })
  })

  it('未保存なら undefined を返す', async () => {
    expect(await loadRoom()).toBeUndefined()
  })

  it('v1 の設定が持っていた shopName を店舗情報として引き継ぐ', async () => {
    await createLegacyDB(1, (_db, tx) => {
      tx.objectStore('configs').put({
        ...makeLegacyConfig('old', 1000, null),
        shopName: 'Old Shop',
      })
      tx.objectStore('configs').put(makeLegacyConfig('new', 2000, null))
    })
    // 最終更新の設定の店名が採用される
    expect(await loadRoom()).toEqual({ name: 'Legacy Shop' })
  })
})

describe('v3 マイグレーション(設定のスリム化)', () => {
  it('lateRegEndIndex をマーカー項目へ変換し、廃止フィールドを取り除く', async () => {
    await createLegacyDB(2, (_db, tx) => {
      // 締め切り = index 0 の項目終了時 → マーカーは index 1 に入る
      tx.objectStore('configs').put(makeLegacyConfig('a', 1000, 0))
    })
    const config = await getConfig('a')
    expect(config?.structure).toEqual([
      { kind: 'blind', sb: 100, bb: 200, ante: 200, durationMinutes: 20 },
      { kind: 'lateRegClose' },
    ])
    expect(config).not.toHaveProperty('lateRegEndIndex')
    expect(config).not.toHaveProperty('startingStack')
    expect(config).not.toHaveProperty('addonEnabled')
    expect(config).not.toHaveProperty('addonChip')
  })

  it('締め切りなし(null)の設定はマーカーを挿入しない', async () => {
    await createLegacyDB(2, (_db, tx) => {
      tx.objectStore('configs').put(makeLegacyConfig('a', 1000, null))
    })
    const config = await getConfig('a')
    expect(config?.structure).toEqual([
      { kind: 'blind', sb: 100, bb: 200, ante: 200, durationMinutes: 20 },
    ])
  })

  it('マーカー挿入位置以降にいる進行中セッションの levelIndex を追従させる', async () => {
    const structure = [
      { kind: 'blind', sb: 100, bb: 200, ante: 0, durationMinutes: 20 },
      { kind: 'blind', sb: 200, bb: 400, ante: 0, durationMinutes: 20 },
    ] as const
    await createLegacyDB(2, (_db, tx) => {
      // 締め切り = index 0 終了時 → マーカーが index 1 に入り、旧 index 1 は 2 になる
      tx.objectStore('configs').put({
        ...makeLegacyConfig('a', 1000, 0),
        structure: [...structure],
      })
      tx.objectStore('session').put(
        {
          configId: 'a',
          timer: { status: 'running', levelIndex: 1, levelStartedAt: 1000 },
          histories: [],
          nextHistoryId: 1,
          titleOverride: null,
        },
        'current',
      )
    })
    const session = await loadSession()
    expect(session?.timer).toEqual({ status: 'running', levelIndex: 2, levelStartedAt: 1000 })
  })

  it('v4: セッションの titleOverride を取り除き channelId を補う', async () => {
    await createLegacyDB(3, (_db, tx) => {
      tx.objectStore('configs').put(makeConfig('a', 1000))
      tx.objectStore('session').put(
        {
          configId: 'a',
          timer: { status: 'paused', levelIndex: 0, elapsedInLevelMs: 60_000 },
          histories: [],
          nextHistoryId: 1,
          titleOverride: '上書きタイトル',
        },
        'current',
      )
    })
    const session = await loadSession()
    expect(session).not.toHaveProperty('titleOverride')
    expect(session?.channelId).toBe('')
    expect(session?.timer).toEqual({ status: 'paused', levelIndex: 0, elapsedInLevelMs: 60_000 })
  })
})
