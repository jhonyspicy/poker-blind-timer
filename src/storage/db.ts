import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { RoomInfo, SessionState, TournamentConfig } from '../domain/types'

interface BlindTimerDB extends DBSchema {
  configs: {
    key: string
    value: TournamentConfig
  }
  session: {
    key: string
    value: SessionState
  }
  room: {
    key: string
    value: RoomInfo
  }
}

const DB_NAME = 'poker-blind-timer'
const DB_VERSION = 4

/** session / room ストアは 1 件のみ保持する固定キー */
const SESSION_KEY = 'current'
const ROOM_KEY = 'current'

/** v2 まで設定に存在した廃止済みフィールドを含む形。マイグレーション専用 */
type LegacyConfig = TournamentConfig & {
  lateRegEndIndex?: number | null
  startingStack?: number
  addonEnabled?: boolean
  addonChip?: number
}

let dbPromise: Promise<IDBPDatabase<BlindTimerDB>> | null = null

function getDB(): Promise<IDBPDatabase<BlindTimerDB>> {
  dbPromise ??= openDB<BlindTimerDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, tx) {
      if (!db.objectStoreNames.contains('configs')) {
        db.createObjectStore('configs', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('session')) {
        db.createObjectStore('session')
      }
      if (!db.objectStoreNames.contains('room')) {
        db.createObjectStore('room')
        if (oldVersion >= 1) {
          // v1 では店名を設定ごと(shopName)に持っていたため、最終更新の設定から引き継ぐ
          void tx
            .objectStore('configs')
            .getAll()
            .then((configs) => {
              const legacy = (configs as (TournamentConfig & { shopName?: string })[])
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .find((c) => c.shopName)
              if (legacy?.shopName) {
                void tx.objectStore('room').put({ name: legacy.shopName }, ROOM_KEY)
              }
            })
        }
      }
      if (oldVersion >= 1 && oldVersion < 4) {
        // v3: lateRegEndIndex(位置番号)を lateRegClose マーカー項目へ変換し、
        //     廃止したスターティングスタック / アドオン設定を取り除く
        // v4: セッションの titleOverride を廃止し、channelId を追加する
        // セッションへの書き込みが競合しないよう、変換をまとめて 1 回の put で行う
        const configsStore = tx.objectStore('configs')
        const sessionStore = tx.objectStore('session')
        void configsStore.getAll().then((storedConfigs) => {
          /** v3 でマーカーを挿入した位置(configId → 挿入 index) */
          const insertedAt = new Map<string, number>()
          if (oldVersion < 3) {
            for (const legacy of storedConfigs as LegacyConfig[]) {
              const { lateRegEndIndex, startingStack, addonEnabled, addonChip, ...config } = legacy
              void startingStack
              void addonEnabled
              void addonChip
              const structure = [...config.structure]
              if (
                typeof lateRegEndIndex === 'number' &&
                lateRegEndIndex >= 0 &&
                lateRegEndIndex < structure.length &&
                !structure.some((item) => item.kind === 'lateRegClose')
              ) {
                insertedAt.set(config.id, lateRegEndIndex + 1)
                structure.splice(lateRegEndIndex + 1, 0, { kind: 'lateRegClose' })
              }
              void configsStore.put({ ...config, structure })
            }
          }
          void sessionStore.get(SESSION_KEY).then((storedSession) => {
            if (!storedSession) return
            const { titleOverride, ...session } = storedSession as SessionState & {
              titleOverride?: string | null
            }
            void titleOverride
            let timer = session.timer
            // v3: マーカー挿入で structure の index がずれた分、進行中セッションの
            // levelIndex を追従させる(復元時にレベルが飛ぶ/戻るのを防ぐ)
            const at = insertedAt.get(session.configId)
            if (
              at !== undefined &&
              (timer.status === 'running' || timer.status === 'paused') &&
              timer.levelIndex >= at
            ) {
              timer = { ...timer, levelIndex: timer.levelIndex + 1 }
            }
            void sessionStore.put(
              { ...session, timer, channelId: session.channelId ?? '' },
              SESSION_KEY,
            )
          })
        })
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

export async function saveRoom(room: RoomInfo): Promise<void> {
  const db = await getDB()
  await db.put('room', room, ROOM_KEY)
}

export async function loadRoom(): Promise<RoomInfo | undefined> {
  const db = await getDB()
  return db.get('room', ROOM_KEY)
}
