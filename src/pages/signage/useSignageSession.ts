import { useCallback, useEffect, useRef, useState } from 'react'
import { addHistory, deleteHistory, updateHistoryChip } from '../../domain/stats'
import {
  nextLevel,
  pauseTimer,
  prevLevel,
  resolveTimer,
  resumeTimer,
  startTimer,
} from '../../domain/timer'
import type { HistoryCommand, SessionState, TournamentConfig } from '../../domain/types'
import type { RemoteCommand } from '../../realtime/messages'
import { clearSession, getConfig, listConfigs, loadSession, saveSession } from '../../storage/db'

const TICK_INTERVAL_MS = 250

export type SignagePhase = 'loading' | 'select' | 'active'

export interface SignageController {
  phase: SignagePhase
  configs: TournamentConfig[]
  config: TournamentConfig | null
  session: SessionState | null
  now: number
  start: (config: TournamentConfig) => void
  reset: () => void
  pause: () => void
  resume: () => void
  goNextLevel: () => void
  goPrevLevel: () => void
  addHistoryEntry: (command: HistoryCommand, chip?: number) => void
  updateHistoryEntry: (id: number, chip: number) => void
  deleteHistoryEntry: (id: number) => void
  updateTitle: (title: string) => void
  applyRemoteCommand: (command: RemoteCommand) => void
}

/**
 * サイネージのセッション管理。タイマー進行の source of truth。
 * 状態変化は IndexedDB に保存され、リロード時に復元される。
 */
export function useSignageSession(): SignageController {
  const [loaded, setLoaded] = useState(false)
  const [configs, setConfigs] = useState<TournamentConfig[]>([])
  const [config, setConfig] = useState<TournamentConfig | null>(null)
  const [session, setSession] = useState<SessionState | null>(null)
  const [now, setNow] = useState(() => Date.now())
  /** 適用済みコマンドの requestId。重複配信されても二重適用しない */
  const processedRequestIds = useRef<Set<string>>(new Set())

  // 初期ロード: 進行中セッションがあれば復元、無ければ設定選択へ
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [savedSession, savedConfigs] = await Promise.all([loadSession(), listConfigs()])
      const savedConfig = savedSession ? await getConfig(savedSession.configId) : undefined
      if (savedSession && !savedConfig) {
        // 参照先の設定が消えたセッションは復元できないので破棄する
        await clearSession()
      }
      if (cancelled) return
      setConfigs(savedConfigs)
      if (savedSession && savedConfig) {
        setConfig(savedConfig)
        setSession(savedSession)
      }
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 表示更新のトリガーと、実時間に基づくレベル自動遷移
  useEffect(() => {
    if (!session || !config) return
    const structure = config.structure
    const id = setInterval(() => {
      const current = Date.now()
      setNow(current)
      setSession((prev) => {
        if (!prev) return prev
        const resolved = resolveTimer(prev.timer, structure, current)
        return resolved === prev.timer ? prev : { ...prev, timer: resolved }
      })
    }, TICK_INTERVAL_MS)
    return () => clearInterval(id)
  }, [session !== null, config]) // eslint-disable-line react-hooks/exhaustive-deps

  // 状態変化を IndexedDB へ保存(リロード復元用)
  useEffect(() => {
    if (session) void saveSession(session)
  }, [session])

  const start = useCallback((selected: TournamentConfig) => {
    processedRequestIds.current.clear()
    setConfig(selected)
    setSession({
      configId: selected.id,
      timer: startTimer(Date.now()),
      histories: [],
      nextHistoryId: 1,
      titleOverride: null,
    })
  }, [])

  const reset = useCallback(() => {
    void clearSession()
    processedRequestIds.current.clear()
    setSession(null)
    setConfig(null)
    void listConfigs().then(setConfigs)
  }, [])

  const withSession = useCallback(
    (updater: (prev: SessionState, structure: TournamentConfig['structure']) => SessionState) => {
      setSession((prev) => {
        if (!prev || !config) return prev
        return updater(prev, config.structure)
      })
    },
    [config],
  )

  const pause = useCallback(() => {
    withSession((prev, structure) => ({
      ...prev,
      timer: pauseTimer(prev.timer, structure, Date.now()),
    }))
  }, [withSession])

  const resume = useCallback(() => {
    withSession((prev) => ({ ...prev, timer: resumeTimer(prev.timer, Date.now()) }))
  }, [withSession])

  const goNextLevel = useCallback(() => {
    withSession((prev, structure) => ({
      ...prev,
      timer: nextLevel(prev.timer, structure, Date.now()),
    }))
  }, [withSession])

  const goPrevLevel = useCallback(() => {
    withSession((prev, structure) => ({
      ...prev,
      timer: prevLevel(prev.timer, structure, Date.now()),
    }))
  }, [withSession])

  const addHistoryEntry = useCallback(
    (command: HistoryCommand, chip?: number) => {
      if (!config) return
      if (command === 'addon' && !config.addonEnabled) return
      // chip 未指定なら設定のデフォルト値を記録時の値として保存する
      const resolvedChip =
        command === 'bust'
          ? undefined
          : (chip ?? (command === 'entry' ? config.startingStack : config.addonChip))
      withSession((prev) => {
        const result = addHistory(prev.histories, prev.nextHistoryId, {
          command,
          ...(resolvedChip !== undefined ? { chip: resolvedChip } : {}),
        })
        return { ...prev, histories: result.histories, nextHistoryId: result.nextHistoryId }
      })
    },
    [config, withSession],
  )

  const updateHistoryEntry = useCallback(
    (id: number, chip: number) => {
      withSession((prev) => ({ ...prev, histories: updateHistoryChip(prev.histories, id, chip) }))
    },
    [withSession],
  )

  const deleteHistoryEntry = useCallback(
    (id: number) => {
      withSession((prev) => ({ ...prev, histories: deleteHistory(prev.histories, id) }))
    },
    [withSession],
  )

  const updateTitle = useCallback(
    (title: string) => {
      withSession((prev) => ({ ...prev, titleOverride: title }))
    },
    [withSession],
  )

  const applyRemoteCommand = useCallback(
    (command: RemoteCommand) => {
      if (command.type === 'REQUEST_STATE') return // 状態の publish は realtime 層が担う
      if (processedRequestIds.current.has(command.requestId)) return
      processedRequestIds.current.add(command.requestId)
      switch (command.type) {
        case 'HISTORY_ADD':
          addHistoryEntry(command.command, command.chip)
          break
        case 'HISTORY_UPDATE':
          updateHistoryEntry(command.id, command.chip)
          break
        case 'HISTORY_DELETE':
          deleteHistoryEntry(command.id)
          break
        case 'PAUSE':
          pause()
          break
        case 'RESUME':
          resume()
          break
        case 'NEXT_LEVEL':
          goNextLevel()
          break
        case 'PREV_LEVEL':
          goPrevLevel()
          break
        case 'TITLE_UPDATE':
          updateTitle(command.title)
          break
      }
    },
    [
      addHistoryEntry,
      updateHistoryEntry,
      deleteHistoryEntry,
      pause,
      resume,
      goNextLevel,
      goPrevLevel,
      updateTitle,
    ],
  )

  return {
    phase: !loaded ? 'loading' : session && config ? 'active' : 'select',
    configs,
    config,
    session,
    now,
    start,
    reset,
    pause,
    resume,
    goNextLevel,
    goPrevLevel,
    addHistoryEntry,
    updateHistoryEntry,
    deleteHistoryEntry,
    updateTitle,
    applyRemoteCommand,
  }
}
