import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { createBlindLevel, createBreak, createNewConfig, validateConfig } from '../../domain/config'
import type { StructureItem, TournamentConfig } from '../../domain/types'
import { deleteConfig, listConfigs, saveConfig } from '../../storage/db'
import styles from './EditorPage.module.css'

function structureItemLabel(item: StructureItem, index: number): string {
  return item.kind === 'break' ? `${index + 1}. ブレイク` : `${index + 1}. レベル`
}

export default function EditorPage() {
  const [draft, setDraft] = useState<TournamentConfig>(() => createNewConfig())
  const [saved, setSaved] = useState<TournamentConfig[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const refreshSaved = useCallback(async () => {
    const configs = await listConfigs()
    setSaved(configs)
  }, [])

  useEffect(() => {
    let cancelled = false
    listConfigs().then((configs) => {
      if (!cancelled) setSaved(configs)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const update = (patch: Partial<TournamentConfig>) => {
    setNotice(null)
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const updateStructureItem = (index: number, patch: Partial<StructureItem>) => {
    setNotice(null)
    setDraft((prev) => ({
      ...prev,
      structure: prev.structure.map((item, i) =>
        i === index ? ({ ...item, ...patch } as StructureItem) : item,
      ),
    }))
  }

  const insertStructureItem = (item: StructureItem) => {
    setNotice(null)
    setDraft((prev) => ({ ...prev, structure: [...prev.structure, item] }))
  }

  const removeStructureItem = (index: number) => {
    setNotice(null)
    setDraft((prev) => ({
      ...prev,
      structure: prev.structure.filter((_, i) => i !== index),
      lateRegEndIndex:
        prev.lateRegEndIndex === null
          ? null
          : prev.lateRegEndIndex === index
            ? null
            : prev.lateRegEndIndex > index
              ? prev.lateRegEndIndex - 1
              : prev.lateRegEndIndex,
    }))
  }

  const moveStructureItem = (index: number, delta: -1 | 1) => {
    setNotice(null)
    setDraft((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.structure.length) return prev
      const structure = [...prev.structure]
      ;[structure[index], structure[target]] = [structure[target], structure[index]]
      // 締め切り位置は「項目」に付いているので入れ替えに追従させる
      let lateRegEndIndex = prev.lateRegEndIndex
      if (lateRegEndIndex === index) lateRegEndIndex = target
      else if (lateRegEndIndex === target) lateRegEndIndex = index
      return { ...prev, structure, lateRegEndIndex }
    })
  }

  const updatePrize = (index: number, description: string) => {
    setNotice(null)
    setDraft((prev) => ({
      ...prev,
      prizes: prev.prizes.map((p, i) => (i === index ? { ...p, description } : p)),
    }))
  }

  const handleSave = async () => {
    const validationErrors = validateConfig(draft)
    setErrors(validationErrors)
    if (validationErrors.length > 0) {
      setNotice(null)
      return
    }
    const config = { ...draft, updatedAt: Date.now() }
    await saveConfig(config)
    setDraft(config)
    setNotice('保存しました')
    await refreshSaved()
  }

  const handleLoad = (config: TournamentConfig) => {
    setDraft(config)
    setErrors([])
    setNotice(`「${config.title || '(無題)'}」を読み込みました`)
  }

  const handleDelete = async (config: TournamentConfig) => {
    await deleteConfig(config.id)
    if (config.id === draft.id) {
      setDraft(createNewConfig())
    }
    await refreshSaved()
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>エディタ</h1>
      <p>
        <Link to="/signage">→ サイネージを開く</Link>
      </p>

      <section className={styles.section}>
        <h2>保存済み設定</h2>
        {saved.length === 0 ? (
          <p>保存済みの設定はまだありません。</p>
        ) : (
          <ul className={styles.savedList}>
            {saved.map((config) => (
              <li key={config.id}>
                <span className={styles.savedName}>
                  {config.title || '(無題)'} / {config.shopName || '(店名なし)'}
                </span>
                <button type="button" className={styles.button} onClick={() => handleLoad(config)}>
                  読み込み
                </button>
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={() => void handleDelete(config)}
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        )}
        <p>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              setDraft(createNewConfig())
              setErrors([])
              setNotice('新規設定を作成しました')
            }}
          >
            新規作成
          </button>
        </p>
      </section>

      <section className={styles.section}>
        <h2>トーナメント情報</h2>
        <div className={styles.field}>
          <label htmlFor="shopName">お店の名前</label>
          <input
            id="shopName"
            type="text"
            value={draft.shopName}
            onChange={(e) => update({ shopName: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="title">トーナメントタイトル</label>
          <input
            id="title"
            type="text"
            value={draft.title}
            onChange={(e) => update({ title: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="startingStack">スターティングスタック</label>
          <input
            id="startingStack"
            type="number"
            min={1}
            value={draft.startingStack}
            onChange={(e) => update({ startingStack: Number(e.target.value) })}
          />
        </div>
        <div className={styles.checkboxField}>
          <input
            id="addonEnabled"
            type="checkbox"
            checked={draft.addonEnabled}
            onChange={(e) => update({ addonEnabled: e.target.checked })}
          />
          <label htmlFor="addonEnabled">アドオン / リバイあり</label>
        </div>
        {draft.addonEnabled && (
          <div className={styles.field}>
            <label htmlFor="addonChip">アドオンのチップ量</label>
            <input
              id="addonChip"
              type="number"
              min={1}
              value={draft.addonChip}
              onChange={(e) => update({ addonChip: Number(e.target.value) })}
            />
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>プライズ</h2>
        {draft.prizes.map((prize, index) => (
          <div key={index} className={styles.row} style={{ marginBottom: '0.5rem' }}>
            <span>{prize.place} 位</span>
            <input
              type="text"
              value={prize.description}
              placeholder="例: ¥30,000"
              onChange={(e) => updatePrize(index, e.target.value)}
            />
            <button
              type="button"
              className={styles.iconButton}
              onClick={() =>
                update({
                  prizes: draft.prizes
                    .filter((_, i) => i !== index)
                    .map((p, i) => ({ ...p, place: i + 1 })),
                })
              }
            >
              削除
            </button>
          </div>
        ))}
        <button
          type="button"
          className={styles.button}
          onClick={() =>
            update({
              prizes: [...draft.prizes, { place: draft.prizes.length + 1, description: '' }],
            })
          }
        >
          プライズを追加
        </button>
      </section>

      <section className={styles.section}>
        <h2>ストラクチャー</h2>
        <table className={styles.structureTable}>
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
              <tr key={index} className={item.kind === 'break' ? styles.breakRow : undefined}>
                <td>{structureItemLabel(item, index)}</td>
                {item.kind === 'blind' ? (
                  <>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={item.sb}
                        onChange={(e) => updateStructureItem(index, { sb: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={1}
                        value={item.bb}
                        onChange={(e) => updateStructureItem(index, { bb: Number(e.target.value) })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        value={item.ante}
                        onChange={(e) =>
                          updateStructureItem(index, { ante: Number(e.target.value) })
                        }
                      />
                    </td>
                  </>
                ) : (
                  <td colSpan={3}>休憩</td>
                )}
                <td>
                  <input
                    type="number"
                    min={1}
                    value={item.durationMinutes}
                    onChange={(e) =>
                      updateStructureItem(index, { durationMinutes: Number(e.target.value) })
                    }
                  />
                </td>
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
                      className={styles.iconButton}
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
            className={styles.button}
            onClick={() => insertStructureItem(createBlindLevel())}
          >
            レベルを追加
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => insertStructureItem(createBreak())}
          >
            ブレイクを追加
          </button>
        </div>
        <div className={styles.field} style={{ marginTop: '0.75rem' }}>
          <label htmlFor="lateReg">レイトレジストレーション締め切り</label>
          <select
            id="lateReg"
            value={draft.lateRegEndIndex ?? ''}
            onChange={(e) =>
              update({ lateRegEndIndex: e.target.value === '' ? null : Number(e.target.value) })
            }
          >
            <option value="">なし</option>
            {draft.structure.map((item, index) => (
              <option key={index} value={index}>
                {structureItemLabel(item, index)} 終了時
              </option>
            ))}
          </select>
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

      <button type="button" className={styles.primaryButton} onClick={() => void handleSave()}>
        保存
      </button>
      {notice && <p className={styles.notice}>{notice}</p>}
    </main>
  )
}
