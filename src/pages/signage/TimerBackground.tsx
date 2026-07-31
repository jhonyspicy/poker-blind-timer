import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import styles from './ChipFloatBackground.module.css'

/**
 * タイマー画面の背景: メカニカルリング・HUD ライン・床・チップ・パーティクルの
 * WebGL 演出(デザインモック poker-timer-bg.html の移植)。
 * levelUp() でリング加速+照り返し+ライン一斉発光のブーストが掛かる
 */

export interface TimerBackgroundHandle {
  levelUp: () => void
}

const CONFIG = {
  glowIntensity: 0.4,
  ringOpacity: 0.22,
  ringRotationSpeed: 0.00015,
  lineOpacity: 0.24,
  pulseInterval: 6.0,
  particleCount: 18,
  cameraMotion: 0.06,
  chipCount: 6,
  floorOpacity: 0.32,
  reflectionIntensity: 0.22,
  flareEnabled: true,
  maxPixelRatio: 2,
}

const GOLD = new THREE.Color(0xc9a24b)
const GOLD_BRIGHT = new THREE.Color(0xe8c56a)
const BRONZE = new THREE.Color(0x7a5c28)

const TimerBackground = forwardRef<TimerBackgroundHandle>(function TimerBackground(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const boostStartRef = useRef(-100)
  const elapsedRef = useRef(0)
  const pulsesRef = useRef<
    {
      mesh: THREE.Mesh
      seg: { x1: number; y1: number; x2: number; y2: number }
      next: number
      t: number
    }[]
  >([])

  useImperativeHandle(ref, () => ({
    levelUp: () => {
      boostStartRef.current = elapsedRef.current
      pulsesRef.current.forEach((p, i) => {
        ;(p.mesh.material as THREE.MeshBasicMaterial).opacity = 0
        p.t = -0.001 - i * 0.02
        p.next = i * 0.06
      })
    },
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x050403, 1)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(0, 0, 10)
    const clock = new THREE.Clock()

    // --- 背景空間: ビネット + 黒→濃茶→金のグラデーション ---
    const bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      uniforms: { uIntensity: { value: CONFIG.glowIntensity } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform float uIntensity;
        void main(){
          vec2 p = vUv - 0.5; p.x *= 1.7778;
          float d = length(p);
          vec3 center = vec3(0.012, 0.009, 0.006);
          vec3 warm = vec3(0.10, 0.066, 0.028) * uIntensity;
          vec3 edge = vec3(0.004, 0.003, 0.002);
          float midBand = smoothstep(0.18, 0.55, d) * (1.0 - smoothstep(0.55, 1.0, d));
          vec3 col = mix(center, warm, midBand * 0.55);
          col = mix(col, edge, smoothstep(0.6, 1.05, d));
          float bottom = smoothstep(0.15, -0.45, p.y) * (1.0 - smoothstep(0.0, 0.9, abs(p.x)));
          col += vec3(0.055, 0.036, 0.014) * bottom * uIntensity;
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), bgMat)
    bg.position.z = -8
    scene.add(bg)

    // --- 中央の円形メカニカルリング(内外で逆回転) ---
    const ringGroups: { g: THREE.Group; speed: number }[] = []
    const ringMat = (opacity: number, color: THREE.Color = GOLD) =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: (opacity * CONFIG.ringOpacity) / 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    const arc = (
      inner: number,
      outer: number,
      start: number,
      length: number,
      opacity: number,
      color?: THREE.Color,
    ) =>
      new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 96, 1, start, length),
        ringMat(opacity, color),
      )
    const ticks = (radius: number, count: number, w: number, h: number, opacity: number) => {
      const group = new THREE.Group()
      const mat = ringMat(opacity)
      const geo = new THREE.PlaneGeometry(w, h)
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const m = new THREE.Mesh(geo, mat)
        m.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0)
        m.rotation.z = a + Math.PI / 2
        group.add(m)
      }
      return group
    }
    {
      const hub = new THREE.Group()
      hub.position.set(0, 0.1, -1.5)
      hub.scale.set(1.15, 1.15, 1)
      const outer = new THREE.Group()
      outer.add(arc(4.35, 4.4, 0, Math.PI * 2, 0.22, BRONZE))
      outer.add(arc(4.05, 4.22, 0.3, 1.6, 0.3))
      outer.add(arc(4.05, 4.22, Math.PI + 0.3, 1.6, 0.3))
      outer.add(arc(4.05, 4.1, 2.2, 0.7, 0.45, GOLD_BRIGHT))
      outer.add(arc(4.05, 4.1, 5.4, 0.7, 0.45, GOLD_BRIGHT))
      outer.add(ticks(4.55, 72, 0.015, 0.1, 0.28))
      outer.add(ticks(4.72, 12, 0.03, 0.2, 0.4))
      hub.add(outer)
      const mid = new THREE.Group()
      mid.add(arc(3.55, 3.58, 0, Math.PI * 2, 0.18, BRONZE))
      mid.add(arc(3.62, 3.72, 0.9, 1.1, 0.32))
      mid.add(arc(3.62, 3.72, Math.PI + 0.9, 1.1, 0.32))
      mid.add(arc(3.3, 3.46, 4.5, 0.5, 0.26, BRONZE))
      mid.add(arc(3.3, 3.46, 1.35, 0.5, 0.26, BRONZE))
      mid.add(ticks(3.5, 48, 0.012, 0.07, 0.22))
      hub.add(mid)
      const inner = new THREE.Group()
      inner.add(arc(2.95, 2.97, 0, Math.PI * 2, 0.16, BRONZE))
      inner.add(arc(2.78, 2.86, 2.0, 0.9, 0.24))
      inner.add(arc(2.78, 2.86, Math.PI + 2.0, 0.9, 0.24))
      hub.add(inner)
      scene.add(hub)
      ringGroups.push({ g: outer, speed: 1.0 }, { g: mid, speed: -1.4 }, { g: inner, speed: 0.6 })
    }

    // --- ゴールドライン(HUD 風・左右対称)+流れる光 ---
    const pulses = pulsesRef.current
    pulses.length = 0
    {
      const group = new THREE.Group()
      group.position.z = -2
      const mat = new THREE.MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: CONFIG.lineOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const dim = new THREE.MeshBasicMaterial({
        color: BRONZE,
        transparent: true,
        opacity: CONFIG.lineOpacity * 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const segs: { x1: number; y1: number; x2: number; y2: number }[] = []
      const line = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        m: THREE.MeshBasicMaterial = mat,
        record = false,
      ) => {
        const dx = x2 - x1
        const dy = y2 - y1
        const len = Math.hypot(dx, dy)
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.014), m)
        mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0)
        mesh.rotation.z = Math.atan2(dy, dx)
        group.add(mesh)
        if (record) segs.push({ x1, y1, x2, y2 })
      }
      const sym = (
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        m?: THREE.MeshBasicMaterial,
        record?: boolean,
      ) => {
        line(x1, y1, x2, y2, m, record)
        line(-x1, y1, -x2, y2, m, record)
      }
      sym(5.2, 2.1, 7.0, 2.1, mat, true)
      sym(7.3, 2.1, 8.4, 2.1, dim)
      sym(7.0, 2.1, 7.6, 2.7, dim)
      sym(5.4, 0.6, 8.8, 0.6, mat, true)
      sym(5.4, 0.6, 4.9, 1.1, dim)
      sym(6.3, 0.45, 8.0, 0.45, dim)
      sym(5.2, -1.2, 6.8, -1.2, mat, true)
      sym(7.1, -1.2, 8.5, -1.2, dim)
      sym(6.8, -1.2, 7.4, -1.8, dim)
      sym(5.2, 1.9, 5.2, 2.3, dim)
      sym(8.8, 0.45, 8.8, 0.75, dim)
      scene.add(group)
      const pulseGeo = new THREE.PlaneGeometry(0.55, 0.03)
      for (const s of segs) {
        const pm = new THREE.MeshBasicMaterial({
          color: GOLD_BRIGHT,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const p = new THREE.Mesh(pulseGeo, pm)
        p.rotation.z = Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
        group.add(p)
        pulses.push({ mesh: p, seg: s, next: Math.random() * CONFIG.pulseInterval * 2, t: -1 })
      }
    }
    const updatePulses = (dt: number) => {
      for (const p of pulses) {
        const m = p.mesh.material as THREE.MeshBasicMaterial
        if (p.t < 0) {
          p.next -= dt
          if (p.next <= 0) p.t = 0
          continue
        }
        p.t += dt / 2.6
        if (p.t >= 1) {
          p.t = -1
          p.next = CONFIG.pulseInterval * (0.7 + Math.random() * 1.6)
          m.opacity = 0
          continue
        }
        const s = p.seg
        p.mesh.position.set(s.x1 + (s.x2 - s.x1) * p.t, s.y1 + (s.y2 - s.y1) * p.t, 0.01)
        m.opacity = Math.sin(p.t * Math.PI) * 0.5 * CONFIG.glowIntensity
      }
    }

    // --- 床: 幾何学模様 + 金色反射 ---
    const makeFloorTexture = () => {
      const c = document.createElement('canvas')
      c.width = c.height = 1024
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, 1024, 1024)
      const cx = 512
      const cy = 512
      ctx.strokeStyle = 'rgba(201,162,75,0.55)'
      ctx.lineWidth = 2
      ;[140, 230, 330, 440].forEach((r, i) => {
        ctx.beginPath()
        ctx.setLineDash(i % 2 ? [40, 26] : [])
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.globalAlpha = 0.9 - i * 0.15
        ctx.stroke()
      })
      ctx.setLineDash([])
      ctx.globalAlpha = 0.5
      const hex = (r: number) => {
        ctx.beginPath()
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6
          const x = cx + Math.cos(a) * r
          const y = cy + Math.sin(a) * r
          if (i) ctx.lineTo(x, y)
          else ctx.moveTo(x, y)
        }
        ctx.stroke()
      }
      hex(290)
      hex(480)
      ctx.globalAlpha = 0.3
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(cx + Math.cos(a) * 150, cy + Math.sin(a) * 150)
        ctx.lineTo(cx + Math.cos(a) * 470, cy + Math.sin(a) * 470)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      const tex = new THREE.CanvasTexture(c)
      tex.anisotropy = 4
      return tex
    }
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({
        map: makeFloorTexture(),
        transparent: true,
        opacity: CONFIG.floorOpacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.set(0, -3.4, 2)
    scene.add(floor)

    const floorGlowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uOpacity: { value: CONFIG.reflectionIntensity } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform float uOpacity;
        void main(){
          vec2 p = vUv - 0.5;
          float f = exp(-dot(p*vec2(2.4,5.0), p*vec2(2.4,5.0)) * 4.0);
          gl_FragColor = vec4(vec3(0.79,0.63,0.29) * f * uOpacity, f * uOpacity);
        }`,
    })
    const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2), floorGlowMat)
    floorGlow.rotation.x = -Math.PI / 2
    floorGlow.position.set(0, -3.35, 5.5)
    scene.add(floorGlow)

    // --- ポーカーチップ(左右下部に少数) ---
    const chips: { mesh: THREE.Mesh; baseY: number; phase: number }[] = []
    {
      const top = document.createElement('canvas')
      top.width = top.height = 256
      const t = top.getContext('2d')!
      t.fillStyle = '#0a0805'
      t.beginPath()
      t.arc(128, 128, 126, 0, Math.PI * 2)
      t.fill()
      t.strokeStyle = '#c9a24b'
      t.lineWidth = 5
      t.beginPath()
      t.arc(128, 128, 118, 0, Math.PI * 2)
      t.stroke()
      t.lineWidth = 2
      t.beginPath()
      t.arc(128, 128, 78, 0, Math.PI * 2)
      t.stroke()
      t.fillStyle = '#c9a24b'
      for (let i = 0; i < 6; i++) {
        t.save()
        t.translate(128, 128)
        t.rotate((i / 6) * Math.PI * 2)
        t.fillRect(-14, -122, 28, 30)
        t.restore()
      }
      const side = document.createElement('canvas')
      side.width = 512
      side.height = 64
      const s = side.getContext('2d')!
      s.fillStyle = '#0a0805'
      s.fillRect(0, 0, 512, 64)
      s.fillStyle = '#c9a24b'
      for (let i = 0; i < 6; i++) s.fillRect(i * 85 + 20, 0, 42, 64)
      const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.09, 48)
      const matSide = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(side),
        color: 0x8a7040,
      })
      const matFace = new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(top),
        color: 0x8a7040,
      })
      const mats = [matSide, matFace, matFace]
      const placements = [
        { x: -4.4, y: -3.0, z: 3.0, stack: 2 },
        { x: -3.8, y: -3.1, z: 3.6, stack: 1 },
        { x: 4.3, y: -3.0, z: 3.2, stack: 2 },
        { x: 3.7, y: -3.15, z: 3.8, stack: 1 },
        { x: -4.9, y: -2.8, z: 2.2, stack: 1 },
        { x: 4.95, y: -2.85, z: 2.4, stack: 1 },
      ]
      let placed = 0
      for (const p of placements) {
        if (placed >= CONFIG.chipCount) break
        for (let i = 0; i < p.stack && placed < CONFIG.chipCount; i++) {
          const chip = new THREE.Mesh(geo, mats)
          chip.position.set(p.x + (Math.random() - 0.5) * 0.1, p.y + i * 0.095, p.z)
          chip.rotation.y = Math.random() * Math.PI
          chip.rotation.x = (Math.random() - 0.5) * 0.12
          scene.add(chip)
          chips.push({ mesh: chip, baseY: chip.position.y, phase: Math.random() * Math.PI * 2 })
          placed++
        }
      }
    }

    // --- レンズフレア風の淡い光 ---
    let flare: THREE.Sprite | null = null
    if (CONFIG.flareEnabled) {
      const c = document.createElement('canvas')
      c.width = c.height = 128
      const ctx = c.getContext('2d')!
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
      g.addColorStop(0, 'rgba(232,197,106,0.8)')
      g.addColorStop(0.25, 'rgba(201,162,75,0.25)')
      g.addColorStop(1, 'rgba(201,162,75,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 128, 128)
      flare = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: new THREE.CanvasTexture(c),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      flare.scale.set(1.4, 1.4, 1)
      flare.position.set(4.4, 2.1, -1)
      scene.add(flare)
    }

    // --- パーティクル(金色の埃) ---
    const particleData: { x: number; y: number; z: number; vy: number; sway: number }[] = []
    const pos = new Float32Array(CONFIG.particleCount * 3)
    for (let i = 0; i < CONFIG.particleCount; i++) {
      const sideSign = Math.random() < 0.5 ? -1 : 1
      const x = sideSign * (3.0 + Math.random() * 5.5)
      const y = -3 + Math.random() * 5.5
      const z = -1 + Math.random() * 3
      pos.set([x, y, z], i * 3)
      particleData.push({
        x,
        y,
        z,
        vy: 0.03 + Math.random() * 0.05,
        sway: Math.random() * Math.PI * 2,
      })
    }
    const particleGeo = new THREE.BufferGeometry()
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const particleMat = new THREE.PointsMaterial({
      color: GOLD_BRIGHT,
      size: 0.045,
      transparent: true,
      opacity: 0.55 * CONFIG.glowIntensity,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const particles = new THREE.Points(particleGeo, particleMat)
    scene.add(particles)

    // --- アニメーションループ ---
    let rafId: number | null = null
    const baseOpacities = new Map<THREE.Material, number>()
    const animate = () => {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.1)
      elapsedRef.current += dt
      const t = elapsedRef.current

      // LEVEL UP ブースト: 素早く立ち上がり約 2.5 秒で減衰
      const bt = t - boostStartRef.current
      const boost = bt >= 0 ? Math.min(1, bt * 8) * Math.exp(-bt / 1.4) : 0

      for (const r of ringGroups) {
        r.g.rotation.z += CONFIG.ringRotationSpeed * r.speed * dt * 60 * (1 + boost * 110)
        r.g.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const m = o.material as THREE.MeshBasicMaterial
            if (!baseOpacities.has(m)) baseOpacities.set(m, m.opacity)
            m.opacity = Math.min(1, baseOpacities.get(m)! * (1 + boost * 5))
          }
        })
      }
      updatePulses(dt)

      const posAttr = particleGeo.attributes.position
      for (let i = 0; i < particleData.length; i++) {
        const d = particleData[i]
        d.y += d.vy * dt
        if (d.y > 3.2) d.y = -3.3
        posAttr.setXYZ(i, d.x + Math.sin(t * 0.3 + d.sway) * 0.25, d.y, d.z)
      }
      posAttr.needsUpdate = true
      particleMat.opacity = Math.min(1, 0.55 * CONFIG.glowIntensity * (1 + boost * 4.5))

      if (flare) {
        const cycle = (t % 34) / 34
        const vis = Math.max(0, Math.sin(cycle * Math.PI * 2)) ** 3
        const fb = boost
        const m = flare.material
        m.opacity = Math.min(1, vis * 0.35 * CONFIG.glowIntensity + fb * 0.85)
        flare.scale.setScalar(1.4 + fb * 3.2)
        const sideSign = Math.floor(t / 34) % 2 === 0 ? 1 : -1
        flare.position.x = sideSign * (4.2 + Math.sin(t * 0.05) * 0.6)
        flare.position.y = 2.0 + Math.cos(t * 0.04) * 0.3
      }

      for (const c of chips) {
        c.mesh.position.y = c.baseY + Math.sin(t * 0.5 + c.phase) * 0.012
        c.mesh.rotation.y += 0.0004
      }
      floorGlowMat.uniforms.uOpacity.value =
        CONFIG.reflectionIntensity * (0.85 + Math.sin(t * 0.23) * 0.15) * (1 + boost * 7)

      camera.position.z = 10 + Math.sin(t * 0.12) * CONFIG.cameraMotion
      camera.position.y = Math.sin(t * 0.08) * CONFIG.cameraMotion * 0.4
      camera.lookAt(0, 0, 0)
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio))
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', onResize)

    // ページ非表示時は描画を停止して負荷を下げる
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
      } else if (rafId === null) {
        clock.getDelta()
        animate()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      pulsesRef.current = []
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose()
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of mats) {
            if ('map' in m && m.map instanceof THREE.Texture) m.map.dispose()
            m.dispose()
          }
        }
      })
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.canvas} />
})

export default TimerBackground
