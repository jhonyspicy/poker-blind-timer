import { describe, expect, it } from 'vitest'
import { formatBlind } from './format'

describe('formatBlind', () => {
  it('10 万未満はカンマ区切りのまま表示する', () => {
    expect(formatBlind(200)).toBe('200')
    expect(formatBlind(1500)).toBe('1,500')
    expect(formatBlind(99999)).toBe('99,999')
  })

  it('10 万以上は K 表記に短縮する', () => {
    expect(formatBlind(100000)).toBe('100K')
    expect(formatBlind(150000)).toBe('150K')
    expect(formatBlind(1000000)).toBe('1,000K')
  })

  it('1,000 で割り切れない値は小数第 1 位まで表示する', () => {
    expect(formatBlind(125500)).toBe('125.5K')
  })
})
