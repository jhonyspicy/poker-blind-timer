import type { BlindLevel, BreakItem, LateRegCloseItem, TournamentConfig } from './types'

/** base を渡すとその値を引き継ぐ(エディタで直近レベルを初期値にするため) */
export function createBlindLevel(base?: BlindLevel): BlindLevel {
  return base ? { ...base } : { kind: 'blind', sb: 100, bb: 200, ante: 200, durationMinutes: 20 }
}

export function createBreak(): BreakItem {
  return { kind: 'break', durationMinutes: 10 }
}

export function createLateRegClose(): LateRegCloseItem {
  return { kind: 'lateRegClose' }
}

export function createNewConfig(now: number = Date.now()): TournamentConfig {
  return {
    id: crypto.randomUUID(),
    title: '',
    prizes: [],
    structure: [createBlindLevel()],
    createdAt: now,
    updatedAt: now,
  }
}

/** タイマーとして成立しない設定を保存前に検出する。エラーが無ければ空配列 */
export function validateConfig(config: TournamentConfig): string[] {
  const errors: string[] = []

  const blinds = config.structure.filter((item) => item.kind === 'blind')
  if (blinds.length === 0) {
    errors.push('ブラインドレベルを 1 つ以上追加してください')
  }

  const lateRegCloses = config.structure.filter((item) => item.kind === 'lateRegClose')
  if (lateRegCloses.length > 1) {
    errors.push('レイトレジストレーション締め切りは 1 つまでです')
  }

  config.structure.forEach((item, index) => {
    if (item.kind === 'lateRegClose') return
    const label = item.kind === 'break' ? `${index + 1} 番目(ブレイク)` : `${index + 1} 番目`
    if (!Number.isFinite(item.durationMinutes) || item.durationMinutes <= 0) {
      errors.push(`${label}: 継続時間は正の数にしてください`)
    }
    if (item.kind === 'blind') {
      if (!Number.isFinite(item.sb) || item.sb <= 0) {
        errors.push(`${label}: SB は正の数にしてください`)
      }
      if (!Number.isFinite(item.bb) || item.bb <= 0) {
        errors.push(`${label}: BB は正の数にしてください`)
      }
      if (!Number.isFinite(item.ante) || item.ante < 0) {
        errors.push(`${label}: Ante は 0 以上にしてください`)
      }
    }
  })

  return errors
}
