/**
 * 数字を等幅で描画する。Google Fonts 版の Oswald / Archivo は等幅数字(tnum)を
 * 持たず、秒の更新のたびに桁幅が変わって表示が揺れるため、数字だけを
 * 「0」1 文字分(1ch)の固定幅セルに入れて中央寄せする
 */
export default function TabularNumber({ text }: { text: string }) {
  return (
    <>
      {[...text].map((ch, index) =>
        /[0-9]/.test(ch) ? (
          <span key={index} style={{ display: 'inline-block', width: '1ch', textAlign: 'center' }}>
            {ch}
          </span>
        ) : (
          <span key={index}>{ch}</span>
        ),
      )}
    </>
  )
}
