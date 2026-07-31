import { Link } from 'react-router'
import { formatClock } from '../../domain/format'
import { lateRegStatus, remainingMs } from '../../domain/timer'
import type { SessionState, TournamentConfig } from '../../domain/types'
import TimerScreen from './TimerScreen'
import { useSignageController, type SignageData } from './useSignageController'
import VideoOverlay from './VideoOverlay'
import WaitingScreen from './WaitingScreen'
import { deriveStats } from '../../domain/stats'

/** ブレイク画面(デザイン未作成のためプレースホルダー) */
function BreakPlaceholder({
  config,
  session,
  now,
}: {
  config: TournamentConfig
  session: SessionState
  now: number
}) {
  const remaining = remainingMs(session.timer, config.structure, now)
  const lateReg = lateRegStatus(session.timer, config.structure, now)
  const notice = config.entryNotice?.trim()
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#04070d',
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        fontFamily: "'Noto Sans JP', sans-serif",
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '8vw',
            fontWeight: 600,
            letterSpacing: '0.2em',
            color: '#5aa2e8',
          }}
        >
          BREAK
        </div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '14vw', fontWeight: 600 }}>
          {formatClock(remaining)}
        </div>
        {notice && lateReg.kind === 'open' && (
          <div style={{ marginTop: '3vh', fontSize: '3vw', fontWeight: 700, color: '#e8c15a' }}>
            {notice}
          </div>
        )}
      </div>
    </div>
  )
}

/** 優勝画面(デザイン未作成のためプレースホルダー) */
function ChampionPlaceholder({ config }: { config: TournamentConfig }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#050403',
        display: 'grid',
        placeItems: 'center',
        color: '#e8c15a',
        fontFamily: "'Noto Sans JP', sans-serif",
        textAlign: 'center',
      }}
    >
      <div>
        <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: '8vw', fontWeight: 600 }}>
          WINNER!
        </div>
        <div style={{ fontSize: '3vw', fontWeight: 700, color: '#fff' }}>{config.title}</div>
      </div>
    </div>
  )
}

function SignageBody({ data }: { data: SignageData }) {
  const { config, session, roomName, now, phase } = data
  switch (phase) {
    case 'waiting':
      return <WaitingScreen storeName={roomName} config={config} />
    case 'break':
      return <BreakPlaceholder config={config} session={session} now={now} />
    case 'champion':
      return <ChampionPlaceholder config={config} />
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
