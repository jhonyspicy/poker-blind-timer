/** トップページの「アップデート情報」に表示する更新履歴。新しいものを先頭に追加する。
   運用ルールは AGENTS.md「アップデート情報の更新」を参照 */
export interface UpdateEntry {
  /** 表示日付(YYYY-MM-DD) */
  date: string
  /** 利用者向けの説明文 */
  text: string
}

/** 表示上限。超過分は表示されないため、古い行はファイルからも削除してよい */
const MAX_UPDATES = 10

const ALL_UPDATES: UpdateEntry[] = [
  {
    date: '2026-08-06',
    text: 'エディタで Shift+Enter によるプライズ行・レベル行の追加に対応しました',
  },
  {
    date: '2026-08-06',
    text: 'エントリー案内の表示をエディタとブレイク画面から削除しました',
  },
]

export const UPDATES: UpdateEntry[] = ALL_UPDATES.slice(0, MAX_UPDATES)
