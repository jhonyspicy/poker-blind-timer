import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { Link } from 'react-router'
import { formatChips, formatClock } from '../../domain/format'
import { deriveStats } from '../../domain/stats'
import {
  currentBlindLevelNumber,
  isOnBreak,
  lateRegStatus,
  msUntilNextBreak,
  nextBlindLevel,
  remainingMs,
} from '../../domain/timer'
import type { SessionState, TournamentConfig } from '../../domain/types'
import styles from './SignagePage.module.css'
import { useSignageRealtime, type SignagePairing } from './useSignageRealtime'
import { useSignageSession, type SignageController } from './useSignageSession'

function toggleFullscreen() {
  if (document.fullscreenElement) {
    void document.exitFullscreen()
  } else {
    void document.documentElement.requestFullscreen()
  }
}

function SetupView({ controller }: { controller: SignageController }) {
  return (
    <main className={styles.setup}>
      <h1 className={styles.setupTitle}>サイネージ</h1>
      {controller.configs.length === 0 ? (
        <>
          <p>保存済みのトーナメント設定がありません。</p>
          <p>
            まず<Link to="/editor">エディタ</Link>で設定を作成・保存してください。
          </p>
        </>
      ) : (
        <>
          <p>開始するトーナメント設定を選択してください。</p>
          <ul className={styles.configList}>
            {controller.configs.map((config) => (
              <li key={config.id}>
                <span className={styles.configName}>
                  {config.title || '(無題)'} / {config.shopName || '(店名なし)'}
                </span>
                <button
                  type="button"
                  className={styles.startButton}
                  onClick={() => controller.start(config)}
                >
                  スタート
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}

function PairingOverlay({ pairing, onClose }: { pairing: SignagePairing; onClose: () => void }) {
  return (
    <div className={styles.qrOverlay}>
      <div className={styles.qrCard}>
        <h2>リモコン接続</h2>
        {pairing.error ? (
          <p className={styles.qrError}>接続の初期化に失敗しました: {pairing.error}</p>
        ) : pairing.remoteUrl ? (
          <>
            <QRCodeSVG value={pairing.remoteUrl} size={220} marginSize={2} />
            <div className={styles.qrUrl}>{pairing.remoteUrl}</div>
            <div className={styles.qrStatus}>
              スマホで QR コードを読み取るとリモコンとして操作できます
            </div>
          </>
        ) : (
          <p className={styles.qrStatus}>接続を準備しています…</p>
        )}
        <button type="button" className={styles.qrClose} onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  )
}

function BoardView({
  controller,
  config,
  session,
  pairing,
}: {
  controller: SignageController
  config: TournamentConfig
  session: SessionState
  pairing: SignagePairing
}) {
  const [showQR, setShowQR] = useState(pairing.configured)
  const { now } = controller
  const { structure } = config
  const timer = session.timer

  const finished = timer.status === 'finished'
  const paused = timer.status === 'paused'
  const onBreak = isOnBreak(timer, structure, now)
  const levelNumber = currentBlindLevelNumber(timer, structure, now)
  const currentItem = timer.status === 'finished' ? null : structure[timer.levelIndex]
  const currentBlind = currentItem?.kind === 'blind' ? currentItem : null
  const nextBlind = nextBlindLevel(timer, structure, now)
  const remaining = remainingMs(timer, structure, now)
  const breakMs = msUntilNextBreak(timer, structure, now)
  const lateReg = lateRegStatus(timer, structure, config.lateRegEndIndex, now)
  const stats = deriveStats(session.histories)
  const title = session.titleOverride ?? config.title

  const handleReset = () => {
    if (window.confirm('タイマーを終了して設定選択に戻りますか?')) {
      controller.reset()
    }
  }

  return (
    <div className={styles.board}>
      <header className={styles.header}>
        <span className={styles.shopName}>{config.shopName}</span>
        <span className={styles.tournamentTitle}>{title}</span>
        <span className={styles.headerButtons}>
          {pairing.configured && (
            <button type="button" className={styles.headerButton} onClick={() => setShowQR(true)}>
              QR
            </button>
          )}
          <button type="button" className={styles.headerButton} onClick={toggleFullscreen}>
            フルスクリーン
          </button>
          <button type="button" className={styles.headerButton} onClick={handleReset}>
            終了
          </button>
        </span>
      </header>

      <aside className={styles.prizes}>
        <div className={styles.sideHeading}>PRIZES</div>
        <ul className={styles.prizeList}>
          {config.prizes.map((prize) => (
            <li key={prize.place}>
              <span className={styles.prizePlace}>{prize.place} 位</span>
              <span>{prize.description}</span>
            </li>
          ))}
        </ul>
      </aside>

      <section className={styles.center}>
        {finished ? (
          <>
            <div className={styles.levelLabel}>TOURNAMENT</div>
            <div className={styles.clock}>終了</div>
          </>
        ) : onBreak ? (
          <>
            <div className={`${styles.levelLabel} ${styles.breakLabel}`}>BREAK</div>
            <div className={`${styles.clock} ${paused ? styles.pausedClock : ''}`}>
              {formatClock(remaining)}
            </div>
          </>
        ) : (
          <>
            <div className={styles.levelLabel}>LEVEL {levelNumber}</div>
            <div className={`${styles.clock} ${paused ? styles.pausedClock : ''}`}>
              {formatClock(remaining)}
            </div>
            {currentBlind && (
              <>
                <div className={styles.blinds}>
                  {formatChips(currentBlind.sb)} / {formatChips(currentBlind.bb)}
                </div>
                {currentBlind.ante > 0 && (
                  <div className={styles.ante}>Ante {formatChips(currentBlind.ante)}</div>
                )}
              </>
            )}
          </>
        )}
        {paused && <div className={styles.pausedBadge}>PAUSED</div>}
      </section>

      <aside className={styles.stats}>
        <div className={styles.sideHeading}>PLAYERS</div>
        <div className={styles.statItem}>
          <span>Current Players</span>
          <span className={styles.statValue}>{stats.currentPlayers}</span>
        </div>
        <div className={styles.statItem}>
          <span>Total Entries</span>
          <span className={styles.statValue}>{stats.totalEntries}</span>
        </div>
        {config.addonEnabled && (
          <div className={styles.statItem}>
            <span>Add-ons</span>
            <span className={styles.statValue}>{stats.addons}</span>
          </div>
        )}
        <div className={styles.statItem}>
          <span>Avg Stack</span>
          <span className={styles.statValue}>
            {stats.averageStack === null ? '-' : formatChips(stats.averageStack)}
          </span>
        </div>
      </aside>

      <footer className={styles.footer}>
        <div className={styles.footerItem}>
          <span className={styles.footerLabel}>NEXT BLINDS</span>
          <span className={styles.footerValue}>
            {nextBlind && nextBlind.kind === 'blind'
              ? `${formatChips(nextBlind.sb)} / ${formatChips(nextBlind.bb)}` +
                (nextBlind.ante > 0 ? ` (${formatChips(nextBlind.ante)})` : '')
              : '-'}
          </span>
        </div>
        <div className={styles.footerItem}>
          <span className={styles.footerLabel}>NEXT BREAK</span>
          <span className={styles.footerValue}>
            {onBreak ? 'ブレイク中' : breakMs === null ? '-' : formatClock(breakMs)}
          </span>
        </div>
        <div className={styles.footerItem}>
          <span className={styles.footerLabel}>LATE REG</span>
          <span
            className={`${styles.footerValue} ${lateReg.kind === 'closed' ? styles.footerClosed : ''}`}
          >
            {lateReg.kind === 'none'
              ? '-'
              : lateReg.kind === 'closed'
                ? '終了'
                : formatClock(lateReg.msUntilClose)}
          </span>
        </div>
      </footer>

      {showQR && <PairingOverlay pairing={pairing} onClose={() => setShowQR(false)} />}
    </div>
  )
}

export default function SignagePage() {
  const controller = useSignageSession()
  const pairing = useSignageRealtime(controller)

  if (controller.phase === 'loading') {
    return null
  }
  if (controller.phase !== 'active' || !controller.config || !controller.session) {
    return <SetupView controller={controller} />
  }
  return (
    <BoardView
      controller={controller}
      config={controller.config}
      session={controller.session}
      pairing={pairing}
    />
  )
}
