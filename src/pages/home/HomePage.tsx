import * as Ably from 'ably'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { deriveStats, isChampionDecided } from '../../domain/stats'
import type { SessionState, TournamentConfig } from '../../domain/types'
import {
  ablyChannelName,
  buildRemoteUrl,
  createChannelId,
  createRealtimeClient,
  isPairingConfigured,
} from '../../realtime/connection'
import {
  deleteConfig,
  listConfigs,
  loadRoom,
  loadSession,
  saveConfig,
  saveRoom,
  saveSession,
} from '../../storage/db'
import styles from './HomePage.module.css'

const TOAST_DURATION_MS = 2500

function timerName(config: TournamentConfig): string {
  return config.title || '(無題)'
}

/** 開始/再開ペアリングモーダルの状態(realtime-pairing 仕様の 4 段階) */
interface PairingState {
  config: TournamentConfig
  mode: 'start' | 'resume'
  phase: 'connecting' | 'waiting-remote' | 'ready' | 'error'
  channelId: string | null
  remoteUrl: string | null
  errorMessage?: string
}

/** トップページ。保存済みタイマー設定の一覧と開始・編集・複製・削除の入口 */
export default function HomePage() {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const [configs, setConfigs] = useState<TournamentConfig[]>([])
  const [roomName, setRoomName] = useState('')
  const [session, setSession] = useState<SessionState | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<TournamentConfig | null>(null)
  /** 店名の編集中テキスト。null なら表示モード */
  const [storeDraft, setStoreDraft] = useState<string | null>(null)
  const [pairing, setPairing] = useState<PairingState | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  /** ペアリング中の Ably クライアント。閉じ忘れによるリークを防ぐ */
  const pairingClient = useRef<Ably.Realtime | null>(null)

  const refresh = useCallback(async () => {
    setConfigs(await listConfigs())
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([listConfigs(), loadRoom(), loadSession()]).then(([saved, room, storedSession]) => {
      if (cancelled) return
      setConfigs(saved)
      setRoomName(room?.name ?? '')
      setSession(storedSession ?? null)
      setLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(
    () => () => {
      window.clearTimeout(toastTimer.current)
      pairingClient.current?.close()
    },
    [],
  )

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

  // 「再開」対象: 直近セッションが優勝確定・終了していない場合のみ(design.md D15)
  const resumableConfigId =
    session &&
    session.timer.status !== 'finished' &&
    !isChampionDecided(deriveStats(session.histories))
      ? session.configId
      : null

  const startPairing = async (config: TournamentConfig, mode: 'start' | 'resume') => {
    if (!isPairingConfigured()) {
      showToast('リモコン連携が未設定です(VITE_PAIRING_API_URL を確認)')
      return
    }
    setPairing({ config, mode, phase: 'connecting', channelId: null, remoteUrl: null })
    try {
      const channelId = await createChannelId()
      pairingClient.current?.close()
      const client = createRealtimeClient(channelId)
      pairingClient.current = client
      client.connection.on('failed', (stateChange) => {
        setPairing((prev) =>
          prev
            ? {
                ...prev,
                phase: 'error',
                errorMessage: stateChange.reason?.message ?? '接続に失敗しました',
              }
            : prev,
        )
      })
      const channel = client.channels.get(ablyChannelName(channelId))
      // リモコンの入室(presence)を検知したら「ブラインドタイマーを開く」を表示する
      await channel.presence.subscribe('enter', () => {
        setPairing((prev) => (prev && prev.phase !== 'error' ? { ...prev, phase: 'ready' } : prev))
      })
      const members = await channel.presence.get()
      setPairing((prev) =>
        prev
          ? {
              ...prev,
              phase: members.length > 0 ? 'ready' : 'waiting-remote',
              channelId,
              remoteUrl: buildRemoteUrl(channelId),
            }
          : prev,
      )
    } catch (error) {
      setPairing((prev) =>
        prev
          ? {
              ...prev,
              phase: 'error',
              errorMessage: error instanceof Error ? error.message : String(error),
            }
          : prev,
      )
    }
  }

  const closePairing = () => {
    pairingClient.current?.close()
    pairingClient.current = null
    setPairing(null)
  }

  const handleOpenTimer = async () => {
    if (!pairing?.channelId) return
    const nextSession: SessionState =
      pairing.mode === 'resume' && session && session.configId === pairing.config.id
        ? { ...session, channelId: pairing.channelId }
        : {
            configId: pairing.config.id,
            channelId: pairing.channelId,
            timer: { status: 'waiting' },
            histories: [],
            nextHistoryId: 1,
          }
    await saveSession(nextSession)
    // フルスクリーンはクリック(ユーザー操作)起点でのみ許可される。拒否時は通常表示のまま進む
    try {
      await document.documentElement.requestFullscreen()
    } catch {
      /* 非対応・拒否時はそのまま */
    }
    navigate('/signage')
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
                  onClick={() => void startPairing(config, 'start')}
                >
                  <span className={styles.playIcon}>▶</span>開始
                </button>
                {config.id === resumableConfigId && (
                  <button
                    type="button"
                    className={`${styles.btnPrimary} ${styles.startButton}`}
                    onClick={() => void startPairing(config, 'resume')}
                  >
                    再開
                  </button>
                )}
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
      {pairing && (
        <div className={styles.dialogBackdrop}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pairing-dialog-title"
          >
            <div id="pairing-dialog-title" className={styles.dialogTitle}>
              {pairing.mode === 'resume' ? 'トーナメントを再開' : 'トーナメントを開始'}
            </div>
            <div className={styles.dialogBody}>「{timerName(pairing.config)}」</div>
            {pairing.phase === 'connecting' && (
              <div className={styles.pairingStatus}>少々お待ちください…</div>
            )}
            {(pairing.phase === 'waiting-remote' || pairing.phase === 'ready') &&
              pairing.remoteUrl && (
                <div className={styles.pairingBody}>
                  <div className={styles.qrBox}>
                    <QRCodeSVG value={pairing.remoteUrl} size={200} marginSize={2} />
                  </div>
                  <div className={styles.pairingUrl}>{pairing.remoteUrl}</div>
                  {pairing.phase === 'waiting-remote' ? (
                    <div className={styles.pairingStatus}>操作端末で開いてください</div>
                  ) : (
                    <div className={styles.pairingStatusReady}>リモコンが接続されました</div>
                  )}
                </div>
              )}
            {pairing.phase === 'error' && (
              <div className={styles.pairingError}>接続に失敗しました: {pairing.errorMessage}</div>
            )}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnSecondary} onClick={closePairing}>
                キャンセル
              </button>
              {pairing.phase === 'ready' && (
                <button
                  type="button"
                  className={styles.btnPrimary}
                  onClick={() => void handleOpenTimer()}
                >
                  ブラインドタイマーを開く
                </button>
              )}
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
