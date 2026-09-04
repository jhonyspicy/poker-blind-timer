## Why

現在のテーマ契約は「待機 / タイマー / ブレイク / 優勝の画面コンポーネント一式 + 演出オーバーレイ」を固定で要求し、どのタイミングでどの画面を出すかは共有層(`SignagePage` の phase 切り替え)が決めている。このため、画面間のクロスフェード遷移や 4 画面構成を取らない独自レイアウトなど、テーマ側で表示構成を自由に設計できない。表示の全権をテーマに委ね、共有層は「何が真実か(ドメイン状態)」の管理に徹する構造へ変える。

## What Changes

- **BREAKING(内部契約)**: `SignageTheme` を「Root コンポーネント 1 個 + `assets` + `effectTimeoutMs`」に変更する。`WaitingScreen` / `TimerScreen` / `BreakScreen` / `ChampionScreen` / `EffectOverlay` の個別スロットは廃止する
- 共有層はテーマの Root にドメイン状態(session / config / stats / roomName / now)と演出イベント(effectEvent / onAdvance / onDone)を渡すだけにし、いつ・どの画面や演出を表示するかは各テーマが決める
- phase(待機 / タイマー / ブレイク / 優勝の参考区分)は共有層が算出して渡すが、テーマは無視してよい
- 優勝演出の合図まで優勝画面への遷移を保留する機構(championHold)は、テーマ内部の表示判断に移す。合図(onAdvance)によるタイマー起動・タイマー停止のドメイン側の挙動は共有層に残る
- メッセージ処理(重複排除・ack)・タイマー進行・永続化・同期・演出イベントの検知条件・素材の先読み機構は引き続き共有層が担い、テーマは変更できない(現行仕様を維持)
- リモコン QR 再表示ボタン・音声アンロック通知は運営機能としてテーマ外(共有)に残す
- 利用者に見える挙動の変化はない(標準テーマの表示は現状維持)

## Capabilities

### New Capabilities

(なし)

### Modified Capabilities

- `signage-display`: 「テーマによる画面と素材の切り替え」要件のテーマ定義を「画面コンポーネント一式」から「Root コンポーネント 1 個」に変更する。表示の出し分け(画面遷移のタイミングを含む)はテーマの責務とし、共有層はドメイン状態と演出イベントの供給・演出の打ち切り(タイムアウト)のみ規定する

## Impact

- `src/pages/signage/themes/index.ts`: `SignageTheme` 型の再定義(Root 1 個 + assets + effectTimeoutMs)
- `src/pages/signage/SignagePage.tsx`: phase による switch と EffectOverlay の描画をやめ、`theme.Root` を 1 個描画する形へ縮小
- `src/pages/signage/useSignageController.ts`: championHold をテーマ側へ移した分の整理(phase 算出は参考値として維持)。タイマー停止のタイミングは合図(onAdvance)に紐づけたまま
- `src/pages/signage/themes/default/`: 現在の 4 画面 + 演出オーバーレイを内包する `Root.tsx` を新設(既存コンポーネントは内部実装として維持)
- 外部 API・データモデル・同期プロトコル・保存データへの影響なし。利用者向けのアップデート情報への追記は不要
