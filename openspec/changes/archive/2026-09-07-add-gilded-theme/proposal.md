# Add GILDED Theme

## Why

サイネージのテーマ機構(Root コンポーネント 1 個 + 素材ディレクトリ + 宣言メタデータ)は整備済みだが、提供テーマは標準テーマ(`default`)1 つのみで、店舗の雰囲気に合わせた見た目の選択肢がない。高級感のある会場・イベント向けに、深いグリーン×ゴールドのラグジュアリーな新テーマ「GILDED」を追加する。

## What Changes

- 新テーマ「GILDED」(id: `gilded`、表示名: GILDED)を追加する
  - 深いグリーン×ゴールドのアール・デコ調ラグジュアリーデザイン(Claude Design のモックに準拠)。待機 / タイマー / ブレイク / 優勝の 4 局面を専用画面で表示する
  - 演出(開始・インザマネー・ヘッズアップ・優勝など)は動画素材に依存しない CSS ベースの実装とし、素材未配置でも演出込みで成立する
  - 効果音は素材ディレクトリ `themes/gilded/sounds/` に配置された分のみ再生する(未配置はスキップ。既存仕様どおり)
- エディタのテーマ選択肢に「GILDED」を追加する(`src/domain/theme.ts` の `THEMES`)
- サイネージのテーマレジストリ(`src/pages/signage/themes`)に `gilded` を登録する

## Capabilities

### New Capabilities

(なし。既存のテーマ機構の範囲内で提供テーマを 1 つ追加する)

### Modified Capabilities

- `signage-display`: 提供テーマに `gilded` を追加し、その表示・演出実装(CSS ベース、動画素材に依存しない)の要件を追記する(ADDED Requirement)

tournament-config は「選択肢はアプリが提供するテーマの一覧から選ぶ」と定義済みで要件変更なし(GILDED は一覧に自動的に並ぶ)。

## Impact

- `src/domain/theme.ts`: `THEMES` に `gilded` を追加(エディタの選択肢・フォールバック解決に反映)
- `src/pages/signage/themes/index.ts`: `SIGNAGE_THEMES` に `gilded` を登録
- `src/pages/signage/themes/gilded/`: 新規。Root・各局面の画面・CSS 演出・assets 宣言
- `public/themes/gilded/`: 新規素材ディレクトリ(効果音は後日配置可。初期は空でも成立)
- `src/pages/home/updates.ts`: アップデート情報に追記(利用者に見える変更)
- 共有層(useSignageController)・同期プロトコル・データモデルへの変更はなし
