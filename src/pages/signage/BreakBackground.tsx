import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import styles from './BreakScreen.module.css'

/**
 * ブレイク画面の背景: チップスタックが並ぶ 3D シーン(デザインモックの移植)。
 * スポットライトの影・環境マップ反射・ゆっくりした回転とカメラの揺れで
 * 落ち着いた実写風の背景を作る。上に暗幕グラデーションを重ねる前提
 */

interface ChipDesign {
  base: string
  inlay: string
  spot: string
  metal: number
  rough: number
}

const DESIGNS: ChipDesign[] = [
  { base: '#a5122a', inlay: '#f6f1e6', spot: '#f6f1e6', metal: 0.08, rough: 0.3 },
  { base: '#0d2f66', inlay: '#eaf0f8', spot: '#eaf0f8', metal: 0.08, rough: 0.3 },
  { base: '#7d0f22', inlay: '#f2ded9', spot: '#f2ded9', metal: 0.08, rough: 0.3 },
  { base: '#12203a', inlay: '#cfa758', spot: '#cfa758', metal: 0.16, rough: 0.28 },
  { base: '#b98f3f', inlay: '#3a2c12', spot: '#f6e6bd', metal: 0.68, rough: 0.22 },
  { base: '#1a1c20', inlay: '#d8dde4', spot: '#d8dde4', metal: 0.12, rough: 0.3 },
]

function faceTexture(d: ChipDesign): THREE.CanvasTexture {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const r = S / 2
  g.fillStyle = d.base
  g.fillRect(0, 0, S, S)
  // 外周のエッジスポット(矩形インレイ)
  g.save()
  g.translate(r, r)
  for (let i = 0; i < 8; i++) {
    g.save()
    g.rotate((i * Math.PI) / 4)
    g.fillStyle = d.spot
    g.fillRect(-24, -r + 5, 48, 46)
    g.restore()
  }
  g.restore()
  // 同心円リング
  const ring = (rad: number, w: number, col: string, alpha: number) => {
    g.beginPath()
    g.arc(r, r, rad, 0, Math.PI * 2)
    g.strokeStyle = col
    g.globalAlpha = alpha
    g.lineWidth = w
    g.stroke()
    g.globalAlpha = 1
  }
  ring(r - 3, 6, '#000', 0.35)
  ring(r - 74, 5, d.inlay, 0.9)
  ring(r - 88, 2, '#000', 0.25)
  // 破線の内リング
  g.save()
  g.translate(r, r)
  for (let i = 0; i < 24; i++) {
    g.save()
    g.rotate((i * Math.PI) / 12)
    g.globalAlpha = 0.35
    g.fillStyle = d.inlay
    g.fillRect(-3, -r + 108, 6, 16)
    g.restore()
  }
  g.restore()
  // 中央メダリオン
  g.beginPath()
  g.arc(r, r, 118, 0, Math.PI * 2)
  g.fillStyle = d.inlay
  g.fill()
  g.beginPath()
  g.arc(r, r, 104, 0, Math.PI * 2)
  g.fillStyle = d.base
  g.fill()
  g.beginPath()
  g.arc(r, r, 96, 0, Math.PI * 2)
  g.strokeStyle = d.inlay
  g.globalAlpha = 0.6
  g.lineWidth = 3
  g.stroke()
  g.globalAlpha = 1
  g.save()
  g.translate(r, r)
  g.rotate(Math.PI / 4)
  g.fillStyle = d.inlay
  g.globalAlpha = 0.85
  g.fillRect(-34, -34, 68, 68)
  g.globalAlpha = 1
  g.restore()
  // 立体感のためのラジアルシェーディング
  const sh = g.createRadialGradient(r * 0.6, r * 0.55, 20, r, r, r)
  sh.addColorStop(0, 'rgba(255,255,255,0.14)')
  sh.addColorStop(0.65, 'rgba(0,0,0,0)')
  sh.addColorStop(1, 'rgba(0,0,0,0.4)')
  g.fillStyle = sh
  g.fillRect(0, 0, S, S)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function edgeTexture(d: ChipDesign): THREE.CanvasTexture {
  const W = 1024
  const H = 64
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = d.base
  g.fillRect(0, 0, W, H)
  const n = 8
  const seg = W / n
  for (let i = 0; i < n; i++) {
    g.fillStyle = d.spot
    g.fillRect(i * seg + seg * 0.34, 0, seg * 0.3, H)
  }
  // 上下の溝の陰影(削り出しのリムらしく見せる)
  const gr = g.createLinearGradient(0, 0, 0, H)
  gr.addColorStop(0, 'rgba(0,0,0,0.55)')
  gr.addColorStop(0.18, 'rgba(255,255,255,0.12)')
  gr.addColorStop(0.5, 'rgba(0,0,0,0.1)')
  gr.addColorStop(0.82, 'rgba(255,255,255,0.1)')
  gr.addColorStop(1, 'rgba(0,0,0,0.6)')
  g.fillStyle = gr
  g.fillRect(0, 0, W, H)
  const t = new THREE.CanvasTexture(c)
  t.anisotropy = 8
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  // 暖色の頭上ランプ+寒色のサイドライトを描いた等距円筒テクスチャから
  // 環境マップを作る(チップの反射に効く)
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 512)
  grad.addColorStop(0, '#1b2530')
  grad.addColorStop(0.45, '#0c1014')
  grad.addColorStop(1, '#05070a')
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 512)
  const lamp = g.createRadialGradient(300, 120, 10, 300, 120, 300)
  lamp.addColorStop(0, 'rgba(255,226,178,1)')
  lamp.addColorStop(1, 'rgba(255,226,178,0)')
  g.fillStyle = lamp
  g.fillRect(0, 0, 1024, 512)
  const cool = g.createRadialGradient(820, 210, 10, 820, 210, 260)
  cool.addColorStop(0, 'rgba(150,196,255,0.85)')
  cool.addColorStop(1, 'rgba(150,196,255,0)')
  g.fillStyle = cool
  g.fillRect(0, 0, 1024, 512)
  const tex = new THREE.CanvasTexture(c)
  tex.mapping = THREE.EquirectangularReflectionMapping
  tex.colorSpace = THREE.SRGBColorSpace
  const rt = new THREE.WebGLCubeRenderTarget(256)
  rt.fromEquirectangularTexture(renderer, tex)
  tex.dispose()
  return rt.texture
}

