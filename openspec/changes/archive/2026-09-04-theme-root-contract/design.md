## Context

現状のサイネージは、`SignagePage` が phase(待機 / タイマー / ブレイク / 優勝)に応じてテーマの 4 画面コンポーネントを切り替え、演出オーバーレイも `SignagePage` が描画している。`SignageTheme` 型が 4 画面 + `EffectOverlay` のスロットを固定で要求するため、テーマは各穴を埋めることしかできず、画面間の遷移演出や独自の画面構成を持てない。

一方、`useSignageController` はリモコンコマンドの適用(requestId 重複排除・ack)、タイマー進行、マイルストーン判定、IndexedDB 永続化、スナップショット配信という正確性の中核を担っており、既存仕様には「タイマー進行・同期・状態の永続化・演出イベントの検知条件・先読みの機構はテーマ間で共有し、テーマはその挙動を変更してはならない(MUST NOT)」という制約がある。

## Goals / Non-Goals

**Goals:**

- テーマ契約を Root コンポーネント 1 個に縮め、いつ・どの画面や演出を表示するかをテーマの全権にする
- 共有層は「何が真実か」(ドメイン状態)の管理と供給に徹する
- 標準テーマの見た目・挙動は現状維持(利用者に見える変化なし)

**Non-Goals:**

- リモコンの生メッセージをテーマに渡すこと(正確性ロジックの共有を崩すため行わない)
- 効果音の再生タイミング・演出イベントの検知条件・先読み機構のテーマへの委譲
- 新テーマの追加

## Decisions

### D1: テーマ契約は Root 1 個 + assets + effectTimeoutMs

```ts
interface SignageTheme {
  Root: ComponentType<SignageThemeProps>
  assets?: readonly string[]
  effectTimeoutMs?: number
}
```

4 画面 + `EffectOverlay` のスロット方式は廃止する。`assets`(先読み宣言)と `effectTimeoutMs`(演出打ち切りの上限)は共有層の機構が参照するメタデータなので宣言として残す。

**代替案**: スロット方式を保ちつつ任意スロットを増やす → スロットが増えるほど共有層がテーマの内部構成を知ることになり、目的と逆行するため不採用。

### D2: Root にはドメイン状態を渡す。メッセージは渡さない

`SignageThemeProps` は以下とする:

```ts
interface SignageThemeProps {
  theme: ThemeId                 // 素材パスの解決用
  session: SessionState
  config: TournamentConfig       // セッション上書きを反映した実効 config
  stats: TournamentStats
  roomName: string
  now: number
  phase: SignagePhase            // 参考値。テーマは無視してよい
  effectEvent: EffectEvent | null
  onAdvance: (event: EffectEvent) => void
  onDone: (event: EffectEvent) => void
}
```

コマンドの重複排除・ack・永続化・スナップショット配信・タイマー計算をテーマごとに再実装させないため、テーマが受け取るのは確定済みの状態のみとする。既存仕様の共有 MUST NOT を維持する。

### D3: phase は共有層が算出し、参考値として渡す

待機 / タイマー / ブレイク / 優勝の区分はレイトレジ・タイマー状態から導出するドメイン判断であり、テーマごとに再実装するとズレの温床になる。共有層で 1 箇所算出して渡し、テーマは使っても無視してもよい。QR 再表示ボタンの表示判定(優勝局面では出さない)など共有 UI でも同じ値を使う。

### D4: championHold はテーマの表示判断へ移し、タイマー停止は onAdvance('champion') に紐づける

現在は `championHold`(優勝演出が合図を返すまで優勝画面への遷移を保留)が共有層の phase 算出に食い込んでいる。「優勝画面をいつ出すか」は表示の話なのでテーマへ移す。ドメイン側は、優勝演出の合図(`onAdvance('champion')`)を受けた時点でタイマーを `finished` にする(タイムアウトによる肩代わりでも同じ経路を通る)。

これにより共有層の phase は「優勝確定かつタイマー停止済みなら `champion`」と単純化でき、合図前(演出の透過動画の背後)は phase が `timer` のままになるため、現行の見え方(演出中はタイマー画面が背後に残る)が参考値としてもそのまま表現される。標準テーマは phase に従うだけで現行と同じ挙動になる。

### D5: 演出イベントの消化はテーマの義務。watchdog は共有層に残す

旧契約では「`EffectOverlay` を持たないテーマ」を共有層が検知して即消化していたが、Root 契約ではテーマの内部構成を知らないため検知できない。代わりに「Root は `effectEvent` を受け取ったら、演出を表示しない場合も含めて必ず `onDone` を呼ぶ」ことをテーマの契約義務とする。実装ミス・再生遅延への備えとして、共有層の上限時間(既定 20 秒、`effectTimeoutMs` で上書き)による合図・終了の肩代わりは現行どおり維持する。

**トレードオフ**: 演出を扱わないテーマの作者が `onDone` を呼び忘れると、開始操作からタイマー起動まで最大 20 秒待たされる。標準テーマを参照実装とし、契約を型の doc コメントに明記して緩和する。

### D6: 運営機能はテーマ外に残す

QR 再表示ボタン・音声アンロック通知・Wake Lock は運営者向けの共有機能であり、テーマの見た目の自由に含めない。`SignagePage` が Root と並べて描画する。効果音の再生(レベルアップ・一時停止等)も現行どおり共有層(`playSound`)のまま。

## Risks / Trade-offs

- [テーマが `effectEvent` を消化し忘れ、進行が最大 20 秒止まる] → 共有 watchdog で必ず回復する。契約を型コメントと仕様に明記し、標準テーマを参照実装とする
- [標準テーマの移行で表示の退行が起きる] → 既存の 4 画面 + `EffectOverlay` を `Root.tsx` 内へそのまま移すだけの機械的な移行に留め、AGENTS.md 10 の UI 確認項目(一時停止 / 再開、レベル切替、ブレイク、リロード復元、優勝遷移)で目視確認する
- [championHold の移動で優勝画面への切り替えタイミングが変わる] → タイマー停止条件を「合図の受領」に一本化し、標準テーマは phase(タイマー停止済みで `champion`)に従うため、切り替えの観測タイミングは現行と一致する
