# Add Round2 Theme

## Why

店舗「Round2」の運営で使う、店舗ブランド(ブルー×シアン、ロゴバッジ)に合わせた専用のサイネージテーマが欲しい。ブレイク中はドリンクメニューやプライズの告知を流したい。

## What Changes

- 新テーマ「Round2」(id: `round2`、表示名: Round2)を追加する
  - Claude Design のモック(Tournament Waiting / Tournament Clock / Break Screen / Champion Screen)に準拠した 4 画面
  - タイマー画面の背景はループ動画(`videos/timer-background.webm`)。待機・優勝は背景画像
  - ブレイク画面の右半分は広告カルーセル(ドリンク広告画像・プライズ一覧スライド・GTO Wizard 広告)。ブレイク残り 60 秒で「まもなく再開」画像に切り替える
  - 全画面演出(開始・インマネ・HEADS UP・優勝)は表示せず、即座に終了を返す
  - 一時停止はテーマ独自の PAUSED 帯 + カウントダウンの点滅で表示する
- エディタのテーマ選択肢に「Round2」を追加する(`src/domain/theme.ts` の `THEMES`)
- サイネージのテーマレジストリ(`src/pages/signage/themes`)に `round2` を登録する

## Capabilities

### New Capabilities

(なし)

### Modified Capabilities

- `signage-display`: 提供テーマに `round2` を追加し、その表示・演出の要件を追記する(ADDED Requirement)

## Impact

- `src/domain/theme.ts` / `src/domain/theme.test.ts`: `round2` の登録と解決テスト
- `src/pages/signage/themes/index.ts`: `SIGNAGE_THEMES` に `round2` を登録
- `src/pages/signage/themes/round2/`: 新規。Root・4 画面・PAUSED 帯・assets 宣言
- `public/themes/round2/`: 新規素材(背景画像・背景動画・広告画像)
- `index.html`: Google Fonts に Archivo Black / Barlow / Barlow Semi Condensed / Zen Old Mincho を追加
- `src/pages/home/updates.ts`: アップデート情報に追記
- 共有層・同期プロトコル・データモデルへの変更はなし