export default function BreakBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x06080a, 18, 52)
    scene.environment = buildEnvironment(renderer)

    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 200)
    camera.position.set(0, 5.2, 20)
    camera.lookAt(0, 1.4, 0)

    scene.add(new THREE.HemisphereLight(0x8fa6b8, 0x07090a, 0.35))
    const key = new THREE.SpotLight(0xfff1d8, 16, 70, 0.9, 0.4, 1.3)
    key.position.set(-11, 17, 10)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.bias = -0.0008
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x8fc0ff, 1.7)
    rim.position.set(13, 4.5, -10)
    scene.add(rim)
    const warm = new THREE.PointLight(0xff9a4d, 6, 26, 2)
    warm.position.set(7, 2.4, 7)
    scene.add(warm)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.ShadowMaterial({ opacity: 0.55 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true

    const mats = DESIGNS.map((d) => [
      new THREE.MeshPhysicalMaterial({
        map: edgeTexture(d),
        roughness: d.rough + 0.12,
        metalness: d.metal,
        clearcoat: 0.5,
        clearcoatRoughness: 0.35,
        envMapIntensity: 1.1,
      }),
      new THREE.MeshPhysicalMaterial({
        map: faceTexture(d),
        roughness: d.rough,
        metalness: d.metal,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.35,
      }),
      new THREE.MeshPhysicalMaterial({
        map: faceTexture(d),
        roughness: d.rough,
        metalness: d.metal,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.35,
      }),
    ])

    const group = new THREE.Group()
    const H = 0.17
    const body = new THREE.CylinderGeometry(1, 1, H, 64, 1, false)
    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    const addChip = (design: number, x: number, y: number, z: number, tilt: boolean) => {
      const chip = new THREE.Mesh(body, mats[design])
      chip.position.set(x, y, z)
      chip.rotation.y = rand(0, Math.PI * 2)
      chip.rotation.x = tilt ? rand(-0.02, 0.02) : 0
      chip.rotation.z = tilt ? rand(-0.02, 0.02) : 0
      chip.castShadow = true
      chip.receiveShadow = true
      group.add(chip)
    }

    const stack = (d: number, x: number, z: number, count: number) => {
      for (let c = 0; c < count; c++) {
        addChip(
          Math.random() < 0.1 ? (d + 4) % DESIGNS.length : d,
          x + rand(-0.035, 0.035),
          c * (H + 0.004) + H / 2,
          z + rand(-0.035, 0.035),
          true,
        )
      }
    }

    // スタックはリジェクションサンプリングで配置し、隣とめり込まないようにする
    const MIN = 2.12
    const placed: { x: number; z: number }[] = []
    const free = (x: number, z: number) =>
      placed.every((p) => {
        const dx = p.x - x
        const dz = p.z - z
        return dx * dx + dz * dz >= MIN * MIN
      })
    const tryPlace = (cx: number, cz: number, spreadX: number, spreadZ: number, tries = 40) => {
      for (let i = 0; i < tries; i++) {
        const x = cx + rand(-spreadX, spreadX)
        const z = cz + rand(-spreadZ, spreadZ)
        if (free(x, z)) {
          placed.push({ x, z })
          return { x, z }
        }
      }
      return null
    }

    // 中央に高いタワー、外へ行くほど低い山
    const clusters = [
      { x: 0, z: -5.5, r: 3.2, towers: 5, hi: [16, 32] as const },
      { x: -7.2, z: -3.2, r: 3.0, towers: 4, hi: [12, 26] as const },
      { x: 7.4, z: -3.6, r: 3.0, towers: 4, hi: [12, 26] as const },
      { x: -4.4, z: 1.4, r: 2.6, towers: 3, hi: [5, 14] as const },
      { x: 5.0, z: 1.8, r: 2.6, towers: 3, hi: [5, 14] as const },
      { x: -12.5, z: -6.5, r: 2.8, towers: 3, hi: [8, 22] as const },
      { x: 12.8, z: -6.8, r: 2.8, towers: 3, hi: [8, 22] as const },
    ]
    for (const cl of clusters) {
      const baseD = (Math.random() * DESIGNS.length) | 0
      for (let t = 0; t < cl.towers; t++) {
        const spot = tryPlace(cl.x, cl.z, cl.r, cl.r * 0.8)
        if (!spot) continue
        const d = Math.random() < 0.6 ? baseD : (Math.random() * DESIGNS.length) | 0
        stack(d, spot.x, spot.z, Math.round(rand(cl.hi[0], cl.hi[1])))
      }
      for (let s = 0; s < 2; s++) {
        const spot = tryPlace(cl.x, cl.z + 2.6, cl.r + 1.4, 1.6)
        if (spot)
          stack((Math.random() * DESIGNS.length) | 0, spot.x, spot.z, Math.round(rand(2, 5)))
      }
    }
    // 平置きの単発チップ
    for (let i = 0; i < 14; i++) {
      const spot = tryPlace(0, -1, 15, 6.5, 60)
      if (spot) addChip((Math.random() * DESIGNS.length) | 0, spot.x, H / 2, spot.z, true)
    }
    group.add(floor)
    group.position.y = -1.6
    scene.add(group)

    const resize = () => {
      const w = canvas.clientWidth || 1920
      const h = canvas.clientHeight || 1080
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    let rafId: number | null = null
    const start = performance.now()
    const loop = () => {
      const t = (performance.now() - start) / 1000
      group.rotation.y = t * 0.035
      camera.position.x = Math.sin(t * 0.07) * 1.6
      camera.position.y = 5.2 + Math.sin(t * 0.05) * 0.4
      camera.lookAt(0, 1.2, 0)
      renderer.render(scene, camera)
      rafId = requestAnimationFrame(loop)
    }
    loop()

    // ページ非表示時は描画を停止して負荷を下げる
    const onVisibilityChange = () => {
      if (document.hidden) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
      } else if (rafId === null) {
        loop()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      ro.disconnect()
      body.dispose()
      floor.geometry.dispose()
      ;(floor.material as THREE.Material).dispose()
      for (const trio of mats) {
        for (const m of trio) {
          m.map?.dispose()
          m.dispose()
        }
      }
      scene.environment?.dispose()
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.canvas} />
}
