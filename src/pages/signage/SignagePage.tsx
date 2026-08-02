import { Link } from 'react-router'
import BreakScreen from './BreakScreen'
import ChampionScreen from './ChampionScreen'
import TimerScreen from './TimerScreen'
import { useSignageController, type SignageData } from './useSignageController'
import VideoOverlay from './VideoOverlay'
import WaitingScreen from './WaitingScreen'
import { deriveStats } from '../../domain/stats'

function SignageBody({ data }: { data: SignageData }) {
  const { config, session, roomName, now, phase } = data
  switch (phase) {
    case 'waiting':
      return (
        <WaitingScreen
          storeName={roomName}
          config={config}
          stats={deriveStats(session.histories)}
        />
      )
    case 'break':
      return (
        <BreakScreen
          config={config}
          session={session}
          stats={deriveStats(session.histories)}
          now={now}
        />
      )
    case 'champion':
      return <ChampionScreen storeName={roomName} config={config} />
    default:
      return (
        <TimerScreen
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
 * リモコンのコマンドと演出動画オーバーレイを制御する
 */
export default function SignagePage() {
  const state = useSignageController()

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
          event={state.overlayEvent}
          onDone={state.onOverlayDone}
        />
      )}
    </>
  )
}
