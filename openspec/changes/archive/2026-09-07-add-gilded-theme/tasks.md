# Tasks: GILDED テーマの追加

## 1. テーマの登録

- [x] 1.1 `src/domain/theme.ts` の `THEMES` に `{ id: 'gilded', label: 'GILDED' }` を追加し、`src/domain/theme.test.ts` に解決テストを追加する
- [x] 1.2 `src/pages/signage/themes/index.ts` の `SIGNAGE_THEMES` に `gilded` を登録する(assets 宣言なし)

## 2. GILDED の画面実装(src/pages/signage/themes/gilded/)

- [x] 2.1 テーマ共通の土台を作る: 1920×1080 ステージ + scale フィットのフック、等幅数字表示、Google Fonts への Big Shoulders Display / Bebas Neue / Anton の追加
- [x] 2.2 WaitingScreen: デザインモック Tournament Waiting の移植(金枠 + 四隅装飾、店名・タイトル・WAITING TO START バッジ・ENTRIES / 1ST PRIZE・STARTING BLINDS)
- [x] 2.3 ClockScreen: デザインモック Tournament Clock の移植。タイマー / ブレイク共通レイアウトで共通 MUST の全項目 + K 表記 + レベルアップ演出(LEVEL UP 表示 + 縦ロール + 発光ブースト)+ 残り 60 秒警告色
- [x] 2.4 PausedBanner: デザインモック Pause Overlay の移植(暗転 + 金罫バンド)。タイマー / ブレイク両局面で表示
- [x] 2.5 ブレイク表示: ClockScreen のバッジを BREAK・主カウントダウンをブレイク残りに切り替え、次に始まるブラインドを主表示にする
- [x] 2.6 ChampionScreen: デザインモック Champion Screen の移植(店名・タイトル・CHAMPION の金グラデ + 王冠罫。背景画像は任意素材)
- [x] 2.7 GildedEffectOverlay: 4 イベントの CSS 演出。2 秒で onAdvance、5 秒以内に onDone、reduced-motion で簡易化、クリーンアップでタイマー解除
- [x] 2.8 Root.tsx: phase に従って画面を切り替え、effectEvent を GildedEffectOverlay に渡す

## 3. 仕上げ

- [x] 3.1 `src/pages/home/updates.ts` のアップデート情報に GILDED テーマ追加を追記する(10 件制限を維持)
- [x] 3.2 format / lint / typecheck / test / build を実行して全て通す
- [x] 3.3 ブラウザで検証: 待機・タイマー(全項目 / K 表記 / 1 時間超 / 警告色)・レベルアップ・一時停止・ブレイク・優勝・演出タイミング(2 秒合図 / 5 秒終了)・リロード復元
