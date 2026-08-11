## 1. メッセージ定義

- [x] 1.1 `src/realtime/messages.ts` に ACK のメッセージ名 `MESSAGE_NAME.ack` を追加する
- [x] 1.2 同ファイルに ACK のペイロード型 `CommandAck`(`requestId` / `status: 'accepted' | 'rejected'`)を追加する

## 2. サイネージ側の ACK 送信

- [x] 2.1 `useSignageController.applyCommand` に ACK 送信のヘルパーを追加する(未接続時は無視する既存の try/catch と同じ扱い)
- [x] 2.2 優勝確定後の早期リターンで `rejected` の ACK を返す
- [x] 2.3 処理済み `requestId` の早期リターンで `accepted` の ACK を返す
- [x] 2.4 通常のコマンド処理の完了時に `accepted` の ACK を返す(`STRUCTURE_UPDATE` の拒否時・`REQUEST_STATE` を含むすべての経路)

## 3. リモコン側の送信状態管理

- [x] 3.1 `RemotePage` に送信中の状態(`requestId`・コマンド内容・送信開始時刻・フェーズ)を保持する仕組みを追加する
- [x] 3.2 `sendCommand` を、`requestId` を採番して publish し ACK を待つ形に変更する(シグネチャ `(input) => void` は維持する)
- [x] 3.3 ACK メッセージを subscribe し、待機中の `requestId` と一致したら完了扱いにする(不一致・未知の `requestId` は無視する)
- [x] 3.4 300ms の送信中表示遅延と 5 秒のタイムアウトをタイマーで管理し、アンマウント時・完了時に確実に解除する
- [x] 3.5 publish の Promise が reject した場合を即時失敗として扱う
- [x] 3.6 `finished` のスナップショット受信時に送信中の状態を破棄する(失敗警告を出さない)
- [x] 3.7 内部送信の `REQUEST_STATE` はこの仕組みを通さず、従来どおり直接 publish する

## 4. リモコンの UI

- [x] 4.1 送信開始と同時に全画面のオーバーレイで入力をブロックし、300ms 経過後にのみ「送信中」の表示を出す
- [x] 4.2 ACK 受信時に約 1 秒で自動的に消える完了表示を出す
- [x] 4.3 タイムアウト・publish 失敗時に、閉じるまで消えない失敗警告(「再送」「閉じる」)を表示する
- [x] 4.4 `rejected` の ACK 受信時に、通信失敗と区別した「操作を受け付けられない」表示を出す
- [x] 4.5 再送は同じ `requestId` で行い、応答待ちの状態へ戻す
- [x] 4.6 失敗警告を切断モーダルより前面に表示する
- [x] 4.7 `RemotePage.module.css` に送信中・完了・失敗のスタイルを追加する(既存の切断モーダルのスタイルに合わせる)

## 5. 仕上げ

- [x] 5.1 `src/pages/home/updates.ts` の `ALL_UPDATES` 先頭にアップデート情報を追記し、10 件を超えた古い行を削除する
- [x] 5.2 Formatter / Lint / 型チェック / テスト / ビルドを実行する
- [x] 5.3 スマホ幅で動作を確認する(通常送信・応答遅延・タイムアウト・再送・連打防止)
- [x] 5.4 `/opsx:sync` で `openspec/specs/` を更新し、チェンジをアーカイブする
