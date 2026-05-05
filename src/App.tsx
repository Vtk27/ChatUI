import { Navigate, Route, Routes } from "react-router-dom"
import JoinPage from "./pages/JoinPage"
import ChatPage from "./pages/ChatPage"

function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Routes>
        <Route path="/" element={<JoinPage />} />
        <Route path="/chat/:chatId" element={<ChatPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
