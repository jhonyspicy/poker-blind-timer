import { useEffect, useId, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { buildRemoteUrl } from '../../realtime/connection'
import styles from './RemoteQrButton.module.css'

/**
 * QR を開いたままにできる上限。運営者が閉じ忘れても、一般客の目に触れ続けて
 * 誤って読み取られないよう自動で閉じる
 */
const AUTO_CLOSE_MS = 60_000

/**
 * リモコン用 URL の QR コードを再表示するボタン(画面右上)。
 * タイマー起動後にリモコンのスマホを閉じてしまい操作用 URL が分からなくなった場合の
 * 救済手段。一般客が誤って読み取らないよう、QR はボタンを押したときだけ表示する
 */
export default function RemoteQrButton({ channelId }: { channelId: string }) {
  const [open, setOpen] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    const timeoutId = window.setTimeout(close, AUTO_CLOSE_MS)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(timeoutId)
    }
  }, [open])

  const remoteUrl = buildRemoteUrl(channelId)
  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="リモコン接続用の QR コードを表示"
        title="リモコン接続用の QR コードを表示"
      >
        <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm8-2h3v3h-3v-3zm5 0h3v3h-3v-3zm-5 5h3v3h-3v-3zm5 0h3v3h-3v-3zm-2.5-2.5h3v3h-3v-3z"
          />
        </svg>
      </button>
      {open && (
        <div className={styles.backdrop} onClick={() => setOpen(false)}>
          <div
            className={styles.card}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id={titleId} className={styles.title}>
              リモコン接続
            </h2>
            <div className={styles.qrBox}>
              <QRCodeSVG value={remoteUrl} size={320} marginSize={2} />
            </div>
            <p className={styles.hint}>スマホで QR コードを読み取るとリモコンとして操作できます</p>
            <p className={styles.url}>{remoteUrl}</p>
            <button type="button" className={styles.close} onClick={() => setOpen(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </>
  )
}
