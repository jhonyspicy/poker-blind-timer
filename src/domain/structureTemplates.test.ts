import { describe, expect, it } from 'vitest'
import { validateConfig } from './config'
import { STRUCTURE_TEMPLATES, buildTemplateStructure } from './structureTemplates'
import type { BlindLevel, TournamentConfig } from './types'

function blinds(items: ReturnType<typeof buildTemplateStructure>): BlindLevel[] {
  return items.filter((item): item is BlindLevel => item.kind === 'blind')
}

describe('buildTemplateStructure', () => {
  it('開始 SB を 1 レベル目の SB として、BB=SB×2 / Ante=BB で生成する', () => {
    for (const template of STRUCTURE_TEMPLATES) {
      const levels = blinds(buildTemplateStructure(template, 100))
      expect(levels[0]).toEqual({
        kind: 'blind',
        sb: 100,
        bb: 200,
        ante: 200,
        durationMinutes: template.levelMinutes,
      })
      for (const level of levels) {
        expect(level.bb).toBe(level.sb * 2)
        expect(level.ante).toBe(level.bb)
        expect(level.durationMinutes).toBe(template.levelMinutes)
      }
    }
  })

  it('開始 SB を変えるとブラインド全体が同じ比率でスケールする', () => {
    const template = STRUCTURE_TEMPLATES[0]
    const base = blinds(buildTemplateStructure(template, 100))
    const scaled = blinds(buildTemplateStructure(template, 25))
    expect(scaled.length).toBe(base.length)
    scaled.forEach((level, i) => {
      expect(level.sb * 4).toBe(base[i].sb)
    })
  })

  it('SB は単調増加する', () => {
    for (const template of STRUCTURE_TEMPLATES) {
      const levels = blinds(buildTemplateStructure(template, 100))
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i].sb).toBeGreaterThan(levels[i - 1].sb)
      }
    }
  })

  it('ブレイクが定義どおりの間隔で挿入され、末尾には置かれない', () => {
    for (const template of STRUCTURE_TEMPLATES) {
      const items = buildTemplateStructure(template, 100)
      expect(items[items.length - 1].kind).toBe('blind')
      let levelCount = 0
      items.forEach((item, index) => {
        if (item.kind === 'blind') levelCount++
        if (item.kind === 'break') {
          expect(item.durationMinutes).toBe(template.breakMinutes)
          expect(levelCount % template.breakEveryLevels).toBe(0)
          // 直前はブラインドレベル(ブレイクが連続しない)
          expect(items[index - 1].kind).toBe('blind')
        }
      })
    }
  })

  it('レイトレジ締め切りが 1 つだけ、指定レベル後のブレイクの直後に置かれる', () => {
    for (const template of STRUCTURE_TEMPLATES) {
      const items = buildTemplateStructure(template, 100)
      const closes = items.filter((item) => item.kind === 'lateRegClose')
      expect(closes.length).toBe(1)
      const closeIndex = items.findIndex((item) => item.kind === 'lateRegClose')
      const levelsBefore = items.slice(0, closeIndex).filter((item) => item.kind === 'blind').length
      expect(levelsBefore).toBe(template.lateRegCloseAfterLevel)
      // レベル間に単独で置かれる運用は稀なため、必ずブレイクの直後に来ること
      expect(items[closeIndex - 1].kind).toBe('break')
    }
  })

  it('生成したストラクチャーは検証を通過する', () => {
    for (const template of STRUCTURE_TEMPLATES) {
      const config: TournamentConfig = {
        id: 'test',
        title: 'テスト',
        prizes: [],
        structure: buildTemplateStructure(template, 100),
        createdAt: 0,
        updatedAt: 0,
      }
      expect(validateConfig(config)).toEqual([])
    }
  })
})
