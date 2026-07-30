import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import {
  createBlindLevel,
  createBreak,
  createLateRegClose,
  createNewConfig,
  validateConfig,
} from '../../domain/config'
import type { StructureItem, TournamentConfig } from '../../domain/types'
import { getConfig, saveConfig } from '../../storage/db'
import styles from './EditorPage.module.css'

function structureItemLabel(item: StructureItem, index: number): string {
  switch (item.kind) {
    case 'break':
      return `${index + 1}. ブレイク`
    case 'lateRegClose':
      return `${index + 1}. レイトレジ`
    default:
      return `${index + 1}. レベル`
  }
}

/** エディタ画面。トーナメント設定の新規作成(`/editor`)と編集(`/editor?id=`) */
export default function EditorPage() {
  const [searchParams] = useSearchParams()
  const configId = searchParams.get('id')
  /** IndexedDB からの読み込みが済んだ設定 id。?id= なしの新規作成では不要 */
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TournamentConfig>(() => createNewConfig())
  /** true なら既存設定の編集(見出しの出し分け用) */
  const [isEditing, setIsEditing] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const navigate = useNavigate()
  /** レベル追加直後にフォーカスする SB 入力の structure index */
  const pendingSbFocusIndex = useRef<number | null>(null)
  /** プライズ追加直後にフォーカスする入力の prizes index */
  const pendingPrizeFocusIndex = useRef<number | null>(null)
  const loaded = !configId || loadedId === configId

  // トップページの「編集」からの遷移(?id=)では対象の設定を読み込んだ状態で開く
  useEffect(() => {
    if (!configId) return
    let cancelled = false
    getConfig(configId).then((config) => {
      if (cancelled) return
      if (config) {
        setDraft(config)
        setIsEditing(true)
      }
      setLoadedId(configId)
    })
    return () => {
      cancelled = true
    }
  }, [configId])

  const update = (patch: Partial<TournamentConfig>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const updateStructureItem = (index: number, patch: Partial<StructureItem>) => {
    setDraft((prev) => ({
      ...prev,
      structure: prev.structure.map((item, i) =>
        i === index ? ({ ...item, ...patch } as StructureItem) : item,
      ),
    }))
  }

  const insertStructureItem = (item: StructureItem) => {
    setDraft((prev) => ({ ...prev, structure: [...prev.structure, item] }))
  }

  const removeStructureItem = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      structure: prev.structure.filter((_, i) => i !== index),
    }))
  }

  const moveStructureItem = (index: number, delta: -1 | 1) => {
    setDraft((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.structure.length) return prev
      const structure = [...prev.structure]
      ;[structure[index], structure[target]] = [structure[target], structure[index]]
      return { ...prev, structure }
    })
  }

  const updatePrize = (index: number, description: string) => {
    setDraft((prev) => ({
      ...prev,
      prizes: prev.prizes.map((p, i) => (i === index ? { ...p, description } : p)),
    }))
  }

  const removePrize = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      prizes: prev.prizes.filter((_, i) => i !== index).map((p, i) => ({ ...p, place: i + 1 })),
    }))
  }

  const handleSave = async () => {
    const validationErrors = validateConfig(draft)
    setErrors(validationErrors)
    if (validationErrors.length > 0) return
    await saveConfig({ ...draft, updatedAt: Date.now() })
    navigate('/')
  }

  const hasLateRegClose = draft.structure.some((item) => item.kind === 'lateRegClose')

  if (!loaded) {
    return null
  }

  return (
    <div className={styles.page}>
      <header className={styles.nav}>
        <Link to="/" className={styles.brand}>
          ブラインドタイマー
        </Link>
        <span className={styles.navLabel}>エディタ</span>
      </header>
      <main className={styles.content}>
        <div className={styles.pageHeader}>
          <div className={styles.headings}>
            <h2 className={styles.title}>
              {isEditing ? 'タイマー設定の編集' : '新規タイマー作成'}
            </h2>
            <span className={styles.subtitle}>{draft.title || '(無題)'}</span>
          </div>
          <div className={styles.headerActions}>
            <Link to="/" className={styles.btnSecondary}>
              トップへ戻る
            </Link>
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.saveButton}`}
              onClick={() => void handleSave()}
            >
              保存
            </button>
          </div>
        </div>

        <div className={styles.sections}>
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>トーナメント情報</h3>
            <div className={styles.field}>
              <label htmlFor="title">トーナメントタイトル</label>
              <input
                id="title"
                type="text"
                className={styles.input}
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="entryNotice">エントリー案内(サイネージに表示。空欄なら非表示)</label>
              <input
                id="entryNotice"
                type="text"
                className={styles.input}
                placeholder="例: 2500円で8000点です!"
                value={draft.entryNotice ?? ''}
                onChange={(e) => update({ entryNotice: e.target.value })}
              />
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>プライズ</h3>
            {draft.prizes.map((prize, index) => (
              <div key={index} className={styles.prizeRow}>
                <span className={styles.prizePlace}>{prize.place} 位</span>
                <input
                  type="text"
                  className={styles.input}
                  value={prize.description}
                  placeholder="例: ¥30,000"
                  ref={(el) => {
                    if (el && pendingPrizeFocusIndex.current === index) {
                      pendingPrizeFocusIndex.current = null
                      el.focus()
                    }
                  }}
                  onChange={(e) => updatePrize(index, e.target.value)}
                />
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={() => removePrize(index)}
                >
                  削除
                </button>
              </div>
            ))}
            <div className={styles.row}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  // 追加した行の入力へフォーカスし、そのまま内容を入力できるようにする
                  pendingPrizeFocusIndex.current = draft.prizes.length
                  update({
                    prizes: [...draft.prizes, { place: draft.prizes.length + 1, description: '' }],
                  })
                }}
              >
                プライズを追加
              </button>
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>ストラクチャー</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>SB</th>
                  <th>BB</th>
                  <th>Ante</th>
                  <th>時間(分)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {draft.structure.map((item, index) => (
                  <tr key={index}>
                    <td className={item.kind === 'break' ? styles.breakLabel : undefined}>
                      {structureItemLabel(item, index)}
                    </td>
                    {item.kind === 'blind' ? (
                      <>
                        <td>
                          <input
                            type="number"
                            min={1}
                            className={`${styles.input} ${styles.numberInput}`}
                            value={item.sb}
                            ref={(el) => {
                              if (el && pendingSbFocusIndex.current === index) {
                                pendingSbFocusIndex.current = null
                                el.focus()
                                el.select()
                              }
                            }}
                            onChange={(e) => {
                              // 入力の手間を省くため SB から BB(SB×2)、BB から Ante(=BB)を自動補完する。
                              // 逆方向(BB→SB、Ante→BB)には伝播しない
                              const sb = Number(e.target.value)
                              updateStructureItem(index, { sb, bb: sb * 2, ante: sb * 2 })
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            className={`${styles.input} ${styles.numberInput}`}
                            value={item.bb}
                            onChange={(e) => {
                              const bb = Number(e.target.value)
                              updateStructureItem(index, { bb, ante: bb })
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className={`${styles.input} ${styles.numberInput}`}
                            value={item.ante}
                            onChange={(e) =>
                              updateStructureItem(index, { ante: Number(e.target.value) })
                            }
                          />
                        </td>
                      </>
                    ) : item.kind === 'break' ? (
                      <td colSpan={3} className={styles.breakLabel}>
                        休憩
                      </td>
                    ) : (
                      <td colSpan={4} className={styles.lateRegCell}>
                        ここでレイトレジストレーション受付終了
                      </td>
                    )}
                    {item.kind !== 'lateRegClose' && (
                      <td>
                        <input
                          type="number"
                          min={1}
                          className={`${styles.input} ${styles.numberInput}`}
                          value={item.durationMinutes}
                          onChange={(e) =>
                            updateStructureItem(index, { durationMinutes: Number(e.target.value) })
                          }
                        />
                      </td>
                    )}
                    <td>
                      <span className={styles.row}>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => moveStructureItem(index, -1)}
                          aria-label="上へ移動"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => moveStructureItem(index, 1)}
                          aria-label="下へ移動"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => removeStructureItem(index)}
                        >
                          削除
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.row}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  // 追加した行の SB へフォーカスし、そのまま値を打ち替えられるようにする
                  pendingSbFocusIndex.current = draft.structure.length
                  insertStructureItem(createBlindLevel())
                }}
              >
                レベルを追加
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => insertStructureItem(createBreak())}
              >
                ブレイクを追加
              </button>
              <button
                type="button"
                className={styles.btnSecondary}
                disabled={hasLateRegClose}
                title={hasLateRegClose ? 'レイトレジストレーションは 1 つまでです' : undefined}
                onClick={() => insertStructureItem(createLateRegClose())}
              >
                レイトレジストレーションを追加
              </button>
            </div>
          </section>

          {errors.length > 0 && (
            <div className={styles.errors} role="alert">
              <ul>
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.footerActions}>
            <button
              type="button"
              className={`${styles.btnPrimary} ${styles.saveButton}`}
              onClick={() => void handleSave()}
            >
              保存
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
