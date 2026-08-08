import { describe, expect, it } from 'vitest'
import {
  EXPORT_APP,
  EXPORT_FORMAT_VERSION,
  allExportFileName,
  buildExportFile,
  parseExportFile,
  singleExportFileName,
  toImportedConfigs,
} from './configExport'
import type { TournamentConfig } from './types'

function sampleConfig(overrides: Partial<TournamentConfig> = {}): TournamentConfig {
  return {
    id: 'config-1',
    title: 'サンデートーナメント',
    prizes: [{ place: 1, description: '賞金 50%' }],
    structure: [
      { kind: 'blind', sb: 100, bb: 200, ante: 200, durationMinutes: 20 },
      { kind: 'break', durationMinutes: 10 },
      { kind: 'lateRegClose' },
    ],
    createdAt: 1000,
    updatedAt: 2000,
    ...overrides,
  }
}

describe('buildExportFile', () => {
  it('app / formatVersion / exportedAt を含み、configs から端末固有の値を除く', () => {
    const file = buildExportFile([sampleConfig()], 5000)
    expect(file.app).toBe(EXPORT_APP)
    expect(file.formatVersion).toBe(EXPORT_FORMAT_VERSION)
    expect(file.exportedAt).toBe(5000)
    expect(file.configs).toHaveLength(1)
    expect(file.configs[0]).not.toHaveProperty('id')
    expect(file.configs[0]).not.toHaveProperty('createdAt')
    expect(file.configs[0]).not.toHaveProperty('updatedAt')
    expect(file.configs[0].title).toBe('サンデートーナメント')
    expect(file.configs[0].structure).toEqual(sampleConfig().structure)
  })

  it('元の設定とオブジェクトを共有しない(後からの変更が混ざらない)', () => {
    const config = sampleConfig()
    const file = buildExportFile([config])
    expect(file.configs[0].structure[0]).not.toBe(config.structure[0])
    expect(file.configs[0].prizes[0]).not.toBe(config.prizes[0])
  })
})

describe('parseExportFile', () => {
  it('buildExportFile の出力を往復できる', () => {
    const text = JSON.stringify(buildExportFile([sampleConfig()]))
    const result = parseExportFile(text)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.configs).toHaveLength(1)
      expect(result.configs[0].title).toBe('サンデートーナメント')
      expect(result.configs[0].structure).toEqual(sampleConfig().structure)
    }
  })

  it('JSON でないテキストはエラー', () => {
    const result = parseExportFile('not json')
    expect(result).toEqual({ ok: false, error: expect.stringContaining('JSON') })
  })

  it('app が異なるファイルはエラー', () => {
    const file = { ...buildExportFile([sampleConfig()]), app: 'other-app' }
    const result = parseExportFile(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('formatVersion が新しいファイルはエラー', () => {
    const file = { ...buildExportFile([sampleConfig()]), formatVersion: EXPORT_FORMAT_VERSION + 1 }
    const result = parseExportFile(JSON.stringify(file))
    expect(result).toEqual({ ok: false, error: expect.stringContaining('バージョン') })
  })

  it('configs が空のファイルはエラー', () => {
    const file = { ...buildExportFile([]), configs: [] }
    const result = parseExportFile(JSON.stringify(file))
    expect(result.ok).toBe(false)
  })

  it('タイトルが無い設定はエラー', () => {
    const file = buildExportFile([sampleConfig({ title: '  ' })])
    const result = parseExportFile(JSON.stringify(file))
    expect(result).toEqual({ ok: false, error: expect.stringContaining('タイトル') })
  })

  it('ストラクチャー項目の形が壊れているとエラー', () => {
    const file = buildExportFile([sampleConfig()]) as unknown as Record<string, unknown>
    file.configs = [
      {
        title: 'タイトル',
        prizes: [],
        structure: [{ kind: 'blind', sb: 'x', bb: 200, ante: 200, durationMinutes: 20 }],
      },
    ]
    const result = parseExportFile(JSON.stringify(file))
    expect(result).toEqual({ ok: false, error: expect.stringContaining('ストラクチャー') })
  })

  it('形は正しくても値が不正(継続時間 0)ならエラー', () => {
    const file = buildExportFile([
      sampleConfig({
        structure: [{ kind: 'blind', sb: 100, bb: 200, ante: 200, durationMinutes: 0 }],
      }),
    ])
    const result = parseExportFile(JSON.stringify(file))
    expect(result).toEqual({ ok: false, error: expect.stringContaining('継続時間') })
  })

  it('タイトルは前後の空白を取り除いて読み込む', () => {
    const file = buildExportFile([sampleConfig({ title: '  タイトル  ' })])
    const result = parseExportFile(JSON.stringify(file))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.configs[0].title).toBe('タイトル')
  })
})

describe('toImportedConfigs', () => {
  const exported = [
    { title: 'A', prizes: [], structure: sampleConfig().structure },
    { title: 'B', prizes: [], structure: sampleConfig().structure },
  ]

  it('id を振り直し、作成 / 更新日時をインポート時刻にする', () => {
    const [a, b] = toImportedConfigs(exported, [], 10000)
    expect(a.id).not.toBe(b.id)
    expect(a.createdAt).toBe(a.updatedAt)
    // 一覧(更新順)でファイル内の並びが保たれるよう、先頭ほど新しい
    expect(a.updatedAt).toBeGreaterThan(b.updatedAt)
  })

  it('既存タイトルと衝突したら連番を付ける', () => {
    const [a] = toImportedConfigs(exported, ['A', 'A 2'], 10000)
    expect(a.title).toBe('A 3')
  })

  it('同一ファイル内の重複タイトルにも連番を付ける', () => {
    const twice = [exported[0], { ...exported[0] }]
    const [a, b] = toImportedConfigs(twice, [], 10000)
    expect(a.title).toBe('A')
    expect(b.title).toBe('A 2')
  })
})

describe('ファイル名', () => {
  it('全件エクスポートは日付入り', () => {
    expect(allExportFileName(new Date(2026, 7, 8))).toBe('blind-timer-configs-2026-08-08.json')
  })

  it('1 件エクスポートはタイトル由来で、使えない文字を取り除く', () => {
    expect(singleExportFileName('サンデー: 大会?')).toBe('サンデー 大会.json')
    expect(singleExportFileName('***')).toBe('blind-timer-config.json')
  })
})
