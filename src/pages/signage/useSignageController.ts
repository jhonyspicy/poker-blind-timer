import { useCallback, useEffect, useRef, useState } from 'react'
import type * as Ably from 'ably'
import {
  addHistory,
  deleteHistory,
  deriveStats,
  isChampionDecided,
  updateHistoryChip,
} from '../../domain/stats'
import {
  nextLevel,
  pauseTimer,
  prevLevel,
  remainingMs,
  resolveTimer,
  resumeTimer,
  startTimer,
} from '../../domain/timer'
import type { SessionState, TournamentConfig } from '../../domain/types'
import {
  ablyChannelName,
  createRealtimeClient,
  isPairingConfigured,
} from '../../realtime/connection'
import { MESSAGE_NAME, type RemoteCommand } from '../../realtime/messages'
import { buildSnapshot } from '../../realtime/snapshot'
import { getConfig, loadRoom, loadSession, saveSession } from '../../storage/db'
import { playSound } from './sounds'
import type { VideoEvent } from './VideoOverlay'

export type SignagePhase = 'waiting' | 'timer' | 'break' | 'champion'

export interface SignageData {
  session: SessionState
  config: TournamentConfig
  roomName: string
  now: number
  phase: SignagePhase
  /** 再生中の演出動画イベント。null なら非表示 */
  overlayEvent: VideoEvent | null
  onOverlayDone: () => void
}

export type SignageControllerState = 'loading' | 'no-session' | SignageData

/**
 * サイネージの状態管理。セッションの読み込み・タイマー進行(自動遷移)・
 * リモコンコマンドの適用(requestId 重複排除)・IndexedDB への保存・
 * state スナップショットの配信・演出イベントの発火をまとめて担う
 */
