## Why

リモコンのボタンを押しても、コマンドがサイネージへ届いたのか分からない。押した手応えが無いためストレスになり、不安から同じボタンを連打してしまう。さらに、受付とディーラーをワンオペで回している店舗では、ボタンを押した直後にシャッフルなどの作業へ移るため、送信に失敗しても気づけない(GitHub Issue #17)。

現状の実装ではコマンドを fire-and-forget で publish しており、送信結果を一切参照していない。サイネージが落ちていても、リモコン側は何事もなかったように見える。

## What Changes

- サイネージがリモコンコマンドを処理した時点で、`requestId` を含む **ACK メッセージ**をチャンネルへ返す
- リモコンはコマンド送信を「送信 → ACK 待ち → 完了 / 失敗」の非同期処理として扱い、**ACK 待ちの間は操作 UI をブロック**する(連打による二重送信の防止)
- 応答が短時間で返る通常ケースでは画面をちらつかせないため、**待ち時間が一定を超えた場合にだけ「送信中」オーバーレイ**を表示する
- ACK がタイムアウトした場合・publish 自体が失敗した場合は、**利用者が明示的に閉じるまで消えない失敗警告**を表示し、再送と中止を選べるようにする(作業に戻っても失敗に気づけるようにするため)
- 成功時は控えめな完了フィードバックを表示する

破壊的変更なし。ACK を返さない旧サイネージと組み合わせた場合はタイムアウト警告が出るが、リモコン・サイネージは同一デプロイから配信されるため実運用上の問題にはならない。

## Capabilities

### New Capabilities

なし(既存 capability の要件追加で表現できる)。

### Modified Capabilities

- `realtime-pairing`: リアルタイムメッセージ同期に、サイネージ → リモコンのコマンド確認応答(ACK)メッセージを追加する
- `remote-control`: リモコンのコマンド送信に、送信中ロック・送信中表示・成功 / 失敗フィードバックの要件を追加する

## Impact

- `src/realtime/messages.ts`: ACK メッセージ名と型の追加
- `src/pages/signage/useSignageController.ts`: コマンド処理時の ACK 送信
- `src/pages/remote/RemotePage.tsx`: `sendCommand` の非同期化、送信状態の管理、送信中 / 失敗のオーバーレイ
- `src/pages/remote/ControlTab.tsx` / `StructureTab.tsx` / `HistoryTab.tsx`: 送信中は操作を受け付けない
- `src/pages/remote/RemotePage.module.css`: 送信中 / 失敗表示のスタイル
- `src/pages/home/updates.ts`: アップデート情報への追記

外部依存の追加なし。Cloudflare Worker 側の変更は不要(ACK は既存チャンネル上のメッセージであり、トークンの capability は変わらない)。
