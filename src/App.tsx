import { Link, Route, Routes } from 'react-router'
import EditorPage from './pages/editor/EditorPage'
import RemotePage from './pages/remote/RemotePage'
import SignagePage from './pages/signage/SignagePage'

function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Blind Timer</h1>
      <ul>
        <li>
          <Link to="/editor">エディタ</Link>
        </li>
        <li>
          <Link to="/signage">サイネージ</Link>
        </li>
        <li>
          <Link to="/remote">リモコン</Link>
        </li>
      </ul>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/signage" element={<SignagePage />} />
      <Route path="/remote" element={<RemotePage />} />
    </Routes>
  )
}