export function useSignageController(): SignageControllerState {
  const [loaded, setLoaded] = useState<'loading' | 'no-session' | 'ok'>('loading')
  const [session, setSession] = useState<SessionState | null>(null)
  const [config, setConfig] = useState<TournamentConfig | null>(null)
  const [roomName, setRoomName] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [overlayQueue, setOverlayQueue] = useState<VideoEvent[]>([])

  // セッションの正本。コマンドが連続受信されても更新が失われないよう、
  // コールバックからは常にこの ref を読み、commitSession で同期的に書き換える
  // (state はレンダリング用のミラー)
  const sessionRef = useRef<SessionState | null>(null)
  const configRef = useRef<TournamentConfig | null>(null)
  const commitSession = useCallback((next: SessionState) => {
    sessionRef.current = next
    setSession(next)
  }, [])
  const channelRef = useRef<Ably.RealtimeChannel | null>(null)
  const processedRequestIds = useRef(new Set<string>())
  const prevLevelIndexRef = useRef<number | null>(null)
  const warnedLevelRef = useRef<number | null>(null)

  // ---- 初期読み込み ----
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const storedSession = await loadSession()
      if (!storedSession) {
        if (!cancelled) setLoaded('no-session')
        return
      }
      const [storedConfig, room] = await Promise.all([
        getConfig(storedSession.configId),
        loadRoom(),
      ])
      if (cancelled) return
      if (!storedConfig) {
        setLoaded('no-session')
        return
      }
      sessionRef.current = storedSession
      configRef.current = storedConfig
      setSession(storedSession)
      setConfig(storedConfig)
      setRoomName(room?.name ?? '')
      setLoaded('ok')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- セッション変化の永続化と state 配信 ----
  useEffect(() => {
    if (!session || !config) return
    void saveSession(session)
    try {
      void channelRef.current?.publish(
        MESSAGE_NAME.state,
        buildSnapshot(config, session, Date.now()),
      )
    } catch {
      /* 未接続時は何もしない */
    }
  }, [session, config])

  // ---- 演出イベント(各トーナメント 1 回だけ) ----
  const applyMilestones = useCallback((next: SessionState, cfg: TournamentConfig): SessionState => {
    const stats = deriveStats(next.histories)
    const played = new Set(next.playedEffects ?? [])
    // エントリー増加の途中で誤発火しないよう「1 人以上バストしている」ことを条件にする
    const someoneBusted = stats.totalEntries > stats.currentPlayers
    const fire = (event: VideoEvent) => {
      if (played.has(event)) return
      played.add(event)
      setOverlayQueue((queue) => [...queue, event])
    }
    if (
      someoneBusted &&
      cfg.prizes.length > 0 &&
      stats.currentPlayers >= 1 &&
      stats.currentPlayers <= cfg.prizes.length
    ) {
      fire('in-the-money')
    }
    if (someoneBusted && stats.currentPlayers === 2) fire('heads-up')
    if (isChampionDecided(stats)) fire('champion')
    return { ...next, playedEffects: [...played] }
  }, [])

  // ---- リモコンコマンドの適用 ----
  const applyCommand = useCallback(
    (command: RemoteCommand) => {
      const current = sessionRef.current
      const cfg = configRef.current
      if (!current || !cfg) return
      if (processedRequestIds.current.has(command.requestId)) return
      processedRequestIds.current.add(command.requestId)
      const nowMs = Date.now()
      let next: SessionState | null = null
      switch (command.type) {
        case 'START':
          if (current.timer.status === 'waiting') {
            next = { ...current, timer: startTimer(nowMs) }
            setOverlayQueue((queue) => [...queue, 'tournament-start'])
          }
          break
        case 'PAUSE': {
          const timer = pauseTimer(current.timer, cfg.structure, nowMs)
          if (timer !== current.timer) {
            next = { ...current, timer }
            playSound('pause')
          }
          break
        }
        case 'RESUME': {
          const timer = resumeTimer(current.timer, nowMs)
          if (timer !== current.timer) {
            next = { ...current, timer }
            playSound('resume')
          }
          break
        }
        case 'NEXT_LEVEL':
          next = { ...current, timer: nextLevel(current.timer, cfg.structure, nowMs) }
          break
        case 'PREV_LEVEL':
          next = { ...current, timer: prevLevel(current.timer, cfg.structure, nowMs) }
          break
        case 'HISTORY_ADD': {
          const result = addHistory(current.histories, current.nextHistoryId, {
            command: command.command,
            ...(command.chip !== undefined ? { chip: command.chip } : {}),
          })
          next = { ...current, histories: result.histories, nextHistoryId: result.nextHistoryId }
          break
        }
        case 'HISTORY_UPDATE':
          next = {
            ...current,
            histories: updateHistoryChip(current.histories, command.id, command.chip),
          }
          break
        case 'HISTORY_DELETE':
          next = { ...current, histories: deleteHistory(current.histories, command.id) }
          break
        case 'REQUEST_STATE':
          try {
            void channelRef.current?.publish(MESSAGE_NAME.state, buildSnapshot(cfg, current, nowMs))
          } catch {
            /* 未接続時は何もしない */
          }
          break
      }
      if (next) commitSession(applyMilestones(next, cfg))
    },
    [applyMilestones, commitSession],
  )
  const applyCommandRef = useRef(applyCommand)
  useEffect(() => {
    applyCommandRef.current = applyCommand
  }, [applyCommand])

  // ---- Ably 接続(保存済みチャンネルへ再接続) ----
  useEffect(() => {
    if (loaded !== 'ok') return
    const channelId = sessionRef.current?.channelId
    if (!channelId || !isPairingConfigured()) return
    const client = createRealtimeClient(channelId)
    const channel = client.channels.get(ablyChannelName(channelId))
    channelRef.current = channel
    void channel.subscribe(MESSAGE_NAME.command, (message) => {
      applyCommandRef.current(message.data as RemoteCommand)
    })
    return () => {
      channelRef.current = null
      client.close()
    }
  }, [loaded])

  // ---- タイマーの進行(自動遷移・効果音) ----
  useEffect(() => {
    if (loaded !== 'ok') return
    const tick = () => {
      const nowMs = Date.now()
      setNow(nowMs)
      const current = sessionRef.current
      const cfg = configRef.current
      if (!current || !cfg) return
      const resolved = resolveTimer(current.timer, cfg.structure, nowMs)
      const index =
        resolved.status === 'running' || resolved.status === 'paused' ? resolved.levelIndex : null
      // レベル切り替わりの効果音(自動遷移・手動どちらも tick 側で一括検知)
      if (
        index !== null &&
        prevLevelIndexRef.current !== null &&
        index > prevLevelIndexRef.current
      ) {
        const item = cfg.structure[index]
        if (item?.kind === 'blind') playSound('level-up')
        else if (item?.kind === 'break') playSound('break-start')
      }
      prevLevelIndexRef.current = index
      // レベルアップ 10 秒前の予告音(次の項目がブラインドのときだけ)
      if (resolved.status === 'running') {
        const rem = remainingMs(resolved, cfg.structure, nowMs)
        const followingBlind = (() => {
          for (let i = resolved.levelIndex + 1; i < cfg.structure.length; i++) {
            const item = cfg.structure[i]
            if (item.kind === 'lateRegClose') continue
            return item.kind === 'blind'
          }
          return false
        })()
        if (
          followingBlind &&
          rem > 0 &&
          rem <= 10_000 &&
          warnedLevelRef.current !== resolved.levelIndex
        ) {
          warnedLevelRef.current = resolved.levelIndex
          playSound('level-up-warning')
        }
      }
      if (resolved !== current.timer) {
        commitSession({ ...current, timer: resolved })
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [loaded, commitSession])

  const onOverlayDone = useCallback(() => {
    setOverlayQueue((queue) => queue.slice(1))
  }, [])

  if (loaded === 'loading') return 'loading'
  if (loaded === 'no-session' || !session || !config) return 'no-session'

  const stats = deriveStats(session.histories)
  const resolved = resolveTimer(session.timer, config.structure, now)
  const onBreak =
    (resolved.status === 'running' || resolved.status === 'paused') &&
    config.structure[resolved.levelIndex]?.kind === 'break'
  const phase: SignagePhase = isChampionDecided(stats)
    ? 'champion'
    : resolved.status === 'waiting'
      ? 'waiting'
      : onBreak
        ? 'break'
        : 'timer'

  return {
    session,
    config,
    roomName,
    now,
    phase,
    overlayEvent: overlayQueue[0] ?? null,
    onOverlayDone,
  }
}
