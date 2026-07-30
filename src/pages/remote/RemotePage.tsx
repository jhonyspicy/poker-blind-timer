import { Link } from 'react-router'

/** リモコン画面。トップページから順に作り直しているため、現在は雛形のみ */
export default function RemotePage() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>リモコン</h1>
      <p>未実装です。</p>
      <p>
        <Link to="/">← トップへ戻る</Link>
      </p>
    </main>
  )
}
