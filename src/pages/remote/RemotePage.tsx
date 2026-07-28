import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { formatChips, formatClock } from '../../domain/format'
import type { HistoryEntry } from '../../domain/types'
import styles from './RemotePage.module.css'
import { useRemoteConnection } from './useRemoteConnection'

const CONNECTION_LABEL: Record<string, string> = {
  initialized: '接続準備中…',
  connecting: '接続中…',
  connected: '接続済み',
  disconnected: '切断されました。再接続中…',
  suspended: '切断されました。再接続中…',
  closing: '切断中…',
  closed: '切断済み',
  failed: '接続に失敗しました',
}

function historyLabel(entry: HistoryEntry): string {
  switch (entry.command) {
    case 'entry':
      return `エントリー${entry.chip !== undefined ? ` (${formatChips(entry.chip)})` : ''}`
    case 'addon':
      return `アドオン${entry.chip !== undefined ? ` (${formatChips(entry.chip)})` : ''}`
    case 'bust':
      return 'バスト'
  }
}

export default function RemotePage() {
  const [searchParams] = useSearchParams()
  const channelId = searchParams.get('ch')
  const { configured, connectionState, snapshot, send } = useRemoteConnection(channelId)

  // 残り時間はスナップショット受信時刻からの経過分を差し引いてローカルに進める
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  const [chipOverride, setChipOverride] = useState('')
  const [titleInput, setTitleInput] = useState('')
  const [showHistories, setShowHistories] = useState(false)

  if (!channelId) {
    return (
      <main className={styles.guide}>
        <h1 className={styles.title}>リモコン</h1>
        <p>接続先が指定されていません。</p>
        <p>サイネージ画面に表示される QR コードからこのページを開いてください。</p>
      </main>
    )
  }

  if (!configured) {
    return (
      <main className={styles.guide}>
        <h1 className={styles.title}>リモコン</h1>
        <p>リモコン連携が設定されていません(VITE_PAIRING_API_URL 未設定)。</p>
      </main>
    )
  }

  const running = snapshot?.status === 'running'
  const remaining =
    snapshot === null
      ? null
      : running
        ? Math.max(0, snapshot.remainingMs - (now - snapshot.publishedAt))
        : snapshot.remainingMs

  const parsedChip = chipOverride === '' ? undefined : Number(chipOverride)
  const chipValid = parsedChip === undefined || (Number.isFinite(parsedChip) && parsedChip > 0)

  const handleEditChip = (entry: HistoryEntry) => {
    const input = window.prompt('チップ量を入力してください', String(entry.chip ?? ''))
    if (input === null) return
    const chip = Number(input)
    if (!Number.isFinite(chip) || chip <= 0) return
    send({ type: 'HISTORY_UPDATE', id: entry.id, chip })
  }

  const handleDeleteHistory = (entry: HistoryEntry) => {
    if (window.confirm(`履歴 #${entry.id} ${historyLabel(entry)} を削除しますか?`)) {
      send({ type: 'HISTORY_DELETE', id: entry.id })
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>リモコン</h1>
      <div
        className={`${styles.connection} ${
          connectionState === 'failed' ? styles.connectionError : ''
        }`}
      >
        {CONNECTION_LABEL[connectionState] ?? connectionState}
      </div>

      <section className={styles.statusCard}>
        {snapshot === null ? (
          <span className={styles.empty}>サイネージからの状態を待っています…</span>
        ) : (
          <>
            <span className={styles.statusTitle}>{snapshot.title}</span>
            <span
              className={`${styles.statusClock} ${
                snapshot.status === 'paused' ? styles.statusPaused : ''
              }`}
            >
              {snapshot.status === 'finished' ? '終了' : formatClock(remaining ?? 0)}
            </span>
            {snapshot.status === 'paused' && (
              <span className={styles.statusPaused}>一時停止中</span>
            )}
            {snapshot.isBreak && <span>ブレイク中</span>}
            {snapshot.blind && (
              <span className={styles.statusBlind}>
                {snapshot.levelNumber !== null && `L${snapshot.levelNumber} `}
                {formatChips(snapshot.blind.sb)} / {formatChips(snapshot.blind.bb)}
                {snapshot.blind.ante > 0 && ` (${formatChips(snapshot.blind.ante)})`}
              </span>
            )}
            <span className={styles.statusMeta}>
              <span>Players {snapshot.stats.currentPlayers}</span>
              <span>Entries {snapshot.stats.totalEntries}</span>
              {snapshot.addonEnabled && <span>Add-ons {snapshot.stats.addons}</span>}
              <span>
                Avg{' '}
                {snapshot.stats.averageStack === null
                  ? '-'
                  : formatChips(snapshot.stats.averageStack)}
              </span>
            </span>
          </>
        )}
      </section>

      <section className={styles.section}>
        <span className={styles.sectionLabel}>プレイヤー</span>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.entryButton}
            onClick={() => send({ type: 'HISTORY_ADD', command: 'entry', chip: parsedChip })}
            disabled={!chipValid}
          >
            エントリー
          </button>
          <button
            type="button"
            className={styles.bustButton}
            onClick={() => send({ type: 'HISTORY_ADD', command: 'bust' })}
          >
            バスト
          </button>
          {snapshot?.addonEnabled !== false && (
            <button
              type="button"
              className={styles.addonButton}
              onClick={() => send({ type: 'HISTORY_ADD', command: 'addon', chip: parsedChip })}
              disabled={!chipValid}
            >
              アドオン
            </button>
          )}
        </div>
        <label className={styles.chipField}>
          チップ量
          <input
            type="number"
            inputMode="numeric"
            placeholder={
              snapshot ? `設定値 ${formatChips(snapshot.startingStack)}` : '空欄で設定値'
            }
            value={chipOverride}
            onChange={(e) => setChipOverride(e.target.value)}
          />
          (空欄なら設定のデフォルト値)
        </label>
        <button
          type="button"
          className={styles.smallButton}
          onClick={() => setShowHistories((v) => !v)}
        >
          {showHistories ? '履歴を閉じる' : '履歴を表示・修正'}
        </button>
        {showHistories && (
          <ul className={styles.historyList}>
            {snapshot === null || snapshot.histories.length === 0 ? (
              <li className={styles.empty}>履歴はまだありません</li>
            ) : (
              [...snapshot.histories].reverse().map((entry) => (
                <li key={entry.id}>
                  <span
                    className={`${styles.historyLabel} ${
                      entry.command === 'entry'
                        ? styles.historyEntry
                        : entry.command === 'addon'
                          ? styles.historyAddon
                          : styles.historyBust
                    }`}
                  >
                    #{entry.id} {historyLabel(entry)}
                  </span>
                  {entry.command !== 'bust' && (
                    <button
                      type="button"
                      className={styles.smallButton}
                      onClick={() => handleEditChip(entry)}
                    >
                      修正
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.dangerSmall}
                    onClick={() => handleDeleteHistory(entry)}
                  >
                    削除
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </section>

      <section className={styles.section}>
        <span className={styles.sectionLabel}>タイマー</span>
        <button
          type="button"
          className={styles.pauseButton}
          onClick={() => send({ type: running ? 'PAUSE' : 'RESUME' })}
          disabled={snapshot?.status === 'finished'}
        >
          {running ? '一時停止' : '再開'}
        </button>
      </section>

      <section className={styles.section}>
        <span className={styles.sectionLabel}>レベル移動</span>
        <div className={styles.buttonRow}>
          <button
            type="button"
            className={styles.levelButton}
            onClick={() => send({ type: 'PREV_LEVEL' })}
          >
            ← 前のブラインド
          </button>
          <button
            type="button"
            className={styles.levelButton}
            onClick={() => send({ type: 'NEXT_LEVEL' })}
          >
            次のブラインド →
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <span className={styles.sectionLabel}>トーナメントタイトル</span>
        <div className={styles.titleField}>
          <input
            type="text"
            value={titleInput}
            placeholder={snapshot?.title ?? ''}
            onChange={(e) => setTitleInput(e.target.value)}
          />
          <button
            type="button"
            className={styles.smallButton}
            onClick={() => {
              if (titleInput.trim() !== '') {
                send({ type: 'TITLE_UPDATE', title: titleInput.trim() })
                setTitleInput('')
              }
            }}
          >
            変更
          </button>
        </div>
      </section>
    </main>
  )
}
