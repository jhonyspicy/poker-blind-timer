/**
 * サイネージで使う演出素材(動画・効果音・画像)の先読み。
 * サイネージ表示開始時に全素材をダウンロードして blob URL で保持し、
 * 再生時のダウンロード待ち(特に動画の数十 MB)を無くす。
 * 404 の素材は「無し」として記録し、再生側が即スキップできるようにする
 */

const VIDEO_EVENTS = ['tournament-start', 'in-the-money', 'heads-up', 'champion'] as const
const SOUND_EVENTS = ['level-up-warning', 'level-up', 'break-start', 'pause', 'resume'] as const
const IMAGE_PATHS = ['images/champion.png'] as const

/** 元 URL → blob URL(取得成功) / null(404 = 素材なし) */
const cache = new Map<string, string | null>()
let started = false

function assetPaths(): string[] {
  const base = import.meta.env.BASE_URL
  return [
    ...VIDEO_EVENTS.flatMap((event) => [
      `${base}videos/${event}.webm`,
      `${base}videos/${event}.ogg`,
    ]),
    ...SOUND_EVENTS.map((event) => `${base}sounds/${event}.ogg`),
    ...IMAGE_PATHS.map((path) => `${base}${path}`),
  ]
}

/** 全素材のダウンロードを開始する(多重呼び出しは無視)。完了を待つ必要はない */
export function preloadSignageAssets(): void {
  if (started) return
  started = true
  for (const url of assetPaths()) {
    void fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          cache.set(url, null)
          return
        }
        const blob = await res.blob()
        cache.set(url, URL.createObjectURL(blob))
      })
      .catch(() => {
        /* ネットワークエラー時は未取得のまま(再生時に元 URL へフォールバック) */
      })
  }
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
