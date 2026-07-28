import type { BlindLevel, BreakItem, TournamentConfig } from './types'

export function createBlindLevel(): BlindLevel {
  return { kind: 'blind', sb: 100, bb: 200, ante: 0, durationMinutes: 20 }
}

export function createBreak(): BreakItem {
  return { kind: 'break', durationMinutes: 10 }
}

export function createNewConfig(now: number = Date.now()): TournamentConfig {
  return {
    id: crypto.randomUUID(),
    shopName: '',
    title: '',
    prizes: [],
    startingStack: 25000,
    addonEnabled: false,
    addonChip: 25000,
    structure: [createBlindLevel()],
    lateRegEndIndex: null,
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

  config.structure.forEach((item, index) => {
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

  if (!Number.isFinite(config.startingStack) || config.startingStack <= 0) {
    errors.push('スターティングスタックは正の数にしてください')
  }
  if (config.addonEnabled && (!Number.isFinite(config.addonChip) || config.addonChip <= 0)) {
    errors.push('アドオンのチップ量は正の数にしてください')
  }
  if (
    config.lateRegEndIndex !== null &&
    (config.lateRegEndIndex < 0 || config.lateRegEndIndex >= config.structure.length)
  ) {
    errors.push('レイトレジストレーション締め切り位置が不正です')
  }

  return errors
}
