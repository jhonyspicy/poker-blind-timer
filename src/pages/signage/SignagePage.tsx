import { Link } from 'react-router'
import { deriveStats } from '../../domain/stats'
import { useWakeLock } from '../../hooks/useWakeLock'
import AudioUnlockNotice from './AudioUnlockNotice'
import { resolveTheme } from './themes'
import { useSignageController, type SignageData } from './useSignageController'
import VideoOverlay from './VideoOverlay'

function SignageBody({ data }: { data: SignageData }) {
  const { config, session, roomName, now, phase } = data
  const theme = resolveTheme(data.theme)
  switch (phase) {
    case 'waiting':
      return (
        <theme.WaitingScreen
          storeName={roomName}
          config={config}
          stats={deriveStats(session.histories)}
        />
      )
    case 'break':
      return (
        <theme.BreakScreen
          config={config}
          session={session}
          stats={deriveStats(session.histories)}
          now={now}
        />
      )
    case 'champion':
      return <theme.ChampionScreen storeName={roomName} config={config} />
    default:
      return (
        <theme.TimerScreen
          config={config}
          timer={session.timer}
          stats={deriveStats(session.histories)}
          now={now}
        />
      )
  }
}

/**
 * サイネージ画面。保存済みセッションから待機 / タイマー / ブレイク / 優勝を表示し、
 * リモコンのコマンドと演出動画オーバーレイを制御する。
 * 画面コンポーネント一式と素材は設定のテーマに応じて切り替わる
 */
export default function SignagePage() {
  const state = useSignageController()
  // 長時間の常時表示を想定し、サイネージ表示中は画面スリープを抑止する
  useWakeLock()

  if (state === 'loading') {
    return null
  }
  if (state === 'no-session') {
    return (
      <main style={{ padding: '2rem' }}>
        <h1>サイネージ</h1>
        <p>進行中のトーナメントがありません。トップページの「開始」から始めてください。</p>
        <p>
          <Link to="/">← トップへ戻る</Link>
        </p>
      </main>
    )
  }
  return (
    <>
      <SignageBody data={state} />
      {state.overlayEvent && (
        <VideoOverlay
          key={state.overlayEvent}
          theme={state.theme}
          event={state.overlayEvent}
          onDone={state.onOverlayDone}
          onStarted={state.onOverlayStarted}
        />
      )}
      <AudioUnlockNotice />
    </>
  )
}
