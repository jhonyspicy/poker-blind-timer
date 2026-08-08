import { useEffect, useRef, useState } from 'react'
import {
  createBlindLevel,
  createBreak,
  createLateRegClose,
  validateStructure,
} from '../../domain/config'
import { formatBlind } from '../../domain/format'
import { structuresEqual } from '../../domain/structureUpdate'
import type { StructureItem } from '../../domain/types'
import type { RemoteCommandInput, StateSnapshot } from '../../realtime/messages'
import styles from './StructureTab.module.css'

/**
 * 適用(STRUCTURE_UPDATE)送信後、送信内容と一致するスナップショットが
 * この時間内に届かなければ「適用されなかった」とみなす。サイネージは
 * 拒否時も専用の応答を返さず現在状態を配信し直すだけなので、成功は
 * ストラクチャーの一致で、失敗はタイムアウトで判定する
 */
const APPLY_TIMEOUT_MS = 5_000

interface DraftRow {
  /** 行の追加・削除で index がずれても入力欄(uncontrolled)を追跡できるようにする一意キー */
  uid: number
  item: StructureItem
}

type Notice = { kind: 'success' | 'conflict'; text: string } | null

interface StructureTabProps {
  snapshot: StateSnapshot
  sendCommand: (input: RemoteCommandInput) => void
}

/**
 * リモコンのストラクチャータブ。実効ストラクチャーの閲覧と、未来の項目
 * (現在進行中の項目より後ろ)だけのドラフト編集 → 適用を行う。
 * 適用可否の最終判定はサイネージが行う(ここでのロックは操作補助)
 */
