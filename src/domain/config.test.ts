import { describe, expect, it } from 'vitest'
import { createNewConfig, validateConfig } from './config'
import type { TournamentConfig } from './types'

function validConfig(): TournamentConfig {
  return {
    ...createNewConfig(1000),
    structure: [{ kind: 'blind', sb: 100, bb: 200, ante: 200, durationMinutes: 20 }],
  }
}

describe('validateConfig', () => {
  it('正常な設定はエラーなし', () => {
    expect(validateConfig(validConfig())).toEqual([])
  })

  it('ブラインドレベルが 1 つも無いとエラー', () => {
    const config = { ...validConfig(), structure: [] }
    expect(validateConfig(config)).not.toEqual([])
  })

  it('継続時間 0 はエラー', () => {
    const config: TournamentConfig = {
      ...validConfig(),
      structure: [{ kind: 'blind', sb: 100, bb: 200, ante: 0, durationMinutes: 0 }],
    }
    expect(validateConfig(config).some((e) => e.includes('継続時間'))).toBe(true)
  })

  it('SB / BB が 0 以下はエラー', () => {
    const config: TournamentConfig = {
      ...validConfig(),
      structure: [{ kind: 'blind', sb: 0, bb: -1, ante: 0, durationMinutes: 20 }],
    }
    const errors = validateConfig(config)
    expect(errors.some((e) => e.includes('SB'))).toBe(true)
    expect(errors.some((e) => e.includes('BB'))).toBe(true)
  })

  it('レイトレジ締め切りマーカーは 1 つまで', () => {
    const one: TournamentConfig = {
      ...validConfig(),
      structure: [
        { kind: 'blind', sb: 100, bb: 200, ante: 0, durationMinutes: 20 },
        { kind: 'lateRegClose' },
      ],
    }
    expect(validateConfig(one)).toEqual([])

    const two: TournamentConfig = {
      ...one,
      structure: [...one.structure, { kind: 'lateRegClose' }],
    }
    expect(validateConfig(two).some((e) => e.includes('レイトレジ'))).toBe(true)
  })
})
