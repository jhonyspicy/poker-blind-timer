import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * 1 行テキストを実測して上限幅に収める。
 * fill なら常に上限幅いっぱいへ横方向に伸縮し(店名ロゴバッジ。モック準拠)、
 * shrink なら上限を超えたときだけ文字サイズを縮める(タイトル)。shrink を transform で
 * なく文字サイズで行うのは、周囲のレイアウト(枠の幅など)も縮んだ文字に追従させるため。
 * 幅はステージの論理 px(scale 前)で測るため、画面サイズに依存しない。
 * Web フォントの読み込み完了で字幅が変わるため、そのタイミングでも測り直す
 */
export function useFitText<T extends HTMLElement>(
  text: string,
  maxWidth: number,
  mode: 'fill' | 'shrink',
): RefObject<T | null> {
  const ref = useRef<T | null>(null)
  useLayoutEffect(() => {
    let cancelled = false
    const fit = () => {
      const el = ref.current
      if (!el || cancelled) return
      el.style.transform = ''
      el.style.fontSize = ''
      const width = el.scrollWidth
      if (width <= 0) return
      if (mode === 'fill') {
        el.style.transform = `scaleX(${maxWidth / width})`
      } else if (width > maxWidth) {
        const fontSize = parseFloat(getComputedStyle(el).fontSize)
        el.style.fontSize = `${Math.floor((fontSize * maxWidth) / width)}px`
      }
    }
    fit()
    void document.fonts?.ready.then(fit)
    return () => {
      cancelled = true
    }
  }, [text, maxWidth, mode])
  return ref
}
