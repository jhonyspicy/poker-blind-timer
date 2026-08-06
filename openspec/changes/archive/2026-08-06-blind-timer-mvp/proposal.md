# Blind Timer MVP

## Why

ポーカートーナメント運営で繰り返し使えるブラインドタイマーがまだ存在しない(リポジトリは設計段階で実装コードがゼロ)。docs/spec.md で仕様が確定したため、実際のトーナメント運営で使える MVP を最短で構築・リリースする。

## What Changes

- React + Vite + TypeScript のプロジェクト基盤を新規作成し、GitHub Pages(`https://jhonyspicy.github.io/poker-blind-timer/`)へのデプロイパイプラインを整備する
- 4 つの画面を追加する:
  - **トップページ**(`/`): 保存済みタイマー設定の一覧(更新日時順)と開始/再開・編集・複製・削除、店舗情報(店名)の表示とインライン編集。開始/再開はペアリングモーダル(QR コード表示 → リモコン接続検知 → サイネージへ遷移)を開く
  - **エディタ**(`/editor`): ストラクチャー(SB/BB/Ante/継続時間/ブレイク/レイトレジ締め切りマーカー)、トーナメントタイトル、プライズを入力し IndexedDB に保存(エントリー案内は 2026-08-06 に廃止。design.md D16)
  - **サイネージ**(`/signage`): タイマー本体。待機 / タイマー / ブレイク / 優勝の 4 画面と演出動画オーバーレイを持ち、ブラインド・統計(操作履歴から導出)を大画面フルスクリーン表示
  - **リモコン**(`/remote`): スマホからトーナメント開始、一時停止/再開、レベル移動、残り時間の変更、エントリー/バスト/アドオンの記録と履歴の修正・削除を操作
- Cloudflare Workers による接続用 URL 発行と Ably トークン認証エンドポイントを追加する
- Ably(pub/sub)によるリモコン → サイネージのリアルタイム同期を実装する
- タイマー状態の IndexedDB 保存によるリロード復元を実装する

## Capabilities

### New Capabilities

- `tournament-config`: ストラクチャー・タイトル・プライズの入力、検証、IndexedDB への保存・読み込み・再利用(エディタ画面)と、設定一覧の管理(開始・編集・複製・削除)および店舗情報(店名)の管理(トップページ)
- `signage-display`: タイマー本体。待機 / タイマー / ブレイク / 優勝の 4 画面、レベル進行と演出(レベルアップ・一時停止・演出動画オーバーレイ)、残り時間・ブラインド・統計(操作履歴から導出)の大画面表示、状態の永続化とリロード復元(サイネージ画面)
- `remote-control`: スマホからのトーナメント開始・タイマー操作・履歴記録/修正 UI と操作メッセージの publish(リモコン画面)
- `realtime-pairing`: Cloudflare Workers による接続 URL 発行・Ably トークン認証、トップページの開始モーダルでの QR ペアリングとリモコン接続検知(presence)、Ably チャンネルでのメッセージ同期

### Modified Capabilities

(なし — 既存の spec はまだ存在しない)

## Impact

- 新規コード: フロントエンド一式(React + Vite + TypeScript)、Cloudflare Workers(別途デプロイ)
- 新規依存: react, react-dom, react-router, ably, QR コード生成ライブラリ, IndexedDB ラッパー(選定は design.md)
- CI/CD: GitHub Actions による GitHub Pages デプロイを新設
- 外部サービス: Ably アカウント(API キーは Workers 側のみに保持)、Cloudflare アカウント
- 既存コードへの影響: なし(実装コードが存在しないため)。README.md の技術スタック・セットアップ・開発用コマンドのセクションを実装後に更新する
