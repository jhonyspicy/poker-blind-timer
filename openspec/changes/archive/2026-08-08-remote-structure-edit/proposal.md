# remote-structure-edit

## Why

トーナメント進行中に「今日は参加人数が少ないので後半のレベルを短くしたい」「ブレイクを 1 つ減らしたい」といった当日限りのストラクチャー調整が発生するが、現在はサイネージを止めてエディタで設定を変更し直す手段しかない。運営者が手元のリモコンから、進行を止めずにその場で調整できるようにする。

## What Changes

- リモコンに、実行中トーナメントのストラクチャーを閲覧・編集する画面を追加する
- 編集できるのは**現在進行中の項目より後ろ(未来)の項目のみ**とする。進行中・過去のレベル、および通過済みのブレイク・レイトレジ締切マーカーは変更できない(タイマーの `levelIndex` や残り時間との整合を崩さないため)
- 編集結果は**セッション限定の上書き**(`structureOverride`)としてサイネージが保持・適用する。保存済みのトーナメント設定(configs)は変更しない
- サイネージは上書き後のストラクチャーをセッション状態として IndexedDB に永続化し、リロード後も復元する
- 状態スナップショットに現在のストラクチャー(上書き適用後)と現在位置を含め、リモコンが編集画面を構成できるようにする
- 同期メッセージに `STRUCTURE_UPDATE` コマンドを追加する。適用可否(未来の項目のみか等)の判定はサイネージ側で行う

## Capabilities

### New Capabilities

なし(既存 capability の要件変更のみ)

### Modified Capabilities

- `remote-control`: ストラクチャー編集画面と `STRUCTURE_UPDATE` コマンドの追加、状態スナップショットへのストラクチャー情報の追加
- `signage-display`: セッション限定のストラクチャー上書きの適用・検証(未来の項目のみ許可)と、セッション状態としての永続化・復元

## Impact

- `src/realtime/messages.ts`: `RemoteCommand` に `STRUCTURE_UPDATE` を追加、`StateSnapshot` にストラクチャーと現在位置を追加
- `src/realtime/snapshot.ts`: スナップショット生成にストラクチャー情報を含める
- `src/domain/types.ts`: `SessionState` に `structureOverride` を追加
- `src/storage/db.ts`: セッションの保存内容が増える(スキーマバージョン更新は不要の見込み。旧データは `structureOverride` なしとして扱う)
- `src/pages/signage/useSignageController.ts`: `STRUCTURE_UPDATE` の受信・検証・適用、上書き後ストラクチャーでのタイマー進行
- `src/pages/remote/RemotePage.tsx`: ストラクチャー編集 UI の追加
- `src/pages/home/updates.ts`: アップデート情報への追記
- 保存済み設定(configs ストア)・エディタ・Cloudflare Worker には変更なし
