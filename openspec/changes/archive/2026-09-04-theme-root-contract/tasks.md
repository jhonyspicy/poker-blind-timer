## 1. テーマ契約の再定義

- [x] 1.1 `src/pages/signage/themes/index.ts` の `SignageTheme` を「Root + assets + effectTimeoutMs」に再定義し、`SignageThemeProps`(theme / session / config / stats / roomName / now / phase / effectEvent / onAdvance / onDone)を定義する。契約義務(effectEvent は演出を表示しない場合も必ず onDone で消化する)を doc コメントに明記する
- [x] 1.2 `src/pages/signage/events.ts` の `EffectOverlayProps` / `EffectOverlay` 型を整理する(Root 契約に不要になった型の削除、または標準テーマ内部用としての移設)

## 2. 共有層の整理

- [x] 2.1 `useSignageController` から `championHold` を除去し、優勝時のタイマー停止を `onAdvance('champion')` の受領(タイムアウトの肩代わり含む)に紐づける
- [x] 2.2 phase 算出を「優勝確定かつタイマー停止済みなら `champion`」に単純化し、参考値として `SignageData` で返し続ける
- [x] 2.3 演出 watchdog を「Root 契約では常時有効(既定 20 秒、`effectTimeoutMs` で上書き)」に変更する(旧「EffectOverlay を持たないテーマは即消化」の分岐を除去)

## 3. SignagePage の縮小と標準テーマの移行

- [x] 3.1 `src/pages/signage/themes/default/Root.tsx` を新設し、現行の phase による 4 画面切り替えと `EffectOverlay` の描画を移す(見た目・挙動は現状維持)
- [x] 3.2 `SignagePage` を「`theme.Root` の描画 + 共有 UI(RemoteQrButton / AudioUnlockNotice)+ no-session フォールバック + Wake Lock」に縮小する(`SignageBody` の switch を除去)
- [x] 3.3 `SIGNAGE_THEMES` の default 登録を Root 契約へ更新する

## 4. 検証

- [x] 4.1 `npm run format:check` / `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` を実行して通す
- [x] 4.2 ブラウザでサイネージの UI 確認: 待機 → 開始演出 → タイマー起動、一時停止 / 再開、レベル切替、ブレイク切替、リロード復元、優勝演出 → 優勝画面 + タイマー停止、QR 再表示ボタンの表示 / 優勝時の非表示
- [x] 4.3 delta spec と実装の整合を確認し、`openspec validate --change theme-root-contract` を通す(利用者に見える変更はないため updates.ts への追記は行わない)
