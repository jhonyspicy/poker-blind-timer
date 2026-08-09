# add-signage-themes

## Why

サイネージの見た目は現在 1 種類に固定されており、店舗の雰囲気やイベントに合わせて「動画・効果音・画面デザインごとガラッと変える」手段がない。CSS の色替えではなく、画面コンポーネント一式と演出素材のセットを丸ごと差し替えられる「テーマ」の仕組みを導入する。

## What Changes

- サイネージに「テーマ」の概念を導入する。テーマ = 画面コンポーネント一式(タイマー / 待機 / ブレイク / 優勝 + 背景・演出)+ 素材ディレクトリ(動画・効果音・画像)のセット
- 既存のサイネージ UI・素材を `default` テーマとして移設する(利用者から見た表示は変えない)
- 演出素材の配置規約を `public/videos|sounds|images/` から `public/themes/<テーマ名>/videos|sounds|images/` に変更する
- `TournamentConfig` に `theme` フィールドを追加する(省略時は `default`。旧データ・旧エクスポートファイルは `default` として扱う)
- エディタの「トーナメント情報」セクションにテーマ選択 UI を追加する
- タイマー進行・同期のロジック(`useSignageController`、素材先読み、動画オーバーレイ再生機構)はテーマ間で共有し、複製しない
- 当面提供するテーマは `default` のみ(新テーマの追加は本チェンジのスコープ外)

## Capabilities

### New Capabilities

(なし)

### Modified Capabilities

- `tournament-config`: トーナメント情報にテーマ選択を追加。設定データモデルに `theme` を追加し、エクスポート / インポートでも保持する(不明・未指定のテーマは `default` に解決)
- `signage-display`: サイネージはトーナメント設定のテーマに応じた画面コンポーネント一式と素材ディレクトリを使用する。素材パス規約をテーマ別ディレクトリに変更

## Impact

- `src/domain/types.ts` / `config.ts` / `configExport.ts`: `theme` フィールドの追加と検証・エクスポート対応
- `src/pages/signage/`: 画面コンポーネントを `themes/default/` へ移設。`preload.ts` / `sounds.ts` / `VideoOverlay.tsx` の素材パスをテーマ対応に変更
- `src/pages/editor/EditorPage.tsx`: テーマ選択 UI の追加
- `public/videos|sounds|images/` → `public/themes/default/` へ移動
- リモコン・同期プロトコル: 変更なし(テーマはサイネージがローカルの設定から読む)
- `src/pages/home/updates.ts`: アップデート情報の追記(テーマ選択が利用者に見えるため)
