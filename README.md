# Blind Timer

ポーカートーナメント向けのブラインドタイマー。大画面に表示し、スマホから操作する。

## 概要

Blind Timer は、ポーカートーナメント運営で繰り返し使用するブラウザベースのブラインドタイマーです。

PC のブラウザで店舗のモニターに情報をフルスクリーン表示（サイネージ）し、運営者は手元のスマホのブラウザ（コントローラー）からリアルタイムで操作します。自前サーバーは立てず、できるだけミニマムな構成を目指します。

詳細な仕様は [OpenSpec](openspec/) で管理しています。**openspec/specs（確定仕様）がプロジェクトの最優先ドキュメントです。**

## システム構成

3 つの画面を GitHub Pages 上の静的サイトとして提供します。

- **エディタ** ([/editor](https://jhonyspicy.github.io/poker-blind-timer/editor)): PC でストラクチャー等を設定し、ローカルに保存。
- **サイネージ** ([/signage](https://jhonyspicy.github.io/poker-blind-timer/signage)): ブラインドタイマー本体。プレイヤー向けの大画面表示。
- **リモコン** ([/remote](https://jhonyspicy.github.io/poker-blind-timer/remote)): スマホのブラウザからタイマーを遠隔操作。

- **リアルタイム同期**: [Ably](https://ably.com/)（pub/sub）。リモコンが操作メッセージを publish し、サイネージが subscribe して表示を更新。
- **接続用 URL の発行**: Cloudflare Workers を利用。
- **ローカル保存**: IndexedDB（設定・ストラクチャーの保存、リロード耐性、再利用）。
- **ペアリング**: サイネージがリモコン用 URL を QR コードで表示。スマホで読み取って同じ Ably チャンネルに接続。

## 動作フロー

1. PC で**エディタ**を開き、ストラクチャーやアドオン等を入力してローカルに保存する
2. 同じ PC・同じブラウザで**サイネージ**を開くと、保存した設定のタイマーが表示される
3. サイネージがリモコン用 URL を発行し、QR コードで表示する
4. 運営者がスマホで QR を読み取り、**リモコン**画面からタイマーを操作する

設定から表示までは同一ブラウザ内（同一オリジン）で完結します（別 PC / 別 URL への受け渡しはしません）。

## 主な機能

現在は設計段階であり、実装済みの機能はまだありません。

### ストラクチャー設定（トーナメント開始前）

- 各レベルの SB / BB / Ante と継続時間
- ブレイク（休憩）の挿入位置
- レイトレジストレーション締め切り位置
- お店の名前、トーナメントタイトル、プライズ一覧
- アドオン / リバイの設定

### サイネージ表示項目

- お店の名前、トーナメントタイトル、プライズ一覧
- 現在のブラインド（SB / BB / Ante）と残り時間
- 次のブラインド（SB / BB / Ante）
- 現在のプレイヤー数（Current Players）、総エントリー数（Total Entries）、アドオン数（Add-ons）
- 次のブレイクまでの残り時間
- レイトレジストレーション終了までの残り時間

### コントローラー操作

- プレイヤー人数の増減
- アドオン / リバイ数の増減・管理
- 一時停止 / 再開
- 次のブラインドへ進む / 前のブラインドへ戻る
- トーナメントタイトルの変更

### 将来の構想（未確定）

レベルアップやイン・ザ・マネーなどの演出強化、フォトモード、店舗向け SaaS 化などの構想がありますが、現在のスコープには含まれていません。

## 画面設計の方針

- 16:9 のモニターでのフルスクリーン表示を基本とする
- 重要な情報ほど大きく、遠くからでも読みやすい文字サイズとコントラストにする
- デザイン / レイアウトは既存のものを使用する

## 技術スタック

- 言語: TypeScript
- フロントエンド: React + Vite（エディタ / サイネージ = PC、リモコン = スマホ）
- ルーティング: React Router（`/editor` `/signage` `/remote`）
- ホスティング: GitHub Pages（静的サイト、GitHub Actions で自動デプロイ）
- 接続用 URL 発行・Ably トークン認証: Cloudflare Workers
- リアルタイム通信: [Ably](https://ably.com/)
- ローカル保存: IndexedDB（[idb](https://github.com/jakearchibald/idb)）
- テスト: Vitest / Lint: ESLint / Formatter: Prettier

## セットアップ

Node.js 22 以上と npm が必要です。

```bash
git clone https://github.com/jhonyspicy/poker-blind-timer.git
cd poker-blind-timer
npm install
```

## 開発用コマンド

| コマンド            | 内容                                      |
| ------------------- | ----------------------------------------- |
| `npm run dev`       | 開発サーバーを起動                        |
| `npm run build`     | 型チェック + 本番ビルド（`dist/` に出力） |
| `npm run preview`   | ビルド結果をローカルで確認                |
| `npm test`          | テストを実行（Vitest）                    |
| `npm run lint`      | ESLint を実行                             |
| `npm run typecheck` | TypeScript の型チェック                   |
| `npm run format`    | Prettier で整形                           |

## ディレクトリ構成

```text
.
├── src/               # React アプリ
│   ├── pages/         # 画面(editor / signage / remote)
│   ├── domain/        # タイマーロジック・統計導出(React 非依存の純粋 TS)
│   ├── storage/       # IndexedDB アクセス
│   └── realtime/      # Ably 接続・メッセージ型定義
├── worker/            # Cloudflare Worker(接続 URL 発行・Ably トークン認証)
├── openspec/          # OpenSpec による仕様・変更提案の管理(最優先ドキュメント)
│   ├── specs/         # 確定した仕様
│   └── changes/       # 進行中・アーカイブ済みの変更提案
├── AGENTS.md          # AI コーディングエージェント向けの開発指示書
└── README.md
```

## 環境変数

現時点では環境変数は使用していません。Ably の API キー等が必要になった時点で `.env.example` とともに追記します。

## デプロイ

- フロントエンド: GitHub Pages（`https://jhonyspicy.github.io/poker-blind-timer/`）
- 接続用 URL 発行 API: Cloudflare Workers

デプロイ手順は実装開始後に追記します。

## ライセンス

未定です。
