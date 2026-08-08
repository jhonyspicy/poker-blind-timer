# remote-structure-edit: タスク

## 1. ドメイン・型

- [x] 1.1 `validateConfig`(src/domain/config.ts)からストラクチャー検証を `validateStructure(structure): string[]` として抽出し、`validateConfig` はそれを呼ぶ形にする(既存テストが通ることを確認)
- [x] 1.2 `SessionState`(src/domain/types.ts)に `structureOverride?: StructureItem[]` を追加する(セッション限定の上書き。旧データは上書きなし扱い)
- [x] 1.3 上書き適用の純関数 `applyStructureUpdate(session, config, incoming, now)` を domain に追加する: finished / 優勝確定の拒否、waiting 以外でのプレフィックス一致検証(適用時点の `resolveTimer` の解決結果が境界)、`validateStructure` による検証、成功時は `structureOverride` を差し替えた次セッションを返す
- [x] 1.4 1.3 のユニットテストを書く(未来のみの変更は採用 / 現在項目に触れる変更は拒否 / 自動遷移との競合で拒否 / waiting 中は全編集可 / 検証ルール違反の拒否 / configs 非改変)

## 2. 同期メッセージ

- [x] 2.1 `RemoteCommand`(src/realtime/messages.ts)に `STRUCTURE_UPDATE { requestId, structure }` を追加する
- [x] 2.2 `StateSnapshot` に `structure: StructureItem[]`(実効ストラクチャー)と `currentIndex: number | null` を追加し、`buildSnapshot`(src/realtime/snapshot.ts)で設定する

## 3. サイネージ側の適用

- [x] 3.1 useSignageController(src/pages/signage/useSignageController.ts)で実効 config(`structureOverride` を差し替えた `TournamentConfig`)を 1 箇所で導出し、タイマー進行(tick)・コマンド適用・スナップショット生成・画面描画のすべてでそれを使うようにする
- [x] 3.2 `applyCommand` に `STRUCTURE_UPDATE` の処理を追加する: `applyStructureUpdate` で検証・適用し、成功時は commitSession(既存の仕組みで IndexedDB 保存とスナップショット配信が走る)、拒否時はセッションを変えずに現在のスナップショットを配信し直す
- [x] 3.3 リロード時の復元で `structureOverride` が実効ストラクチャーとして使われることを確認する(復元テストがあれば追加)

## 4. リモコンの編集画面

- [x] 4.1 RemotePage(src/pages/remote/RemotePage.tsx)にストラクチャー編集画面(または編集モード)を追加する: スナップショットの `structure` / `currentIndex` から一覧を表示し、現在位置までをロック・現在項目を明示する
- [x] 4.2 未来項目のドラフト編集を実装する: ブラインドの SB / BB / Ante / 継続時間、ブレイクの継続時間の変更、項目の追加(ブラインド / ブレイク / レイトレジ締切=未設置時のみ)と削除。waiting 中は全項目編集可
- [x] 4.3 「適用」操作を実装する: `validateStructure` による送信前検証(エラーはその場に表示)、確認ダイアログ(未到達レイトレジ締切の削除時は確定条件が変わる旨を警告)、`STRUCTURE_UPDATE` の publish
- [x] 4.4 適用結果の判定を実装する: 送信後に受信したスナップショットのストラクチャーが送信内容と一致すれば編集画面を閉じ、不一致なら競合した旨を表示して最新の `structure` / `currentIndex` でドラフトを更新する
- [x] 4.5 スマホ幅での操作性(誤タップしにくいボタン・片手操作)を既存のリモコン UI に合わせて調整する

## 5. 仕上げ

- [x] 5.1 `src/pages/home/updates.ts` の先頭にアップデート情報を追記する(10 件超の古い行は削除)
- [x] 5.2 Formatter / Lint / 型チェック / テスト / ビルドを実行し、結果を報告する
- [x] 5.3 動作確認: 進行中に未来レベルを変更 → サイネージの NEXT BREAK 等へ反映、進行中項目の編集がロックされること、適用競合時の再同期、サイネージのリロード後の復元、同じ設定での新規開始が元ストラクチャーであること
