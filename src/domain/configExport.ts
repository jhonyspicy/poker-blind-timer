import { validateConfig } from './config'
import type { Prize, StructureItem, TournamentConfig } from './types'

/** 他アプリの JSON を誤って読み込まないための識別子 */
export const EXPORT_APP = 'poker-blind-timer'
/** エクスポートファイルのスキーマ版。スキーマ変更時にインポート側で変換するために持つ */
export const EXPORT_FORMAT_VERSION = 1

/**
 * エクスポートに含める設定の中身。id / createdAt / updatedAt は端末固有の値であり、
 * インポート時に振り直すため含めない
 */
export interface ExportedConfig {
  title: string
  prizes: Prize[]
  structure: StructureItem[]
}

/** 1 件でも全件でも同じ「複数入り」形式に統一し、インポートの入口を 1 つにする */
export interface ConfigExportFile {
  app: typeof EXPORT_APP
  formatVersion: number
  exportedAt: number
  configs: ExportedConfig[]
}

export function buildExportFile(
  configs: TournamentConfig[],
  exportedAt: number = Date.now(),
): ConfigExportFile {
  return {
    app: EXPORT_APP,
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt,
    configs: configs.map((config) => ({
      title: config.title,
      prizes: config.prizes.map((prize) => ({ ...prize })),
      structure: config.structure.map((item) => ({ ...item })),
    })),
  }
}

/** 全件バックアップ用のファイル名(日付入り) */
export function allExportFileName(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `blind-timer-configs-${y}-${m}-${d}.json`
}

/** 1 件共有用のファイル名(タイトル由来)。OS で使えない文字は取り除く */
export function singleExportFileName(title: string): string {
  const safe = title.replace(/[\\/:*?"<>|]/g, '').trim()
  return `${safe || 'blind-timer-config'}.json`
}

export type ParseExportResult =
  { ok: true; configs: ExportedConfig[] } | { ok: false; error: string }

function isPrize(value: unknown): value is Prize {
  if (typeof value !== 'object' || value === null) return false
  const prize = value as Record<string, unknown>
  return typeof prize.place === 'number' && typeof prize.description === 'string'
}

function isStructureItem(value: unknown): value is StructureItem {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  switch (item.kind) {
    case 'blind':
      return (
        typeof item.sb === 'number' &&
        typeof item.bb === 'number' &&
        typeof item.ante === 'number' &&
        typeof item.durationMinutes === 'number'
      )
    case 'break':
      return typeof item.durationMinutes === 'number'
    case 'lateRegClose':
      return true
    default:
      return false
  }
}

/**
 * エクスポートファイルの文字列を検証つきで読み込む。壊れたファイルや他アプリの JSON は
 * 利用者に見せられるエラーメッセージで弾く
 */
export function parseExportFile(text: string): ParseExportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON ファイルとして読み込めませんでした' }
  }
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'エクスポートファイルの形式ではありません' }
  }
  const file = data as Record<string, unknown>
  if (file.app !== EXPORT_APP) {
    return { ok: false, error: 'このアプリのエクスポートファイルではありません' }
  }
  if (typeof file.formatVersion !== 'number') {
    return { ok: false, error: 'エクスポートファイルの形式ではありません' }
  }
  if (file.formatVersion > EXPORT_FORMAT_VERSION) {
    return {
      ok: false,
      error: '新しいバージョンでエクスポートされたファイルのため読み込めません',
    }
  }
  if (!Array.isArray(file.configs) || file.configs.length === 0) {
    return { ok: false, error: 'ファイルに設定が含まれていません' }
  }

  const configs: ExportedConfig[] = []
  for (const [index, raw] of file.configs.entries()) {
    const label = `${index + 1} 件目の設定`
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, error: `${label}のデータが壊れています` }
    }
    const config = raw as Record<string, unknown>
    if (typeof config.title !== 'string' || !config.title.trim()) {
      return { ok: false, error: `${label}にタイトルがありません` }
    }
    if (!Array.isArray(config.prizes) || !config.prizes.every(isPrize)) {
      return { ok: false, error: `${label}のプライズのデータが壊れています` }
    }
    if (!Array.isArray(config.structure) || !config.structure.every(isStructureItem)) {
      return { ok: false, error: `${label}のストラクチャーのデータが壊れています` }
    }
    // 形は正しくても値として成立しない設定(継続時間 0 など)は保存時と同じ基準で弾く
    const exported: ExportedConfig = {
      title: config.title.trim(),
      prizes: config.prizes.map((prize) => ({
        place: prize.place,
        description: prize.description,
      })),
      structure: config.structure.map((item) => ({ ...item })),
    }
    const errors = validateConfig({
      id: '',
      createdAt: 0,
      updatedAt: 0,
      ...exported,
    })
    if (errors.length > 0) {
      return { ok: false, error: `${label}(${exported.title}): ${errors[0]}` }
    }
    configs.push(exported)
  }
  return { ok: true, configs }
}

/**
 * インポートした設定を保存できる形にする。既存設定の上書きによるデータ消失を避けるため
 * 常に新規として追加し、id と作成 / 更新日時はインポート時刻で振り直す。
 * タイトルは一意制約があるため、衝突時は連番を付けて回避する
 */
export function toImportedConfigs(
  exported: ExportedConfig[],
  existingTitles: Iterable<string>,
  now: number = Date.now(),
): TournamentConfig[] {
  const taken = new Set([...existingTitles].map((title) => title.trim()))
  return exported.map((config, index) => {
    let title = config.title
    for (let n = 2; taken.has(title); n++) {
      title = `${config.title} ${n}`
    }
    taken.add(title)
    // 一覧は更新日時の新しい順のため、ファイル内の並びが保たれるよう先頭ほど新しくする
    const timestamp = now - index
    return {
      id: crypto.randomUUID(),
      title,
      prizes: config.prizes,
      structure: config.structure,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
  })
}
