# add-signage-themes タスク

## 1. データモデルとエクスポート対応

- [x] 1.1 `TournamentConfig` に `theme?: string` を追加し、テーマ id 定数と `resolveTheme` のフォールバック方針を `src/domain` 側で型として定める(検証: 未指定・不明は default 扱い)
- [x] 1.2 `configExport.ts` の `ExportedConfig` / `buildExportFile` / `parseExportFile` / `toImportedConfigs` を `theme` 任意フィールド対応にする(欠落・非文字列は含めない = default 扱い。formatVersion は 1 のまま)
- [x] 1.3 `config.test.ts` / `configExport.test.ts` にテーマの保存・エクスポート・欠落フォールバックのテストを追加する(テーマ解決は theme.test.ts に配置)

## 2. 素材ディレクトリのテーマ化

- [x] 2.1 `public/videos|sounds|images/` を `public/themes/default/videos|sounds|images/` へ git mv する
- [x] 2.2 `preload.ts` / `sounds.ts` / `VideoOverlay.tsx` をテーマ id を受け取ってベースパスを組み立てる形に変更する(preload の一回きりフラグはテーマ id をキーにする)

## 3. 画面コンポーネントのテーマ化

- [x] 3.1 画面・背景・演出コンポーネント(WaitingScreen / TimerScreen / BreakScreen / ChampionScreen / ChipFloatBackground / TimerBackground / BreakBackground / PauseTapeOverlay / TabularNumber と各 module.css)を `src/pages/signage/themes/default/` へ移設する(git mv + import 修正のみ。ロジック変更を混ぜない)
- [x] 3.2 `src/pages/signage/themes/index.ts` にテーマレジストリ(`SignageTheme` インターフェース、`SIGNAGE_THEMES`、`resolveTheme`)を実装する
- [x] 3.3 `SignagePage.tsx` がセッションの設定からテーマを解決し、レジストリのコンポーネントで各フェーズを表示するようにする

## 4. エディタ UI

- [x] 4.1 `EditorPage.tsx` の「トーナメント情報」セクションにテーマ選択(select。選択肢はレジストリから列挙)を追加し、保存・再編集で選択が維持されることを確認する

## 5. 仕上げ

- [x] 5.1 `src/pages/home/updates.ts` にアップデート情報を追記する(10 件超の古い行は削除)
- [x] 5.2 Formatter / Lint / 型チェック / テスト / ビルドを実行する
- [x] 5.3 サイネージの表示確認: 待機 → 開始演出 → タイマー → ブレイク → 優勝、効果音、一時停止テープ、リロード復元が従来どおり動くこと(素材パス変更のリグレッション確認)
- [x] 5.4 openspec のデルタ仕様を main specs へ sync し、チェンジを archive する
