import { useEffect, useRef } from 'react'
import styles from './PauseTapeOverlay.module.css'

/**
 * 一時停止テープ(規制線)オーバーレイ。
 * 1920×1080 の論理座標で Canvas に描画し、CSS で親フレームいっぱいに引き伸ばす。
 * 親は 16:9 のコンテナ(TimerScreen の stage / BreakScreen の frame)を想定
 */

interface PauseFxState {
  mode: 'off' | 'in' | 'hold' | 'out'
  t0: number
  imp1: boolean
  imp2: boolean
  impT1: number
  impT2: number
  parts: {
    x: number
    y: number
    vx: number
    vy: number
    life: number
    age: number
    s: number
    c: string
  }[]
  pnow: number
}

export default function PauseTapeOverlay({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fxRef = useRef<PauseFxState>({
    mode: 'off',
    t0: 0,
    imp1: false,
    imp2: false,
    impT1: 0,
    impT2: 0,
    parts: [],
    pnow: 0,
  })

  // ---- 一時停止テープ演出のトリガ ----
  useEffect(() => {
    const P = fxRef.current
    const t = performance.now()
    if (paused && (P.mode === 'off' || P.mode === 'out')) {
      fxRef.current = { ...P, mode: 'in', t0: t, imp1: false, imp2: false, parts: [] }
    } else if (!paused && (P.mode === 'in' || P.mode === 'hold')) {
      fxRef.current = { ...P, mode: 'out', t0: t }
    }
  }, [paused])

  // ---- Canvas 描画ループ ----
  useEffect(() => {
    const pauseCanvas = canvasRef.current
    if (!pauseCanvas) return
    const pdpr = Math.min(devicePixelRatio || 1, 1.5)
    pauseCanvas.width = 1920 * pdpr
    pauseCanvas.height = 1080 * pdpr
    const pctx = pauseCanvas.getContext('2d')!
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches

    const drawTapeBody = (
      ctx: CanvasRenderingContext2D,
      len: number,
      h: number,
      kind: 'main' | 'hazard',
      punch: number,
      shimmer: number | null,
    ) => {
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,.6)'
      ctx.shadowBlur = 46
      ctx.shadowOffsetY = 20
      ctx.fillStyle = '#000'
      ctx.fillRect(-len / 2, -h / 2, len, h)
      ctx.restore()
      if (kind === 'hazard') {
        ctx.save()
        ctx.beginPath()
        ctx.rect(-len / 2, -h / 2, len, h)
        ctx.clip()
        ctx.fillStyle = '#191307'
        ctx.fillRect(-len / 2, -h / 2, len, h)
        ctx.fillStyle = '#e6b71e'
        for (let x = -len / 2 - h; x < len / 2 + h; x += 84) {
          ctx.beginPath()
          ctx.moveTo(x, h / 2)
          ctx.lineTo(x + 42, h / 2)
          ctx.lineTo(x + 42 + h, -h / 2)
          ctx.lineTo(x + h, -h / 2)
          ctx.closePath()
          ctx.fill()
        }
        ctx.fillStyle = 'rgba(255,255,255,.10)'
        ctx.fillRect(-len / 2, -h / 2, len, h * 0.28)
        ctx.restore()
        return
      }
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2)
      g.addColorStop(0, '#ffdd55')
      g.addColorStop(0.45, '#f7c81e')
      g.addColorStop(1, '#d29c08')
      ctx.fillStyle = g
      ctx.fillRect(-len / 2, -h / 2, len, h)
      const bh = h * 0.17
      const band = (yy: number) => {
        ctx.save()
        ctx.beginPath()
        ctx.rect(-len / 2, yy, len, bh)
        ctx.clip()
        ctx.fillStyle = '#15100a'
        ctx.fillRect(-len / 2, yy, len, bh)
        ctx.fillStyle = '#f2c522'
        for (let x = -len / 2 - bh * 2; x < len / 2 + bh * 2; x += 58) {
          ctx.beginPath()
          ctx.moveTo(x, yy + bh)
          ctx.lineTo(x + 26, yy + bh)
          ctx.lineTo(x + 26 + bh, yy)
          ctx.lineTo(x + bh, yy)
          ctx.closePath()
          ctx.fill()
        }
        ctx.restore()
      }
      band(-h / 2)
      band(h / 2 - bh)
      ctx.fillStyle = 'rgba(255,255,255,.12)'
      ctx.fillRect(-len / 2, -h / 2 + bh, len, h * 0.16)
      const fs = h * 0.5 * punch
      ctx.fillStyle = '#15100a'
      ctx.font = `900 ${fs}px "Noto Sans JP",sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const txt = '一 時 停 止 中'
      ctx.fillText(txt, 0, h * 0.03)
      const tw = ctx.measureText(txt).width
      const tri = (tx: number) => {
        const s = h * 0.24 * punch
        ctx.save()
        ctx.translate(tx, 0)
        ctx.beginPath()
        ctx.moveTo(0, -s)
        ctx.lineTo(s * 0.95, s * 0.72)
        ctx.lineTo(-s * 0.95, s * 0.72)
        ctx.closePath()
        ctx.lineJoin = 'round'
        ctx.lineWidth = s * 0.28
        ctx.strokeStyle = '#15100a'
        ctx.stroke()
        ctx.fillStyle = '#15100a'
        ctx.fill()
        ctx.fillStyle = '#f7c81e'
        ctx.font = `900 ${s * 1.15}px Oswald,sans-serif`
        ctx.fillText('!', 0, s * 0.16)
        ctx.restore()
      }
      tri(-tw / 2 - h * 0.42)
      tri(tw / 2 + h * 0.42)
      if (shimmer != null) {
        const x = -len / 2 + shimmer * len
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const sg = ctx.createLinearGradient(x - 130, 0, x + 130, 0)
        sg.addColorStop(0, 'rgba(255,255,255,0)')
        sg.addColorStop(0.5, 'rgba(255,255,240,.38)')
        sg.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = sg
        ctx.save()
        ctx.transform(1, 0, -0.35, 1, 0, 0)
        ctx.fillRect(x - 130, -h / 2, 260, h)
        ctx.restore()
        ctx.restore()
      }
    }

    const drawPause = (nowMs: number) => {
      const P = fxRef.current
      pctx.setTransform(pdpr, 0, 0, pdpr, 0, 0)
      pctx.clearRect(0, 0, 1920, 1080)
      if (P.mode === 'off') return
      const t = (nowMs - P.t0) / 1000
      const FLY = 0.26
      const D2 = 0.14
      let dim = 0
      let shake = 0
      let punch = 1
      let shimmer: number | null = null
      let x1 = 0
      let x2 = 0
      let alpha = 1
      if (rm) {
        if (P.mode === 'out') {
          alpha = Math.max(0, 1 - t / 0.3)
          if (alpha === 0) {
            P.mode = 'off'
            return
          }
        } else alpha = Math.min(1, t / 0.3)
        dim = 0.45 * alpha
      } else if (P.mode === 'in' || P.mode === 'hold') {
        const off = (delay: number, from: number) => {
          const tt = t - delay
          if (tt < 0) return from
          if (tt < FLY) {
            const p = tt / FLY
            return from * (1 - p * p * (3 - 2 * p))
          }
          const d = tt - FLY
          return -Math.sign(from) * 110 * Math.exp(-d * 8) * Math.cos(d * 21)
        }
        x1 = off(0, 2600)
        x2 = off(D2, -2600)
        if (!P.imp1 && t >= FLY) {
          P.imp1 = true
          P.impT1 = t
          for (let i = 0; i < 52; i++) {
            const px = (Math.random() - 0.5) * 1500
            const ang = -0.1
            P.parts.push({
              x: 960 + Math.cos(ang) * px,
              y: 540 + Math.sin(ang) * px + (Math.random() - 0.5) * 60,
              vx: (Math.random() - 0.5) * 900,
              vy: -Math.random() * 700 - 100,
              life: 0.55 + Math.random() * 0.4,
              age: 0,
              s: 2 + Math.random() * 3.5,
              c: Math.random() < 0.6 ? '255,214,90' : '255,255,235',
            })
          }
        }
        if (!P.imp2 && t >= D2 + FLY) {
          P.imp2 = true
          P.impT2 = t
        }
        if (P.imp1) {
          const d = t - P.impT1
          shake += 30 * Math.exp(-d * 9)
          punch = 1 + 0.22 * Math.exp(-d * 7)
        }
        if (P.imp2) {
          const d = t - P.impT2
          shake += 14 * Math.exp(-d * 9)
        }
        dim = Math.min(1, t / 0.3) * 0.48
        if (t > 1.4 && P.mode === 'in') P.mode = 'hold'
        if (P.mode === 'hold') {
          const ht = nowMs / 1000
          const sh = ((ht % 3.2) / 3.2) * 1.6 - 0.3
          shimmer = sh < 0 || sh > 1 ? null : sh
        }
      } else {
        const back = Math.min(1, t / 0.14)
        const anticipate = -80 * back * (2 - back)
        const p = Math.max(0, (t - 0.14) / 0.55)
        const e = p * p * p
        x1 = -anticipate + -2800 * e
        x2 = anticipate + 2800 * e
        dim = 0.48 * Math.max(0, 1 - t / 0.6)
        if (t > 0.8) {
          P.mode = 'off'
          return
        }
      }
      pctx.fillStyle = `rgba(0,0,0,${dim})`
      pctx.fillRect(0, 0, 1920, 1080)
      pctx.save()
      if (shake > 0.5)
        pctx.translate(Math.sin(nowMs * 0.13) * shake, Math.cos(nowMs * 0.17) * shake * 0.7)
      pctx.globalAlpha = alpha
      pctx.save()
      pctx.translate(960 + x2, 630)
      pctx.rotate(0.13)
      drawTapeBody(pctx, 2400, 86, 'hazard', 1, null)
      pctx.restore()
      pctx.save()
      pctx.translate(960 + x1, 520)
      pctx.rotate(-0.1)
      if (P.mode === 'in' && !rm && Math.abs(x1) > 140) {
        for (let k = 1; k <= 3; k++) {
          pctx.save()
          pctx.globalAlpha = 0.14 / k
          pctx.translate(Math.sign(x1) * k * 120, 0)
          drawTapeBody(pctx, 2500, 210, 'main', 1, null)
          pctx.restore()
        }
      }
      drawTapeBody(pctx, 2500, 210, 'main', punch, shimmer)
      pctx.restore()
      if (P.parts.length) {
        const dt = Math.min(0.033, (nowMs - (P.pnow || nowMs)) / 1000)
        pctx.globalCompositeOperation = 'lighter'
        for (const q of P.parts) {
          q.age += dt
          if (q.age > q.life) continue
          q.x += q.vx * dt
          q.y += q.vy * dt
          q.vy += 1600 * dt
          const a = 1 - q.age / q.life
          pctx.fillStyle = `rgba(${q.c},${a})`
          pctx.beginPath()
          pctx.arc(q.x, q.y, q.s * a, 0, 7)
          pctx.fill()
        }
        P.parts = P.parts.filter((q) => q.age <= q.life)
        pctx.globalCompositeOperation = 'source-over'
      }
      P.pnow = nowMs
      pctx.restore()
    }

    let rafId: number
    const loop = (t: number) => {
      drawPause(t)
      rafId = requestAnimationFrame(loop)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return <canvas ref={canvasRef} className={styles.pauseCanvas} />
}
