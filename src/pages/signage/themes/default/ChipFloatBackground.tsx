import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import styles from './ChipFloatBackground.module.css'

/**
 * 待機画面の背景: ポーカーチップが漂う WebGL 演出(デザインモックの移植)。
 * 中央は暗く空けてあり、上に UI を重ねる前提。タブ非表示中は描画を停止する。
 */

// 見た目・動きの調整はここ(モックの CONFIG をそのまま踏襲)
const CONFIG = {
  counts: { foreground: 2, midground: 5, background: 4 },
  backgroundColor: 0x050403,
  goldColor: 0xd4a94e,
  goldBright: 0xf0cf8a,
  chipBlack: 0x2a2622,
  chipWhite: 0xe8e0d0,
  chipRadius: 1.0,
  chipThickness: 0.15,
  whiteChipCount: 2,
  minSeparation: 2.5,
  driftSpeed: 0.035,
  bobAmplitude: 0.25,
  rotationSpeed: 0.05,
  rimIntensity: 2.6,
  fillIntensity: 1.1,
  keyIntensity: 1.4,
  ambientIntensity: 0.35,
  safeZone: { width: 0.45, height: 0.55 },
  depthOfField: { enabled: true, focus: 2.0, aperture: 0.0006, maxblur: 0.008 },
  maxPixelRatio: 2,
  radialSegments: 48,
}

interface ChipState {
  mesh: THREE.Mesh
  layer: 'foreground' | 'midground' | 'background'
  anchorX: number
  driftY: number
  bobFreq: number
  bobPhase: number
  bobAmp: number
  swayFreq: number
  swayPhase: number
  swayAmp: number
  rot: THREE.Vector3
  baseZ: number
}

const Z_RANGE = {
  foreground: [2.5, 3.8],
  midground: [-2.5, 1.0],
  background: [-14, -7],
} as const

