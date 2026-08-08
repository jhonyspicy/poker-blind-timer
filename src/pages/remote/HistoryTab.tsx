import { formatChips } from '../../domain/format'
import type { RemoteCommandInput, StateSnapshot } from '../../realtime/messages'
import styles from './HistoryTab.module.css'

const HISTORY_LABEL = { entry: 'エントリー', addon: 'アドオン', bust: 'バスト' } as const

interface HistoryTabProps {
  snapshot: StateSnapshot
  sendCommand: (input: RemoteCommandInput) => void
}

/** リモコンの履歴タブ。記録の一覧(新しい順)と修正・削除を行う */
export default function HistoryTab({ snapshot, sendCommand }: HistoryTabProps) {
  const editHistoryChip = (id: number, chip: number | undefined) => {
    const value = window.prompt('チップ量', chip !== undefined ? String(chip) : '')
    if (value == null) return
    const parsed = Number.parseInt(value.replace(/[^\d]/g, ''), 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      sendCommand({ type: 'HISTORY_UPDATE', id, chip: parsed })
    }
  }

  return (
    <div className={styles.historyList}>
      {snapshot.histories.length === 0 ? (
        <div className={styles.historyEmpty}>まだ記録がありません</div>
      ) : (
        snapshot.histories
          .slice()
          .reverse()
          .map((entry) => (
            <div key={entry.id} className={styles.historyRow}>
              <span className={styles.historyTag}>#{entry.id}</span>
              <span
                className={entry.command === 'bust' ? styles.historyKindBust : styles.historyKind}
              >
                {HISTORY_LABEL[entry.command]}
              </span>
              <span className={styles.historyAmount}>
                {entry.chip !== undefined ? formatChips(entry.chip) : ''}
              </span>
              {entry.command !== 'bust' && (
                <button
                  type="button"
                  className={styles.smallBtn}
                  onClick={() => editHistoryChip(entry.id, entry.chip)}
                >
                  修正
                </button>
              )}
              <button
                type="button"
                className={styles.smallBtn}
                onClick={() => {
                  if (
                    window.confirm(`#${entry.id} ${HISTORY_LABEL[entry.command]} を削除しますか?`)
                  ) {
                    sendCommand({ type: 'HISTORY_DELETE', id: entry.id })
                  }
                }}
              >
                削除
              </button>
            </div>
          ))
      )}
    </div>
  )
}
