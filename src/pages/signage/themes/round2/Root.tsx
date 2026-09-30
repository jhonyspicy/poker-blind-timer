import type { SignageThemeProps } from '..'
import BreakScreen from './BreakScreen'
import ChampionScreen from './ChampionScreen'
import ClockScreen from './ClockScreen'
import EffectVideoOverlay from './EffectVideoOverlay'
import { useRound2Announcements } from './useRound2Announcements'
import WaitingScreen from './WaitingScreen'

/**
 * Round2 テーマの Root。共有層の局面(phase)にそのまま従い、
 * 待機 / タイマー / ブレイク / 優勝を専用画面として切り替え、演出は動画のオーバーレイで重ねる
 * (開始 / インマネ / 優勝。HEADS UP は素材が無いため即座に終了を返す)。
 * 優勝演出の合図でタイマーが停止して phase が champion になるため、演出(透過動画)の
 * 背後にはタイマー画面が残り、合図と同時に優勝画面へ切り替わる
 */
export default function Round2Root({
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
  useRound2Announcements(session, config.structure, now)

  const screen = (() => {
    switch (phase) {
      case 'waiting':
        return <WaitingScreen storeName={roomName} config={config} stats={stats} />
      case 'break':
        return <BreakScreen config={config} session={session} stats={stats} now={now} />
      case 'champion':
        return <ChampionScreen storeName={roomName} config={config} />
      default:
        return (
          <ClockScreen
            storeName={roomName}
            config={config}
            timer={session.timer}
            stats={stats}
            now={now}
          />
        )
    }
  })()
  return (
    <>
      {screen}
      {effectEvent && (
        <EffectVideoOverlay
          key={effectEvent}
          event={effectEvent}
          onAdvance={onAdvance}
          onDone={onDone}
        />
      )}
    </>
  )
}
