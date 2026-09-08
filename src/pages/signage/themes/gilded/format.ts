import { formatBlind } from '../../../../domain/format'

/** ANTE 0 は設定なしとして em ダッシュで表示する(デザインモック準拠) */
export function formatAnte(ante: number): string {
  return ante > 0 ? formatBlind(ante) : '—'
}
