import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { TournamentConfig } from '../../domain/types'
import { deleteConfig, listConfigs, loadRoom, saveConfig, saveRoom } from '../../storage/db'
import styles from './HomePage.module.css'

const TOAST_DURATION_MS = 2500

function timerName(config: TournamentConfig): string {
  return config.title || '(無題)'
}

/** トップページ。保存済みタイマー設定の一覧と開始・編集・複製・削除の入口 */
export default function HomePage() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [configs, setConfigs] = useState<TournamentConfig[]>([])
  const [roomName, setRoomName] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<TournamentConfig | null>(null)
  /** 店名の編集中テキスト。null なら表示モード */
  const [storeDraft, setStoreDraft] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const refresh = useCallback(async () => {
    setConfigs(await listConfigs())
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([listConfigs(), loadRoom()]).then(([saved, room]) => {
      if (cancelled) return
      setConfigs(saved)
      setRoomName(room?.name ?? '')
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const showToast = (message: string) => {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS)
  }

  const handleDuplicate = async (config: TournamentConfig) => {
    const now = Date.now()
    const copy: TournamentConfig = {
      ...structuredClone(config),
      id: crypto.randomUUID(),
      title: `${config.title || '無題'} のコピー`,
      createdAt: now,
      updatedAt: now,
    }
    await saveConfig(copy)
    await refresh()
    showToast(`「${timerName(config)}」を複製しました`)
  }

  const handleConfirmRemove = async () => {
    if (!confirmTarget) return
    await deleteConfig(confirmTarget.id)
    setConfirmTarget(null)
    await refresh()
    showToast(`「${timerName(confirmTarget)}」を削除しました`)
  }

  const handleSaveStoreName = async () => {
    if (storeDraft === null) return
    const name = storeDraft.trim()
    await saveRoom({ name })
    setRoomName(name)
    setStoreDraft(null)
    showToast('店名を保存しました')
  }

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <span className={styles.brand}>ブラインドタイマー</span>
        {roomName && <span className={styles.navStore}>{roomName}</span>}
      </header>
      <div className={styles.content}>
        <div className={styles.pageHeader}>
          <div className={styles.headings}>
            {storeDraft === null ? (
              <div className={styles.storeNameRow}>
                <h2 className={styles.storeName}>{roomName || '(店名未設定)'}</h2>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setStoreDraft(roomName)}
                >
                  編集
                </button>
              </div>
            ) : (
              <div className={styles.storeNameRow}>
                <input
                  className={styles.storeNameInput}
                  type="text"
                  value={storeDraft}
                  autoFocus
                  aria-label="お店の名前"
                  onChange={(e) => setStoreDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleSaveStoreName()
                    if (e.key === 'Escape') setStoreDraft(null)
                  }}
                />
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setStoreDraft(null)}
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void handleSaveStoreName()}
                >
                  保存
                </button>
              </div>
            )}
            <span className={styles.subtitle}>タイマー設定 ・ {configs.length} 件</span>
          </div>
          <button
            type="button"
            className={`${styles.btnPrimary} ${styles.createButton}`}
            onClick={() => navigate('/editor')}
          >
            <span className={styles.plusIcon}>＋</span>新規タイマー作成
          </button>
        </div>
        <main className={styles.list}>
          {configs.map((config) => (
            <div key={config.id} className={styles.timerCard}>
              <div className={styles.accentBar} />
              <div className={styles.timerName}>{timerName(config)}</div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.btnPrimary} ${styles.startButton}`}
                  onClick={() => navigate(`/signage?start=${config.id}`)}
                >
                  <span className={styles.playIcon}>▶</span>開始
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => navigate(`/editor?id=${config.id}`)}
                >
                  編集
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => void handleDuplicate(config)}
                >
                  複製
                </button>
                <button
                  type="button"
                  className={`${styles.btnGhost} ${styles.deleteButton}`}
                  onClick={() => setConfirmTarget(config)}
                >
                  削除
                </button>
              </div>
            </div>
          ))}
          {loaded && configs.length === 0 && (
            <div className={styles.empty}>
              タイマー設定がありません。「新規タイマー作成」から追加してください。
            </div>
          )}
        </main>
      </div>
      {confirmTarget && (
        <div className={styles.dialogBackdrop} onClick={() => setConfirmTarget(null)}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="delete-dialog-title" className={styles.dialogTitle}>
              設定を削除
            </div>
            <div className={styles.dialogBody}>
              「{timerName(confirmTarget)}」を削除します。この操作は取り消せません。
            </div>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setConfirmTarget(null)}
              >
                キャンセル
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => void handleConfirmRemove()}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className={styles.toast}>
          <span className={styles.toastIcon}>ℹ</span>
          {toast}
        </div>
      )}
    </div>
  )
}
