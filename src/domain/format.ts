/** 残り時間の表示。1 時間未満は mm:ss、1 時間以上は h:mm:ss */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const seconds = totalSeconds % 60
  const minutes = Math.floor(totalSeconds / 60) % 60
  const hours = Math.floor(totalSeconds / 3600)
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatChips(value: number): string {
  return value.toLocaleString('ja-JP')
}

/** 6 桁(10 万)以上は K 表記に短縮する(例: 100,000 → 100K)。ブラインドの桁あふれ対策 */
export function formatBlind(value: number): string {
  if (value < 100_000) return formatChips(value)
  return `${(value / 1000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}K`
}
