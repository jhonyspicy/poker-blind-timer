import type { SignageThemeProps } from '..'
import BreakScreen from './BreakScreen'
import ChampionScreen from './ChampionScreen'
import TimerScreen from './TimerScreen'
import VideoEffectOverlay from './VideoEffectOverlay'
import WaitingScreen from './WaitingScreen'

/**
 * 標準テーマの Root。共有層の局面(phase)にそのまま従い、待機 / タイマー /
 * ブレイク / 優勝を専用画面として切り替え、演出は動画のオーバーレイで重ねる。
 * 優勝演出の合図でタイマーが停止して phase が champion になるため、演出(透過動画)の
 * 背後にはタイマー画面が残り、合図と同時に優勝画面へ切り替わる
 */
export default function DefaultRoot({
  theme,
  session,
  config,
  stats,
  roomName,
  now,
  phase,
  effectEvent,
  onAdvance,
  onDone,
}: SignageThemeProps) {
  const screen = (() => {
    switch (phase) {
      case 'waiting':
        return <WaitingScreen storeName={roomName} config={config} stats={stats} />
      case 'break':
        return <BreakScreen config={config} session={session} stats={stats} now={now} />
      case 'champion':
        return <ChampionScreen storeName={roomName} config={config} />
      default:
        return <TimerScreen config={config} timer={session.timer} stats={stats} now={now} />
    }
  })()
  return (
    <>
      {screen}
      {effectEvent && (
        <VideoEffectOverlay
          key={effectEvent}
          theme={theme}
          event={effectEvent}
          onAdvance={onAdvance}
          onDone={onDone}
        />
      )}
    </>
  )
}
