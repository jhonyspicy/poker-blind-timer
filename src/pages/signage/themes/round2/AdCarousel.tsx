import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { Prize } from '../../../../domain/types'
import styles from './AdCarousel.module.css'
import { ROUND2_AD_IMAGES } from './assets'
import { rankSuffix, round2AssetUrl, splitAmount } from './format'

/**
 * ブレイク画面右側の広告カルーセル(デザインモック Break Screen の移植)。
 * ドリンク広告 → プライズ一覧 → GTO Wizard の順にクロスフェードで切り替える。
 * soon(ブレイク終盤)の間は「まもなく再開」画像を最前面に出す。
 * 切り替えは表示だけの演出でタイマー進行に関与しないため、コンポーネント内のタイマーで回す
 */

/** 画像スライド 1 枚の表示時間 */
const IMAGE_SLIDE_MS = 8_000

/** GTO Wizard 広告の表示時間。広告内の QR コードをスマホで読み取る時間を確保するため長めにする */
const GTO_WIZARD_SLIDE_MS = 20_000

/** プライズ一覧のスクロール速度(px/秒)と、スクロール前後の静止時間 */
const PRIZE_SCROLL_PX_PER_SEC = 40
const PRIZE_HOLD_BEFORE_MS = 2_500
const PRIZE_HOLD_AFTER_MS = 5_000

type Slide = { kind: 'image'; src: string; durationMs: number } | { kind: 'prize' }

/** プライズ文を「 or 」で行に分ける(例: 「RSOPチケット5枚 or 30,000PT」→ 2 行) */
function prizeLines(description: string): { or: boolean; text: string }[] {
  return description
    .split(/\s+or\s+/i)
    .filter((text) => text.length > 0)
    .map((text, index) => ({ or: index > 0, text }))
}

function CrownIcon() {
  return (
    <svg width="96" height="80" viewBox="0 0 96 80" aria-hidden>
      <path d="M10 30 L28 50 L48 16 L68 50 L86 30 L80 64 H16 Z" fill="#fbecc2" />
      <circle cx="10" cy="26" r="7" fill="#fbecc2" />
      <circle cx="48" cy="11" r="7" fill="#fbecc2" />
      <circle cx="86" cy="26" r="7" fill="#fbecc2" />
      <rect x="18" y="70" width="60" height="7" rx="3" fill="#fbecc2" />
    </svg>
  )
}

