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
  const showStartAssetNotice = state.phase === 'waiting' && !state.startAssetPreload.ready
  return (
    <>
      <SignageBody data={state} />
      {showStartAssetNotice && (
        <div
          style={{
            position: 'fixed',
            right: 'min(3vw, 24px)',
            bottom: 'min(3vw, 24px)',
            zIndex: 10,
            padding: '12px 16px',
            borderRadius: '14px',
            background: 'rgba(8, 6, 4, 0.88)',
            border: '1px solid rgba(232, 194, 94, 0.45)',
            color: '#f4e7bb',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
            textAlign: 'right',
          }}
        >
          <div style={{ fontSize: 'clamp(14px, 1.3vw, 20px)', fontWeight: 700 }}>
            開始演出を準備中…
          </div>
          <div style={{ marginTop: 4, fontSize: 'clamp(12px, 1vw, 16px)', opacity: 0.88 }}>
            {state.startAssetPreload.resolved} / {state.startAssetPreload.total} 読み込み済み
          </div>
        </div>
      )}
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
