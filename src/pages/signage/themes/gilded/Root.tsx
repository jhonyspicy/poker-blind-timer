import type { SignageThemeProps } from '..'
import BreakScreen from './BreakScreen'
import ChampionScreen from './ChampionScreen'
import ClockScreen from './ClockScreen'
import GildedEffectOverlay from './GildedEffectOverlay'
import WaitingScreen from './WaitingScreen'

/**
 * GILDED テーマの Root。共有層の局面(phase)にそのまま従い、
 * 待機 / タイマー / ブレイク / 優勝を専用画面として切り替える。
 * 演出は動画素材を使わず CSS のオーバーレイで重ねる。優勝演出の合図で
 * タイマーが停止して phase が champion になるため、演出の背後には
 * タイマー画面が残り、合図と同時に優勝画面へ切り替わる
 */
export default function GildedRoot({
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
        <GildedEffectOverlay
          key={effectEvent}
          event={effectEvent}
          onAdvance={onAdvance}
          onDone={onDone}
        />
      )}
    </>
  )
}
