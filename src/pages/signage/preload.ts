import type { ThemeId } from '../../domain/theme'

/**
 * サイネージで使う演出素材(動画・効果音・画像)の先読み。
 * サイネージ表示開始時に全素材をダウンロードして blob URL で保持し、
 * 再生時のダウンロード待ち(特に動画の数十 MB)を無くす。
 * ダウンロードした素材は Cache Storage へ永続化し、リロード時は
 * ネットワークを待たずにディスクから即復元する(復元後に ETag で
 * 再検証し、更新された素材は次回リロードから反映する)。
 * 404 の素材は「無し」として記録し、再生側が即スキップできるようにする。
 * 素材はテーマ別ディレクトリ(public/themes/<テーマ名>/)から解決する
 */

const VIDEO_EVENTS = ['tournament-start', 'in-the-money', 'heads-up', 'champion'] as const
const SOUND_EVENTS = ['level-up-warning', 'level-up', 'break-start', 'pause', 'resume'] as const
const IMAGE_PATHS = ['images/champion.png'] as const

/** Cache Storage のキャッシュ名。保存形式を変えるときは版を上げて古い側を破棄する */
const CACHE_NAME = 'signage-assets-v1'

/** テーマ素材の URL を組み立てる。素材参照はすべてこの関数を通しパス規約を 1 箇所に閉じる */
export function themeAssetPath(theme: ThemeId, relativePath: string): string {
  return `${import.meta.env.BASE_URL}themes/${theme}/${relativePath}`
}

/** 元 URL → blob URL(取得成功) / null(404 = 素材なし) */
const cache = new Map<string, string | null>()
const startedThemes = new Set<ThemeId>()

export interface StartAssetPreloadStatus {
  total: number
  resolved: number
  ready: boolean
}

interface ThemeStartAssetState {
  requiredUrls: Set<string>
  total: number
  resolved: number
  ready: boolean
  listeners: Set<(status: StartAssetPreloadStatus) => void>
}

const startAssetStates = new Map<ThemeId, ThemeStartAssetState>()

function assetPaths(theme: ThemeId): string[] {
  return [
    ...VIDEO_EVENTS.flatMap((event) => [
      themeAssetPath(theme, `videos/${event}.webm`),
      themeAssetPath(theme, `videos/${event}.ogg`),
    ]),
    ...SOUND_EVENTS.map((event) => themeAssetPath(theme, `sounds/${event}.ogg`)),
    ...IMAGE_PATHS.map((path) => themeAssetPath(theme, path)),
  ]
}

function startAssetPaths(theme: ThemeId): string[] {
  const base = themeAssetPath(theme, 'videos/tournament-start')
  return [`${base}.webm`, `${base}.ogg`]
}

function ensureStartAssetState(theme: ThemeId): ThemeStartAssetState {
  const current = startAssetStates.get(theme)
  if (current) return current
  const requiredUrls = new Set(startAssetPaths(theme))
  const created: ThemeStartAssetState = {
    requiredUrls,
    total: requiredUrls.size,
    resolved: 0,
    ready: false,
    listeners: new Set(),
  }
  startAssetStates.set(theme, created)
  return created
}

function snapshotStartAssetStatus(state: ThemeStartAssetState): StartAssetPreloadStatus {
  return { total: state.total, resolved: state.resolved, ready: state.ready }
}

function notifyStartAssetStatus(state: ThemeStartAssetState): void {
  const status = snapshotStartAssetStatus(state)
  state.listeners.forEach((listener) => listener(status))
}

function markStartAssetResolved(theme: ThemeId, url: string, result: PreloadResult): void {
  const state = ensureStartAssetState(theme)
  if (!state.requiredUrls.has(url) || state.ready) return
  if (result !== 'loaded') {
    // 開始演出だけは途中再生によるカクつきを避けるため、取得失敗時も
    // 「再生しない」扱いに確定させ、元 URL へのストリーミング再生へ戻さない
    cache.set(url, null)
  }
  state.resolved += 1
  state.ready = state.resolved >= state.total
  notifyStartAssetStatus(state)
}

