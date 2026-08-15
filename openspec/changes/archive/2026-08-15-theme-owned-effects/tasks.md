## 1. 共通語彙の切り出し

- [x] 1.1 `src/pages/signage/events.ts` を新規作成し、`VideoOverlay.tsx` の `VideoEvent` を `EffectEvent` として移す(`tournament-start` / `in-the-money` / `heads-up` / `champion`)
- [x] 1.2 `useSignageController.ts` の `VideoEvent` 参照を `EffectEvent` に置き換える

## 2. テーマ契約の拡張

- [x] 2.1 `themes/index.ts` に `EffectOverlayProps`(`event` / `onAdvance` / `onDone`)を定義する
- [x] 2.2 `SignageTheme` に `EffectOverlay?`(演出コンポーネント)・`assets?`(テーマ起点の相対パス配列)・`effectTimeoutMs?` を追加し、各フィールドの意味と省略時の挙動をコメントで明示する
- [x] 2.3 テーマ追加時の手順コメント(`themes/index.ts` 冒頭)を新しい契約に合わせて更新する

## 3. 標準テーマへの演出の移設

- [x] 3.1 `VideoOverlay.tsx` / `VideoOverlay.module.css` を `themes/default/VideoEffectOverlay.tsx` / `VideoEffectOverlay.module.css` へ移動する
- [x] 3.2 `VideoEffectOverlay` の props を `EffectOverlayProps` に合わせる(`onStarted` → 内部で 7 秒後に `onAdvance` を呼ぶ、`onDone` は引数なし)
- [x] 3.3 再生開始からの 7 秒タイマーをコンポーネント内に持たせ、アンマウント時に確実に解除する
- [x] 3.4 `themes/index.ts` の `default` エントリに `EffectOverlay` と `assets`(動画 4 種 × webm/ogg・効果音 5 種・`images/champion.png`)を登録する

## 4. 共有コントローラの整理

- [x] 4.1 `START_SCREEN_DELAY_MS` / `START_TIMER_DELAY_MS` / `CHAMPION_SCREEN_DELAY_MS` を削除する
- [x] 4.2 `earlyTimerScreen` state と、それを参照する `phase` 算出の分岐を削除する
- [x] 4.3 `onOverlayStarted` / `onOverlayDone` を `onEffectAdvance` / `onEffectDone` に置き換える。`onEffectAdvance` は `tournament-start` でタイマー起動、`champion` で優勝ホールド解除を行う
- [x] 4.4 `onEffectDone` が合図より先に呼ばれた場合、`onEffectAdvance` を補完してから次のイベントへ進める
- [x] 4.5 演出ごとの強制タイムアウト(既定 20 秒 / テーマの `effectTimeoutMs` で上書き)を追加し、期限到達で `onEffectAdvance` と `onEffectDone` を肩代わりする
- [x] 4.6 `SignageData` の `overlayEvent` / `onOverlayDone` / `onOverlayStarted` を新しい名前に合わせて更新する

## 5. 画面側の追従

- [x] 5.1 `SignagePage.tsx` の `VideoOverlay` 直接マウントを、テーマの `EffectOverlay` のマウントに置き換える(未定義のテーマでは何も描画しない)
- [x] 5.2 `themes/default/TimerScreen.tsx` から `waitingPreview` とその分岐を削除する

## 6. 先読みの宣言駆動化

- [x] 6.1 `preload.ts` の `VIDEO_EVENTS` / `SOUND_EVENTS` / `IMAGE_PATHS` を削除し、`preloadSignageAssets(theme, assets)` がテーマの宣言を受け取る形にする
- [x] 6.2 `useSignageController.ts` の先読み呼び出しを、解決済みテーマの `assets` を渡す形に更新する
- [x] 6.3 `themeAssetPath()` / `assetUrl()` の公開インターフェースは変更しないことを確認する(将来の外部配信への移行点を 1 箇所に保つため)

## 7. 検証

- [x] 7.1 `npm run format` / `npm run lint` / `npm run typecheck` / `npm run test` / `npm run build` を実行する
- [x] 7.2 標準テーマで開始 → タイマー画面遷移(合図の 7 秒)・ブレイク・一時停止 / 再開・レベル移動を手動確認する
- [x] 7.3 優勝確定 → 優勝演出 → 優勝画面への遷移とタイマー停止を手動確認する
- [x] 7.4 リロード後の状態復元と、演出の重複再生が起きないことを確認する
- [x] 7.5 開発者ツールのネットワークで、標準テーマの先読みに 404 が出ないことを確認する

> 7.2 の補足: 検証環境のブラウザが透過 webm(VP9 アルファ)を再生できず `currentTime` が進まなかったため、
> 「再生開始から 7 秒で合図」の経路は実測できていない。代わりに再生停滞ウォッチドッグ経由の
> フォールバック(演出が再生できない場合に即タイマー開始)が正しく働くことを確認した。
> 7 秒の値と計測起点は移設前と同一のため、実機での再確認が望ましい。

## 8. ドキュメント

- [x] 8.1 `src/pages/home/updates.ts` の `ALL_UPDATES` 先頭に、開始演出からタイマー起動までの挙動変更を利用者向けの文言で追記し、10 件を超えた古い行を削除する
- [x] 8.2 `/opsx:sync` で delta spec を `openspec/specs/signage-display/spec.md` へ反映し、チェンジをアーカイブする
