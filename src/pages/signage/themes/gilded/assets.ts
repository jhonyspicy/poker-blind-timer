/**
 * GILDED テーマの先読み対象(テーマディレクトリ起点の相対パス)。
 * 先読みはこの宣言だけを見るため、実際に配置している素材のみを列挙する。
 * 動画素材は持たない(演出は CSS 実装)。
 *
 * - tournament-start.ogg: 開始演出の表示開始と同時に鳴らすテーマ独自アナウンス
 * - level-up-warning-announce.ogg: レベル終了 1 分前の予告アナウンス(テーマ独自タイミング)。
 *   共有層の 10 秒前予告音(sounds/level-up-warning.ogg)とファイル名を分け、素材を
 *   置かないことで 10 秒前側を無効化している
 * - level-up.ogg / break-start.ogg / pause.ogg / resume.ogg / entry.ogg / bust.ogg /
 *   champion.ogg: 共有層の効果音イベントが再生する(champion はバスト音の代わりに優勝確定時)
 * - images/champion.png: 優勝画面の背景
 */
export const GILDED_THEME_ASSETS: readonly string[] = [
  'sounds/tournament-start.ogg',
  'sounds/level-up-warning-announce.ogg',
  'sounds/level-up.ogg',
  'sounds/break-start.ogg',
  'sounds/pause.ogg',
  'sounds/resume.ogg',
  'sounds/entry.ogg',
  'sounds/bust.ogg',
  'sounds/champion.ogg',
  'images/champion.png',
]
