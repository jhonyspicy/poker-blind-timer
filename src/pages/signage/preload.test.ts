import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  assetUrl,
  getStartAssetPreloadStatus,
  preloadSignageAssets,
  resetPreloadForTesting,
  themeAssetPath,
} from './preload'

describe('preloadSignageAssets', () => {
  const deferredResponse = () => {
    let resolve!: (response: Response) => void
    const promise = new Promise<Response>((nextResolve) => {
      resolve = nextResolve
    })
    return { promise, resolve }
  }

  const waitForExpectation = async (assertion: () => void) => {
    for (let i = 0; i < 20; i++) {
      try {
        assertion()
        return
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }
    assertion()
  }

  beforeEach(() => {
    resetPreloadForTesting()
    vi.restoreAllMocks()
    Object.defineProperty(globalThis.URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:test'),
      configurable: true,
    })
    Object.defineProperty(globalThis, 'navigator', {
      value: { storage: { persist: vi.fn().mockResolvedValue(true) } },
      configurable: true,
    })
  })

  it('開始演出の素材が読み終われば他の素材より先に ready になる', async () => {
    const startVideoUrl = themeAssetPath('default', 'videos/tournament-start.webm')
    const startAudioUrl = themeAssetPath('default', 'videos/tournament-start.ogg')
    const startVideo = deferredResponse()
    const startAudio = deferredResponse()
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = String(input)
        if (url === startVideoUrl) return startVideo.promise
        if (url === startAudioUrl) return startAudio.promise
        return new Promise<Response>(() => {
          /* 開始演出以外の素材は未完了のままにする */
        })
      }),
    )

    preloadSignageAssets('default')
    expect(getStartAssetPreloadStatus('default')).toEqual({ total: 2, resolved: 0, ready: false })

    startVideo.resolve(new Response('video'))
    await waitForExpectation(() =>
      expect(getStartAssetPreloadStatus('default')).toEqual({ total: 2, resolved: 1, ready: false }),
    )

    startAudio.resolve(new Response('audio'))
    await waitForExpectation(() =>
      expect(getStartAssetPreloadStatus('default')).toEqual({ total: 2, resolved: 2, ready: true }),
    )
  })

  it('開始演出の取得に失敗した素材はストリーミング再生へ戻さずスキップ扱いにする', async () => {
    const startVideoUrl = themeAssetPath('default', 'videos/tournament-start.webm')
    const startAudioUrl = themeAssetPath('default', 'videos/tournament-start.ogg')
    vi.stubGlobal(
      'fetch',
      vi.fn((input: string | URL | Request) => {
        const url = String(input)
        if (url === startVideoUrl || url === startAudioUrl) {
          return Promise.reject(new Error('network error'))
        }
        return new Promise<Response>(() => {
          /* 開始演出以外の素材は未完了のままにする */
        })
      }),
    )

    preloadSignageAssets('default')

    await waitForExpectation(() =>
      expect(getStartAssetPreloadStatus('default')).toEqual({ total: 2, resolved: 2, ready: true }),
    )
    expect(assetUrl(startVideoUrl)).toBeNull()
    expect(assetUrl(startAudioUrl)).toBeNull()
  })
})
