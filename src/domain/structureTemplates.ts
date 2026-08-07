import type { StructureItem } from './types'

/**
 * ストラクチャーのテンプレート定義。
 * 店舗ごとに使用チップが異なり開始 SB がまちまちなため、ブラインドの絶対値は持たず
 * 「開始 SB に対する倍率」でレベルを生成する(SB_MULTIPLIERS 参照)
 */
export interface StructureTemplate {
  id: 'hyperTurbo' | 'turbo' | 'regular' | 'long'
  label: string
  /** 各ブラインドレベルの継続時間(分) */
  levelMinutes: number
  /** このレベル数ごとにブレイクを挿入する */
  breakEveryLevels: number
  breakMinutes: number
  /**
   * このレベル終了後にレイトレジ締め切りを置く。
   * レイトレジがレベルとレベルの間に単独で来るのは稀な運用のため、
   * 必ずブレイク直後に来るよう breakEveryLevels の倍数にすること
   */
  lateRegCloseAfterLevel: number
}

/**
 * 各レベルの SB = 開始 SB × 倍率。一般的なストラクチャーの上がり幅
 * (約 1.3〜2 倍刻み)に合わせ、チップで払える切りの良い数になる倍率を並べている
 */
const SB_MULTIPLIERS = [
  1, 2, 3, 4, 6, 8, 10, 15, 20, 30, 40, 60, 80, 100, 150, 200, 300, 400, 600, 800,
]

export const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  {
    id: 'hyperTurbo',
    label: 'ハイパーターボ',
    levelMinutes: 5,
    breakEveryLevels: 8,
    breakMinutes: 5,
    lateRegCloseAfterLevel: 8,
  },
  {
    id: 'turbo',
    label: 'ターボ',
    levelMinutes: 10,
    breakEveryLevels: 6,
    breakMinutes: 10,
    lateRegCloseAfterLevel: 6,
  },
  {
    id: 'regular',
    label: 'レギュラー',
    levelMinutes: 15,
    breakEveryLevels: 4,
    breakMinutes: 10,
    lateRegCloseAfterLevel: 8,
  },
  {
    id: 'long',
    label: 'ロング',
    levelMinutes: 20,
    breakEveryLevels: 4,
    breakMinutes: 15,
    lateRegCloseAfterLevel: 8,
  },
]

/** テンプレートと開始 SB からストラクチャー全体を生成する。BB は SB×2、Ante は BB と同値 */
export function buildTemplateStructure(
  template: StructureTemplate,
  startingSb: number,
): StructureItem[] {
  const items: StructureItem[] = []
  SB_MULTIPLIERS.forEach((multiplier, index) => {
    const levelNumber = index + 1
    const sb = startingSb * multiplier
    items.push({
      kind: 'blind',
      sb,
      bb: sb * 2,
      ante: sb * 2,
      durationMinutes: template.levelMinutes,
    })
    // 最終レベルの後にブレイクを置いても意味がないため除外する
    const isLastLevel = levelNumber === SB_MULTIPLIERS.length
    if (!isLastLevel && levelNumber % template.breakEveryLevels === 0) {
      items.push({ kind: 'break', durationMinutes: template.breakMinutes })
    }
    // レイトレジはブレイク中も受け付ける運用が一般的なため、ブレイクの後に締め切りを置く
    if (levelNumber === template.lateRegCloseAfterLevel) {
      items.push({ kind: 'lateRegClose' })
    }
  })
  return items
}
