/**
 * サイネージの見た目テーマ。テーマ = 画面コンポーネント一式 + 素材ディレクトリのセットで、
 * コンポーネントの対応はサイネージ側のレジストリ(src/pages/signage/themes)が持つ。
 * ここではエディタの選択肢とフォールバック解決に必要な id / label だけを定義する
 */

export const DEFAULT_THEME_ID = 'default'

/** 提供中のテーマ一覧。テーマを追加したらここと画面レジストリの両方に登録する */
export const THEMES = [{ id: DEFAULT_THEME_ID, label: 'スタンダード' }] as const

export type ThemeId = (typeof THEMES)[number]['id']

/**
 * 保存データやインポートファイルのテーマ指定を解決する。
 * 未指定(テーマ導入前の旧データ)や不明なテーマ名は標準テーマとして扱い、エラーにしない
 */
export function resolveThemeId(theme: string | undefined): ThemeId {
  return THEMES.some((entry) => entry.id === theme) ? (theme as ThemeId) : DEFAULT_THEME_ID
}