export function getStartAssetPreloadStatus(theme: ThemeId): StartAssetPreloadStatus {
  return snapshotStartAssetStatus(ensureStartAssetState(theme))
}

export function subscribeStartAssetPreloadStatus(
  theme: ThemeId,
  listener: (status: StartAssetPreloadStatus) => void,
): () => void {
  const state = ensureStartAssetState(theme)
  state.listeners.add(listener)
  listener(snapshotStartAssetStatus(state))
  return () => {
    state.listeners.delete(listener)
  }
}

/** Cache Storage が使えない環境(非セキュアコンテキスト等)では null を返し、従来のメモリのみ動作にフォールバックする */
async function openAssetCache(): Promise<Cache | null> {
  if (!('caches' in globalThis)) return null
  try {
    return await caches.open(CACHE_NAME)
  } catch {
    return null
  }
}

/** blob URL を作ってメモリキャッシュへ登録する */
async function registerBlob(url: string, res: Response): Promise<void> {
  const blob = await res.blob()
  cache.set(url, URL.createObjectURL(blob))
}

/**
 * ディスクキャッシュ復元後のバックグラウンド再検証。
 * ETag が一致すれば 304 で本体は流れない。素材が更新されていたら
 * ディスク側だけ差し替える(表示中の blob は触らず、次回リロードから反映)
 */
async function revalidate(store: Cache, url: string, cached: Response): Promise<void> {
  const etag = cached.headers.get('etag')
  try {
    const res = await fetch(url, etag ? { headers: { 'If-None-Match': etag } } : undefined)
    if (res.status === 304) return
    if (res.ok) await store.put(url, res)
    // 素材が撤去された場合はディスクから消し、次回リロードで「無し」と判定させる
    else if (res.status === 404) await store.delete(url)
  } catch {
    /* オフライン時はディスクキャッシュを維持する */
  }
}

type PreloadResult = 'loaded' | 'missing' | 'failed'

async function preloadOne(store: Cache | null, url: string): Promise<PreloadResult> {
  if (store) {
    const cached = await store.match(url)
    if (cached) {
      await registerBlob(url, cached)
      void revalidate(store, url, cached)
      return 'loaded'
    }
  }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      cache.set(url, null)
      return 'missing'
    }
    // put は body を消費するため、blob 化の前に複製を渡す
    if (store) {
      try {
        await store.put(url, res.clone())
      } catch {
        /* 容量不足等で保存できなくても表示用の blob 化は続行する */
      }
    }
    await registerBlob(url, res)
    return 'loaded'
  } catch {
    /* ネットワークエラー時は未取得のまま(再生時に元 URL へフォールバック) */
    return 'failed'
  }
}

/** テーマの全素材のダウンロードを開始する(同一テーマの多重呼び出しは無視)。完了を待つ必要はない */
export function preloadSignageAssets(theme: ThemeId): void {
  ensureStartAssetState(theme)
  if (startedThemes.has(theme)) return
  startedThemes.add(theme)
  // 長時間表示のサイネージで素材と IndexedDB がブラウザの容量整理で消されないよう永続化を求める
  void globalThis.navigator?.storage?.persist?.().catch(() => {
    /* 非対応・拒否でも動作に影響しない */
  })
  void (async () => {
    const store = await openAssetCache()
    await Promise.all(
      assetPaths(theme).map(async (url) => {
        const result = await preloadOne(store, url)
        markStartAssetResolved(theme, url, result)
      }),
    )
  })()
}

/**
 * 素材の再生用 URL を返す。
 * 先読み済みなら blob URL、404 と判明していれば null(=素材なし)、
 * ダウンロード中・未開始なら元の URL をそのまま返す
 */
export function assetUrl(url: string): string | null {
  const hit = cache.get(url)
  return hit === undefined ? url : hit
}

/** preload.ts の内部状態をテストごとに初期化する */
export function resetPreloadForTesting(): void {
  cache.clear()
  startedThemes.clear()
  startAssetStates.clear()
}
