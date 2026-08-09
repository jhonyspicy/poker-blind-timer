# add-signage-themes 設計

## Context

サイネージの画面コンポーネント(TimerScreen / BreakScreen / WaitingScreen / ChampionScreen と背景・演出)は `src/pages/signage/` 直下にあり、演出素材は `public/videos|sounds|images/` の固定パス規約で解決している。素材の解決は `preload.ts` / `sounds.ts` / `VideoOverlay.tsx` の 3 ファイルに集約済み。タイマー進行・同期のロジックは `useSignageController.ts` に分離されている。

「見た目がガラッと変わる」テーマを、ロジックを複製せずに追加できる仕組みを入れる。当面のテーマは `default` のみ。

## Goals / Non-Goals

**Goals:**

- テーマ = 画面コンポーネント一式 + 素材ディレクトリのセットとして定義できる仕組み
- 既存 UI・素材を `default` テーマへ移設(利用者から見た表示は不変)
- エディタの「トーナメント情報」でテーマを選択でき、設定として保存・エクスポートされる
- タイマー進行・同期・素材先読み・動画再生機構はテーマ間で共有

**Non-Goals:**

- 新テーマの実装(2 つ目以降のテーマは別チェンジ)
- リモコンからのテーマ切り替え・同期プロトコルの変更
- テーマのユーザー定義(素材アップロード等)・テーマ別のコード分割(テーマが増えて初回ロードが問題になったら検討)

## Decisions

### D1: テーマはトーナメント設定(`TournamentConfig.theme`)で選ぶ

サイネージ端末側の設定ではなく、設定データに `theme?: string` を持たせる(省略時 `default`)。既存の保存・複製・エクスポート / インポートの流れにそのまま乗り、旧データはフィールド欠落 = `default` として自然に互換になる。IndexedDB のスキーマ変更(マイグレーション)は不要。

代替案: サイネージ側のローカル設定 — 却下。設定と見た目の対応が端末ごとにずれ、「このトーナメントはこの演出」という運用ができない。

### D2: テーマレジストリは静的 import の定数マップ

`src/pages/signage/themes/index.ts` に:

```ts
interface SignageTheme {
  id: string
  label: string // エディタの選択肢に表示する名前
  WaitingScreen / TimerScreen / BreakScreen / ChampionScreen: コンポーネント
}
const SIGNAGE_THEMES: Record<string, SignageTheme>
function resolveTheme(id: string | undefined): SignageTheme // 不明・未指定は default
```

エディタの選択肢もこのレジストリから列挙し、テーマ追加時の変更箇所を「テーマディレクトリ + レジストリ 1 行」に閉じる。`resolveTheme` が唯一のフォールバック地点で、不明なテーマ id はどこでも `default` に解決する(インポートしたファイルに未知のテーマ名があっても壊れない)。

### D3: テーマの所有物と共有物の境界

**テーマ側**(`src/pages/signage/themes/default/` へ移設): WaitingScreen / TimerScreen / BreakScreen / ChampionScreen、ChipFloatBackground / TimerBackground / BreakBackground、PauseTapeOverlay、TabularNumber、各 module.css。見た目に属するものはすべてテーマが所有し、テーマ間で流用したければ import で共有する(強制しない)。

**共有側**(`src/pages/signage/` 直下に残す): SignagePage(テーマ解決とフェーズ分岐)、useSignageController、preload.ts、sounds.ts、VideoOverlay.tsx(再生機構。表示スタイルは全画面固定で共通)。

### D4: 素材パスは `public/themes/<テーマ名>/videos|sounds|images/`

`preload.ts` / `sounds.ts` / `VideoOverlay.tsx` にテーマ id を渡してベースパスを組み立てる。「404 = 素材なしとしてスキップ」の既存挙動はそのまま活き、テーマは素材を部分的にしか持たなくてもよい。既存素材は `public/themes/default/` へ git mv する。

`preload.ts` の一回きりフラグ(`started`)はテーマ id をキーにする。サイネージは 1 セッション 1 テーマなので実質変化なし。

### D5: エクスポート形式は formatVersion 1 のまま `theme` を任意フィールドで追加

`ExportedConfig` に `theme?: string` を追加。欠落・文字列以外は含めずに読み込む(= `default` 扱い)。任意フィールドの追加は旧バージョンの読み込み側を壊さないため、formatVersion は上げない。

### D6: エディタ UI は「トーナメント情報」内のセレクトボックス

タイトル・プライズと並ぶ 1 項目としてテーマ選択(select)を置く。選択肢はレジストリの `label` を表示。当面は 1 択だが、データの通り道を最初から本番の UI で通しておく。

## Risks / Trade-offs

- [素材パス変更で配信キャッシュが無効になる] → 静的サイトで初回ダウンロードが一度増えるだけ。先読み機構があるため運用影響なし
- [テーマが増えると全テーマのコードがバンドルに入る] → 当面 1 テーマなので問題なし。増えたら `React.lazy` によるテーマ単位のコード分割を検討(Non-Goal に明記)
- [画面コンポーネントの移設で import パスが広範囲に変わる] → 移設は git mv + import 修正のみとし、ロジック変更と混ぜない(タスクを分ける)

## Migration Plan

1. 素材を `public/themes/default/` へ移動し、パス解決をテーマ対応にする
2. 画面コンポーネントを `themes/default/` へ移設し、レジストリを導入
3. `theme` フィールドとエディタ UI を追加
4. 旧データ・旧エクスポートファイルはフィールド欠落として `default` に解決されるため、データ移行処理は不要

## Open Questions

(なし — テーマ選択の配置・当面 default のみ・移行方針はユーザー確認済み)
