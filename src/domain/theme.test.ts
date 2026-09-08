import { describe, expect, it } from 'vitest'
import { DEFAULT_THEME_ID, THEMES, resolveThemeId } from './theme'

describe('resolveThemeId', () => {
  it('提供中のテーマ id はそのまま返す', () => {
    for (const { id } of THEMES) {
      expect(resolveThemeId(id)).toBe(id)
    }
  })

  it('GILDED テーマを提供している', () => {
    expect(resolveThemeId('gilded')).toBe('gilded')
  })

  it('未指定(旧データ)は標準テーマに解決する', () => {
    expect(resolveThemeId(undefined)).toBe(DEFAULT_THEME_ID)
  })

  it('不明なテーマ名は標準テーマに解決する', () => {
    expect(resolveThemeId('unknown-theme')).toBe(DEFAULT_THEME_ID)
  })
})
