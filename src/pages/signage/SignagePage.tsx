import { Link } from 'react-router'
import { useWakeLock } from '../../hooks/useWakeLock'
import AudioUnlockNotice from './AudioUnlockNotice'
import RemoteQrButton from './RemoteQrButton'
import { resolveTheme } from './themes'
import { useSignageController } from './useSignageController'

/**
 * サイネージ画面。共有層(useSignageController)が確定させたドメイン状態と
 * 演出イベントをテーマの Root へ渡す。いつ・どの画面や演出を表示するかはテーマが決める。
 * リモコン QR の再表示・音声有効化の案内は運営機能のためテーマ外で重ねて表示する
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
  const theme = resolveTheme(state.theme)
  return (
    <>
      <theme.Root
        theme={state.theme}
        session={state.session}
        config={state.config}
        stats={state.stats}
        roomName={state.roomName}
        now={state.now}
        phase={state.phase}
        effectEvent={state.effectEvent}
        onAdvance={state.onEffectAdvance}
        onDone={state.onEffectDone}
      />
      {/* リモコンを失くした運営者の救済。優勝局面ではトーナメント終了済みのため出さない */}
      {state.phase !== 'champion' && state.session.channelId && (
        <RemoteQrButton channelId={state.session.channelId} />
      )}
      <AudioUnlockNotice />
    </>
  )
}
