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

async function preloadOne(store: Cache | null, url: string): Promise<void> {
  if (store) {
    const cached = await store.match(url)
    if (cached) {
      await registerBlob(url, cached)
      void revalidate(store, url, cached)
      return
    }
  }
  try {
    const res = await fetch(url)
    if (!res.ok) {
      cache.set(url, null)
      return
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
  } catch {
    /* ネットワークエラー時は未取得のまま(再生時に元 URL へフォールバック) */
  }
}

/** テーマの全素材のダウンロードを開始する(同一テーマの多重呼び出しは無視)。完了を待つ必要はない */
export function preloadSignageAssets(theme: ThemeId): void {
  if (startedThemes.has(theme)) return
  startedThemes.add(theme)
  // 長時間表示のサイネージで素材と IndexedDB がブラウザの容量整理で消されないよう永続化を求める
  void navigator.storage?.persist?.().catch(() => {
    /* 非対応・拒否でも動作に影響しない */
  })
  void (async () => {
    const store = await openAssetCache()
    await Promise.all(assetPaths(theme).map((url) => preloadOne(store, url)))
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
