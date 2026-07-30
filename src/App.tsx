import { Route, Routes } from 'react-router'
import EditorPage from './pages/editor/EditorPage'
import HomePage from './pages/home/HomePage'
import RemotePage from './pages/remote/RemotePage'
import SignagePage from './pages/signage/SignagePage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/signage" element={<SignagePage />} />
      <Route path="/remote" element={<RemotePage />} />
    </Routes>
  )
}
