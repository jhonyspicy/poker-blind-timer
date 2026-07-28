import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SessionState, TournamentConfig } from '../domain/types'

interface BlindTimerDB extends DBSchema {
  configs: {
    key: string
    value: TournamentConfig
  }
  session: {
    key: string
    value: SessionState
  }
}

const DB_NAME = 'poker-blind-timer'
const DB_VERSION = 1

/** session ストアは進行中トーナメント 1 件のみ保持する固定キー */
const SESSION_KEY = 'current'

let dbPromise: Promise<IDBPDatabase<BlindTimerDB>> | null = null

function getDB(): Promise<IDBPDatabase<BlindTimerDB>> {
  dbPromise ??= openDB<BlindTimerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('configs')) {
        db.createObjectStore('configs', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('session')) {
        db.createObjectStore('session')
      }
    },
  })
  return dbPromise
}

/** テスト用: 接続キャッシュを破棄する */
export function resetDBForTesting(): void {
  dbPromise = null
}

export async function saveConfig(config: TournamentConfig): Promise<void> {
  const db = await getDB()
  await db.put('configs', config)
}

export async function getConfig(id: string): Promise<TournamentConfig | undefined> {
  const db = await getDB()
  return db.get('configs', id)
}

/** 更新日時の新しい順で返す */
export async function listConfigs(): Promise<TournamentConfig[]> {
  const db = await getDB()
  const all = await db.getAll('configs')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteConfig(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('configs', id)
}

export async function saveSession(state: SessionState): Promise<void> {
  const db = await getDB()
  await db.put('session', state, SESSION_KEY)
}

export async function loadSession(): Promise<SessionState | undefined> {
  const db = await getDB()
  return db.get('session', SESSION_KEY)
}

export async function clearSession(): Promise<void> {
  const db = await getDB()
  await db.delete('session', SESSION_KEY)
}
