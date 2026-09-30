# Tasks: Round2 テーマの追加

## 1. テーマの登録

- [x] 1.1 `src/domain/theme.ts` の `THEMES` に `{ id: 'round2', label: 'Round2' }` を追加し、`src/domain/theme.test.ts` に解決テストを追加する
- [x] 1.2 `src/pages/signage/themes/index.ts` の `SIGNAGE_THEMES` に `round2` を登録する
- [x] 1.3 素材を `public/themes/round2/` に配置し、`assets.ts` に宣言する

## 2. Round2 の画面実装(src/pages/signage/themes/round2/)

- [x] 2.1 共通の土台: ステージ scale フック、等幅数字、テキスト幅フィット、店名バッジ、Google Fonts の追加
- [x] 2.2 WaitingScreen: モック Tournament Waiting の移植
- [x] 2.3 ClockScreen: モック Tournament Clock の移植(背景動画、共通 MUST の全項目、K 表記、残り 60 秒の警告色、レベルアップの発光)
- [x] 2.4 BreakScreen: モック Break Screen の移植(広告カルーセル、プライズ一覧スライド、まもなく再開)
- [x] 2.5 ChampionScreen: モック Champion Screen の移植
- [x] 2.6 PausedBanner: タイマー / ブレイク両画面で表示
- [x] 2.7 Root: phase に従って画面を切り替え、演出イベントは即座に onDone

## 3. 仕上げ

- [x] 3.1 アップデート情報に追記する
- [x] 3.2 format / lint / typecheck / test / build
- [x] 3.3 ブラウザで各画面を確認する