export default function StructureTab({ snapshot, sendCommand }: StructureTabProps) {
  const [draft, setDraft] = useState<DraftRow[] | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState<Notice>(null)
  /** 挿入位置の選択中 index(splice 位置)。null なら非表示 */
  const [insertAt, setInsertAt] = useState<number | null>(null)
  const [pending, setPending] = useState<StructureItem[] | null>(null)
  const uidRef = useRef(0)
  // タイムアウト処理から最新スナップショットを参照するための ref
  const snapshotRef = useRef(snapshot)
  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  const structure = snapshot.structure ?? []
  // 編集できる最小 index。進行中は現在項目の次から、開始前は全項目
  const minEditIndex =
    snapshot.status === 'waiting'
      ? 0
      : snapshot.currentIndex !== null
        ? snapshot.currentIndex + 1
        : 0
  const editable = snapshot.status === 'waiting' || snapshot.currentIndex !== null

  const toRows = (items: StructureItem[]): DraftRow[] =>
    items.map((item) => ({ uid: ++uidRef.current, item: { ...item } }))

  // 適用結果の判定: 送信内容と一致するスナップショットが届いたら成功。
  // props(snapshot)の変化に応じた状態調整なので、effect ではなく render 中に行う
  if (pending && structuresEqual(snapshot.structure ?? [], pending)) {
    setPending(null)
    setDraft(null)
    setInsertAt(null)
    setNotice({ kind: 'success', text: 'ストラクチャーを変更しました' })
  }

  // タイムアウトしたら拒否とみなし、最新のストラクチャーでドラフトを組み直す
  useEffect(() => {
    if (!pending) return
    const id = window.setTimeout(() => {
      setPending(null)
      setDraft(toRows(snapshotRef.current.structure ?? []))
      setInsertAt(null)
      setNotice({
        kind: 'conflict',
        text: 'タイマーの進行と競合したため適用されませんでした。最新の内容を確認してください',
      })
    }, APPLY_TIMEOUT_MS)
    return () => window.clearTimeout(id)
  }, [pending])

  const startEdit = () => {
    setDraft(toRows(structure))
    setErrors([])
    setNotice(null)
    setInsertAt(null)
  }

  const cancelEdit = () => {
    setDraft(null)
    setErrors([])
    setInsertAt(null)
  }

  const updateItem = (uid: number, patch: Partial<StructureItem>) => {
    setDraft((rows) =>
      rows
        ? rows.map((row) =>
            row.uid === uid ? { ...row, item: { ...row.item, ...patch } as StructureItem } : row,
          )
        : rows,
    )
  }

  const removeRow = (uid: number) => {
    setDraft((rows) => (rows ? rows.filter((row) => row.uid !== uid) : rows))
    setInsertAt(null)
  }

  const insertItem = (at: number, item: StructureItem) => {
    setDraft((rows) => {
      if (!rows) return rows
      const next = [...rows]
      next.splice(at, 0, { uid: ++uidRef.current, item })
      return next
    })
    setInsertAt(null)
  }

  /** 挿入位置より前で最後に現れるブラインド(新レベルの初期値の引き継ぎ元) */
  const lastBlindBefore = (rows: DraftRow[], at: number) => {
    for (let i = at - 1; i >= 0; i--) {
      const item = rows[i].item
      if (item.kind === 'blind') return item
    }
    return undefined
  }

  const apply = () => {
    if (!draft) return
    const next = draft.map((row) => row.item)
    const validationErrors = validateStructure(next)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors([])
    // 未到達のレイトレジ締切を消す編集は、優勝・インマネの確定条件が変わるため警告する
    const latest = snapshotRef.current
    const hadFutureLateReg = (latest.structure ?? []).some(
      (item, index) =>
        item.kind === 'lateRegClose' &&
        (latest.currentIndex === null || index > latest.currentIndex),
    )
    const removesLateReg = hadFutureLateReg && !next.some((item) => item.kind === 'lateRegClose')
    const message = removesLateReg
      ? 'レイトレジストレーション締め切りが無くなります。現在の人数のまま優勝やインマネが確定することがあります。ストラクチャーを変更しますか?'
      : 'ストラクチャーを変更しますか?(この変更はこのトーナメント限りで、保存された設定は変わりません)'
    if (!window.confirm(message)) return
    sendCommand({ type: 'STRUCTURE_UPDATE', structure: next })
    setPending(next)
  }

  // 表示用の行(閲覧時はスナップショット、編集時はドラフト)
  const rows: DraftRow[] = draft ?? structure.map((item, index) => ({ uid: index, item }))
  const editing = draft !== null

  /** ブラインド行のレベル番号(ブレイク・マーカーは数えない) */
  const levelNumbers = (() => {
    let count = 0
    return rows.map((row) => (row.item.kind === 'blind' ? ++count : null))
  })()

  const renderInsertBar = (at: number) => {
    if (!editing || pending) return null
    if (at < minEditIndex) return null
    if (insertAt !== at) {
      return (
        <button
          type="button"
          className={styles.insertBar}
          onClick={() => setInsertAt(at)}
          aria-label="ここに項目を追加"
        >
          ＋
        </button>
      )
    }
    const hasLateReg = (draft ?? []).some((row) => row.item.kind === 'lateRegClose')
    return (
      <div className={styles.insertChoices}>
        <button
          type="button"
          className={styles.insertChoice}
          onClick={() => insertItem(at, createBlindLevel(lastBlindBefore(draft ?? [], at)))}
        >
          ブラインド
        </button>
        <button
          type="button"
          className={styles.insertChoice}
          onClick={() => insertItem(at, createBreak())}
        >
          ブレイク
        </button>
        {!hasLateReg && (
          <button
            type="button"
            className={styles.insertChoice}
            onClick={() => insertItem(at, createLateRegClose())}
          >
            レイトレジ締切
          </button>
        )}
        <button type="button" className={styles.insertCancel} onClick={() => setInsertAt(null)}>
          ×
        </button>
      </div>
    )
  }

  const numberField = (
    uid: number,
    label: string,
    value: number,
    onValue: (value: number) => void,
  ) => (
    <label className={styles.fieldWrap}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        key={uid}
        type="text"
        inputMode="numeric"
        className={styles.fieldInput}
        defaultValue={Number.isFinite(value) ? String(value) : ''}
        onChange={(e) => onValue(Number.parseInt(e.target.value.replace(/[^\d]/g, ''), 10))}
        aria-label={label}
      />
    </label>
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <span className={styles.headTitle}>ストラクチャー</span>
        {editing ? (
          <div className={styles.headActions}>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={!!pending}
              onClick={cancelEdit}
            >
              キャンセル
            </button>
            <button type="button" className={styles.btnApply} disabled={!!pending} onClick={apply}>
              {pending ? '適用中…' : '適用'}
            </button>
          </div>
        ) : (
          <button type="button" className={styles.btnEdit} disabled={!editable} onClick={startEdit}>
            編集
          </button>
        )}
      </div>
      {!editing && (
        <div className={styles.caption}>
          {editable
            ? 'この先の項目だけ変更できます。変更はこのトーナメント限りで、保存された設定は変わりません。'
            : '編集はできません。'}
        </div>
      )}
      {notice && (
        <div className={notice.kind === 'success' ? styles.noticeSuccess : styles.noticeConflict}>
          {notice.text}
        </div>
      )}
      {errors.length > 0 && (
        <div className={styles.errorBox}>
          {errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      )}
      <div className={styles.list}>
        {rows.map((row, index) => {
          const locked = !editing || !!pending || index < minEditIndex
          const isCurrent = !editing && snapshot.currentIndex === index
          const pastRow = index < minEditIndex && snapshot.status !== 'waiting'
          return (
            <div key={row.uid} className={styles.rowWrap}>
              {renderInsertBar(index)}
              <div
                className={isCurrent ? styles.rowCurrent : pastRow ? styles.rowPast : styles.row}
              >
                <span className={styles.rowLabel}>
                  {row.item.kind === 'blind'
                    ? `LV ${levelNumbers[index]}`
                    : row.item.kind === 'break'
                      ? 'ブレイク'
                      : 'レジ締切'}
                </span>
                {locked ? (
                  <span className={styles.rowValue}>
                    {row.item.kind === 'blind' && (
                      <>
                        {formatBlind(row.item.sb)} / {formatBlind(row.item.bb)}
                        {row.item.ante > 0 && ` (${formatBlind(row.item.ante)})`}
                        <span className={styles.rowMinutes}>{row.item.durationMinutes}分</span>
                      </>
                    )}
                    {row.item.kind === 'break' && (
                      <span className={styles.rowMinutes}>{row.item.durationMinutes}分</span>
                    )}
                    {row.item.kind === 'lateRegClose' && 'ここで受付終了'}
                  </span>
                ) : (
                  <div className={styles.rowEdit}>
                    {row.item.kind === 'blind' && (
                      <>
                        {numberField(row.uid, 'SB', row.item.sb, (sb) =>
                          updateItem(row.uid, { sb }),
                        )}
                        {numberField(row.uid, 'BB', row.item.bb, (bb) =>
                          updateItem(row.uid, { bb }),
                        )}
                        {numberField(row.uid, 'Ante', row.item.ante, (ante) =>
                          updateItem(row.uid, { ante }),
                        )}
                        {numberField(row.uid, '分', row.item.durationMinutes, (durationMinutes) =>
                          updateItem(row.uid, { durationMinutes }),
                        )}
                      </>
                    )}
                    {row.item.kind === 'break' && (
                      <>
                        {numberField(row.uid, '分', row.item.durationMinutes, (durationMinutes) =>
                          updateItem(row.uid, { durationMinutes }),
                        )}
                        <span className={styles.rowEditNote}>休憩</span>
                      </>
                    )}
                    {row.item.kind === 'lateRegClose' && (
                      <span className={styles.rowEditNote}>ここで受付終了</span>
                    )}
                  </div>
                )}
                {isCurrent && <span className={styles.currentBadge}>進行中</span>}
                {!locked && (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => removeRow(row.uid)}
                    aria-label="この項目を削除"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {renderInsertBar(rows.length)}
        {rows.length === 0 && <div className={styles.empty}>ストラクチャー情報がありません</div>}
      </div>
    </div>
  )
}
