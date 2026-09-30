import { formatBlind } from '../../../../domain/format'
import { assetUrl, themeAssetPath } from '../../preload'

/** ANTE 0 は設定なしとして em ダッシュで表示する */
export function formatAnte(ante: number): string {
  return ante > 0 ? formatBlind(ante) : '—'
}

/** 順位の英語序数(モック準拠の大文字表記: 1ST / 2ND / 3RD / 4TH …) */
export function rankSuffix(place: number): string {
  if (place % 10 === 1 && place % 100 !== 11) return 'ST'
  if (place % 10 === 2 && place % 100 !== 12) return 'ND'
  if (place % 10 === 3 && place % 100 !== 13) return 'RD'
  return 'TH'
}

/** Round2 の素材 URL。素材なし(404)と判明していれば null */
export function round2AssetUrl(relativePath: string): string | null {
  return assetUrl(themeAssetPath('round2', relativePath))
}

/**
 * Round2 独自の音声を再生する(共有層の効果音とタイミングが異なるもの)。
 * 素材なし(404)・自動再生制限時は無音でスキップする
 */
export function playRound2Sound(relativePath: string): void {
  const url = round2AssetUrl(relativePath)
  if (url === null) return
  void new Audio(url).play().catch(() => {
    /* 素材なし・自動再生制限時は何もしない */
  })
}

/**
 * プライズ文(自由テキスト)の「30,000PT」のような数値 + 単位を分解する。
 * 数値を大きく・単位を小さく表示するため(モック準拠)。該当しなければ null
 */
export function splitAmount(text: string): { amount: string; unit: string } | null {
  const match = /^([\d,.]+)\s*([A-Za-z]+)$/.exec(text.trim())
  return match ? { amount: match[1], unit: match[2] } : null
}