function makeFaceTexture(baseHex: number, accentHex: number): THREE.CanvasTexture {
  // チップ表面: 外周の縁取り + エッジスポット + 内円リング + 中央スペード
  const S = 512
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const ctx = cv.getContext('2d')!
  const c = S / 2
  const base = '#' + baseHex.toString(16).padStart(6, '0')
  const accent = '#' + accentHex.toString(16).padStart(6, '0')

  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)
  ctx.strokeStyle = accent
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(c, c, c - 8, 0, Math.PI * 2)
  ctx.stroke()
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2 - 0.16
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(c, c, c - 34, a0, a0 + 0.32)
    ctx.arc(c, c, c - 82, a0 + 0.32, a0, true)
    ctx.closePath()
    ctx.fill()
  }
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(c, c, c - 100, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(c, c, c - 116, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.font = `${S * 0.42}px "Georgia", "Times New Roman", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('♠', c, c + S * 0.01)

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function makeEdgeTexture(baseHex: number, accentHex: number): THREE.CanvasTexture {
  // チップ側面: 交互ストライプ
  const W = 1024
  const H = 64
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  const base = '#' + baseHex.toString(16).padStart(6, '0')
  const accent = '#' + accentHex.toString(16).padStart(6, '0')
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)
  const stripes = 8
  const w = W / stripes
  ctx.fillStyle = accent
  for (let i = 0; i < stripes; i++) {
    ctx.fillRect(i * w + w * 0.28, 0, w * 0.44, H)
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

export default function ChipFloatBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(CONFIG.backgroundColor)
    scene.fog = new THREE.Fog(CONFIG.backgroundColor, 14, 34)

    const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100)
    camera.position.set(0, 0, 10)

    // ライティング(暗め・ゴールドのリムライト中心)
    scene.add(new THREE.AmbientLight(0x332a1c, CONFIG.ambientIntensity))
    const rimL = new THREE.DirectionalLight(CONFIG.goldBright, CONFIG.rimIntensity)
    rimL.position.set(-6, 3, -4)
    scene.add(rimL)
    const rimR = new THREE.DirectionalLight(CONFIG.goldColor, CONFIG.rimIntensity * 0.8)
    rimR.position.set(7, -2, -3)
    scene.add(rimR)
    const fill = new THREE.DirectionalLight(0xfff2dd, CONFIG.fillIntensity)
    fill.position.set(0, 4, 8)
    scene.add(fill)
    const key = new THREE.DirectionalLight(0xffe3b0, CONFIG.keyIntensity)
    key.position.set(-4, 6, 6)
    scene.add(key)

    const chipGeometry = new THREE.CylinderGeometry(
      CONFIG.chipRadius,
      CONFIG.chipRadius,
      CONFIG.chipThickness,
      CONFIG.radialSegments,
      1,
      false,
    )

    function makeChipMaterials(baseHex: number, accentHex: number): THREE.MeshStandardMaterial[] {
      const face = makeFaceTexture(baseHex, accentHex)
      const edge = makeEdgeTexture(baseHex, accentHex)
      const common = { metalness: 0.6, roughness: 0.38 }
      return [
        new THREE.MeshStandardMaterial({ map: edge, ...common }),
        new THREE.MeshStandardMaterial({ map: face, ...common }),
        new THREE.MeshStandardMaterial({ map: face, ...common }),
      ]
    }
    const materialsBlack = makeChipMaterials(CONFIG.chipBlack, CONFIG.goldColor)
    const materialsWhite = makeChipMaterials(CONFIG.chipWhite, 0x8a6a2a)

    function viewSizeAt(z: number) {
      const dist = camera.position.z - z
      const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * dist
      return { halfW: halfH * camera.aspect, halfH }
    }

    const rand = (a: number, b: number) => a + Math.random() * (b - a)
    const chips: ChipState[] = []
    let whiteAssigned = 0

    function createChip(layer: ChipState['layer'], index: number, total: number) {
      // 白系チップは中景・背景の一部にのみ割り当て(前景は必ず黒×ゴールド)
      const isWhite =
        layer !== 'foreground' &&
        whiteAssigned < CONFIG.whiteChipCount &&
        index % 2 === 1 &&
        (whiteAssigned++, true)
      const mesh = new THREE.Mesh(chipGeometry, isWhite ? materialsWhite : materialsBlack)
      const chipR = CONFIG.chipRadius

      const [zMin, zMax] = Z_RANGE[layer]
      const side = index % 2 === 0 ? -1 : 1
      let z = 0
      let anchorX = 0
      let y = 0
      for (let attempt = 0; attempt < 50; attempt++) {
        z = rand(zMin, zMax)
        const { halfW, halfH } = viewSizeAt(z)
        if (layer === 'foreground') {
          // 画面端の外側にアンカーし、縁が少しだけ覗く位置(中央には入れない)
          anchorX = side * (halfW + chipR * rand(-0.2, 0.3))
        } else if (layer === 'midground') {
          anchorX = side * rand(halfW * (CONFIG.safeZone.width / 2 + 0.32), halfW * 0.95)
        } else {
          anchorX = side * rand(halfW * 0.35, halfW * 0.9)
        }
        y =
          ((index + 0.5) / total - 0.5) * halfH * (layer === 'midground' ? 1.4 : 1.7) +
          rand(-halfH * 0.15, halfH * 0.15)
        const p = new THREE.Vector3(anchorX, y, z)
        if (chips.every((c) => c.mesh.position.distanceTo(p) >= CONFIG.minSeparation)) break
      }

      mesh.position.set(anchorX, y, z)
      mesh.rotation.set(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2))
      scene.add(mesh)

      chips.push({
        mesh,
        layer,
        anchorX,
        driftY: rand(0.5, 1.0) * CONFIG.driftSpeed * (Math.random() < 0.5 ? -1 : 1),
        bobFreq: rand(0.03, 0.08),
        bobPhase: rand(0, Math.PI * 2),
        bobAmp: CONFIG.bobAmplitude * rand(0.6, 1.4),
        swayFreq: rand(0.015, 0.04),
        swayPhase: rand(0, Math.PI * 2),
        swayAmp: layer === 'foreground' ? rand(0.1, 0.25) : rand(0.2, 0.5),
        rot: new THREE.Vector3(
          rand(0.3, 1.0) * CONFIG.rotationSpeed * (Math.random() < 0.5 ? -1 : 1),
          rand(0.3, 1.0) * CONFIG.rotationSpeed * (Math.random() < 0.5 ? -1 : 1),
          rand(0.2, 0.7) * CONFIG.rotationSpeed * (Math.random() < 0.5 ? -1 : 1),
        ),
        baseZ: z,
      })
    }

    for (let i = 0; i < CONFIG.counts.foreground; i++)
      createChip('foreground', i, CONFIG.counts.foreground)
    for (let i = 0; i < CONFIG.counts.midground; i++)
      createChip('midground', i, CONFIG.counts.midground)
    for (let i = 0; i < CONFIG.counts.background; i++)
      createChip('background', i, CONFIG.counts.background)

    // ポストプロセス(被写界深度)
    let composer: EffectComposer | null = null
    if (CONFIG.depthOfField.enabled) {
      composer = new EffectComposer(renderer)
      composer.addPass(new RenderPass(scene, camera))
      composer.addPass(
        new BokehPass(scene, camera, {
          focus: CONFIG.depthOfField.focus,
          aperture: CONFIG.depthOfField.aperture,
          maxblur: CONFIG.depthOfField.maxblur,
        }),
      )
      composer.addPass(new OutputPass())
    }

    const clock = new THREE.Clock()
    let rafId: number | null = null

    function update(dt: number, t: number) {
      for (const c of chips) {
        const m = c.mesh
        m.position.y += c.driftY * dt
        m.position.x = c.anchorX + Math.sin(t * c.swayFreq * Math.PI * 2 + c.swayPhase) * c.swayAmp
        m.position.z = c.baseZ + Math.sin(t * c.bobFreq * Math.PI * 1.3 + c.bobPhase * 0.7) * 0.25
        m.position.y += Math.cos(t * c.bobFreq * Math.PI * 2 + c.bobPhase) * c.bobAmp * dt
        m.rotation.x += c.rot.x * dt
        m.rotation.y += c.rot.y * dt
        m.rotation.z += c.rot.z * dt
        // 画面外に出たら反対側へ再配置(画面外で行うため気づかれない)
        const { halfH } = viewSizeAt(m.position.z)
        const margin = CONFIG.chipRadius * m.scale.x * 2.2
        const limit = halfH + margin
        if (m.position.y > limit) m.position.y = -limit
        else if (m.position.y < -limit) m.position.y = limit
      }
      // チップ同士のめり込み防止(接近したペアを滑らかに引き離す)
      for (let i = 0; i < chips.length; i++) {
        for (let j = i + 1; j < chips.length; j++) {
          const a = chips[i]
          const b = chips[j]
          const pa = a.mesh.position
          const pb = b.mesh.position
          const dx = pb.x - pa.x
          const dy = pb.y - pa.y
          const dz = pb.z - pa.z
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (dist > 0.0001 && dist < CONFIG.minSeparation) {
            const push = (CONFIG.minSeparation - dist) * Math.min(1, dt * 1.2) * 0.5
            const ny = dy / dist
            const nz = dz / dist
            pa.y -= ny * push
            pb.y += ny * push
            a.baseZ -= nz * push
            b.baseZ += nz * push
            const ra = Z_RANGE[a.layer]
            const rb = Z_RANGE[b.layer]
            a.baseZ = THREE.MathUtils.clamp(a.baseZ, ra[0] - 0.5, ra[1] + 0.5)
            b.baseZ = THREE.MathUtils.clamp(b.baseZ, rb[0] - 0.5, rb[1] + 0.5)
          }
        }
      }
    }

    function animate() {
      rafId = requestAnimationFrame(animate)
      const dt = Math.min(clock.getDelta(), 0.05) // タブ復帰時の大ジャンプを防止
      update(dt, clock.elapsedTime)
      if (composer) composer.render()
      else renderer.render(scene, camera)
    }
    animate()

    function onResize() {
      const w = window.innerWidth
      const h = window.innerHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.maxPixelRatio))
      renderer.setSize(w, h)
      composer?.setSize(w, h)
      // アスペクト変化に合わせて X アンカーを再計算(中央の安全領域を常に確保)
      for (const c of chips) {
        const { halfW } = viewSizeAt(c.baseZ)
        const side = Math.sign(c.anchorX) || 1
        const minX =
          c.layer === 'midground'
            ? halfW * (CONFIG.safeZone.width / 2 + 0.32)
            : c.layer === 'foreground'
              ? halfW * 0.95
              : halfW * 0.35
        if (Math.abs(c.anchorX) < minX) c.anchorX = side * minX
      }
    }
    window.addEventListener('resize', onResize)

    // ページ非表示時は描画を停止して負荷を下げる
    function onVisibilityChange() {
      if (document.hidden) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
      } else if (rafId === null) {
        clock.getDelta() // 停止中の経過時間を破棄
        animate()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      chipGeometry.dispose()
      for (const mats of [materialsBlack, materialsWhite]) {
        for (const m of mats) {
          m.map?.dispose()
          m.dispose()
        }
      }
      for (const c of chips) scene.remove(c.mesh)
      composer?.dispose()
      renderer.dispose()
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.canvas} />
}