function PrizeSlide({
  prizes,
  listRef,
}: {
  prizes: Prize[]
  listRef: RefObject<HTMLDivElement | null>
}) {
  const bgUrl = round2AssetUrl('images/ads/prize-bg.webp')
  return (
    <div
      className={styles.prizeSlide}
      style={{ backgroundImage: bgUrl === null ? undefined : `url(${bgUrl})` }}
    >
      <div className={styles.prizeHeading}>
        <div className={styles.prizeHeadingJa}>入賞プライズ</div>
        <div className={styles.prizeHeadingEn}>PRIZE LIST</div>
        <div className={styles.prizeHeadingRule} />
      </div>
      <div className={styles.prizeViewport}>
        <div ref={listRef} className={styles.prizeList}>
          {prizes.map((prize) => {
            const lines = prizeLines(prize.description)
            const multi = lines.length > 1
            const tier =
              prize.place === 1 ? styles.first : prize.place <= 3 ? styles.top : styles.rest
            return (
              <div key={prize.place} className={`${styles.prizeRow} ${tier}`}>
                <div className={styles.rankCell}>
                  {prize.place === 1 && <CrownIcon />}
                  <div className={styles.rank}>
                    <span className={styles.rankNumber}>{prize.place}</span>
                    <span className={styles.rankSuffix}>{rankSuffix(prize.place)}</span>
                  </div>
                </div>
                <div className={styles.rankDivider} />
                <div className={`${styles.lines} ${multi ? styles.linesMulti : ''}`}>
                  {lines.map((line, index) => {
                    const split = splitAmount(line.text)
                    return (
                      <div key={index} className={styles.line}>
                        {line.or && <span className={styles.lineOr}>or</span>}
                        <span className={styles.lineMain}>{split ? split.amount : line.text}</span>
                        {split && <span className={styles.lineUnit}>{split.unit}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function AdCarousel({ prizes, soon }: { prizes: Prize[]; soon: boolean }) {
  // 素材なし(404)の画像スライドは飛ばす。プライズ 0 件ならプライズ一覧を出さない
  const slides = useMemo<Slide[]>(() => {
    const image = (path: string, durationMs = IMAGE_SLIDE_MS): Slide[] => {
      const src = round2AssetUrl(path)
      return src === null ? [] : [{ kind: 'image', src, durationMs }]
    }
    return [
      ...ROUND2_AD_IMAGES.drinks.flatMap((path) => image(path)),
      ...(prizes.length > 0 ? [{ kind: 'prize' } as const] : []),
      ...image(ROUND2_AD_IMAGES.gtoWizard, GTO_WIZARD_SLIDE_MS),
    ]
  }, [prizes.length])
  const [slideIndex, setSlideIndex] = useState(0)
  const active = slides.length > 0 ? slideIndex % slides.length : 0
  const listRef = useRef<HTMLDivElement | null>(null)
  const soonUrl = round2AssetUrl('images/resume-soon.webp')

  // スクロール開始位置(下端)をフェードインの最初のフレームから適用するため、描画前に実行する
  useLayoutEffect(() => {
    if (slides.length === 0) return
    const next = () => setSlideIndex((index) => (index + 1) % slides.length)
    const slide = slides[active]
    let durationMs = slide.kind === 'image' ? slide.durationMs : IMAGE_SLIDE_MS
    let animation: Animation | null = null
    const list = listRef.current
    if (slide.kind === 'prize' && list?.parentElement) {
      // 一覧があふれる分だけ、下端(下位)から上端(1 位)へスクロールして見せる
      const distance = Math.max(0, list.scrollHeight - list.parentElement.clientHeight)
      if (distance > 0) {
        const scrollMs = (distance / PRIZE_SCROLL_PX_PER_SEC) * 1000
        durationMs = PRIZE_HOLD_BEFORE_MS + scrollMs + PRIZE_HOLD_AFTER_MS
        list.style.transform = `translateY(${-distance}px)`
        animation = list.animate(
          [
            { transform: `translateY(${-distance}px)`, offset: 0 },
            {
              transform: `translateY(${-distance}px)`,
              offset: PRIZE_HOLD_BEFORE_MS / durationMs,
              easing: 'ease-in-out',
            },
            { transform: 'translateY(0)', offset: (PRIZE_HOLD_BEFORE_MS + scrollMs) / durationMs },
            { transform: 'translateY(0)', offset: 1 },
          ],
          { duration: durationMs, fill: 'forwards' },
        )
      } else {
        list.style.transform = ''
      }
    }
    const timeout = window.setTimeout(next, durationMs)
    return () => {
      clearTimeout(timeout)
      animation?.cancel()
    }
  }, [active, slides])

  return (
    <div className={styles.carousel}>
      {slides.map((slide, index) => (
        <div
          key={slide.kind === 'image' ? slide.src : 'prize'}
          className={styles.slide}
          style={{ opacity: !soon && index === active ? 1 : 0 }}
        >
          {slide.kind === 'image' ? (
            <img className={styles.image} src={slide.src} alt="" />
          ) : (
            <PrizeSlide prizes={prizes} listRef={listRef} />
          )}
        </div>
      ))}
      {soonUrl !== null && (
        <div className={styles.slide} style={{ opacity: soon ? 1 : 0 }}>
          <img className={styles.image} src={soonUrl} alt="まもなく再開します" />
        </div>
      )}
    </div>
  )
}
