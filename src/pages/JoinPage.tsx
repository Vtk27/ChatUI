import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { errorMessages } from "../Components/errorMessages"
import  ErrorScreen  from "../Components/ErrorScreen"
import { startWebSocket } from "../Components/startWebSocket"
import { chatJoining } from "../Components/chatJoining"
import { apiUrl } from "../config"

declare global {
  interface Window {
    __chatSocket?: WebSocket
    __chatUserId?: string
  }
}

function JoinPage() {
  const navigate = useNavigate()
  const [chatIdInput, setChatIdInput] = useState("")
  const [userIdInput, setUserIdInput] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [userIdError, setUserIdError] = useState("")
  const [chatIdError, setChatIdError] = useState("")
  const dismissError = () => setErrorMessage("")
  const [errorMessage, setErrorMessage] = useState("")

  const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

  const parseChatIdResponse = async (response: Response) => {
    const contentType = response.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const data = await response.json().catch(() => null)
      const chatId =
        typeof data?.chatId === "string" ? data.chatId.trim() : ""
      const message =
        typeof data?.message === "string" ? data.message.trim() : ""
      return { chatId, message }
    }
    const text = (await response.text().catch(() => "")).trim()
    return { chatId: text, message: text }
  }

  const fetchChatIdWithRetry = async (userId: string) => {
    const delays = [300, 800]
    let lastError: unknown

    for (let attempt = 0; attempt < delays.length + 1; attempt += 1) {
      try {
        const response = await fetch(apiUrl("/chat-id"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userId }),
        })

        if (!response.ok) {
          const { message } = await parseChatIdResponse(response)
          if (response.status >= 500 && attempt < delays.length) {
            await sleep(delays[attempt])
            continue
          }
          throw new Error(message || `Create chat failed: ${response.status}`)
        }

        const { chatId, message } = await parseChatIdResponse(response)
        if (!chatId) {
          throw new Error(message || "Create chat failed: missing chatId")
        }

        return chatId
      } catch (error) {
        lastError = error
        const isNetworkError = error instanceof TypeError
        if (isNetworkError && attempt < delays.length) {
          await sleep(delays[attempt])
          continue
        }
        break
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Create chat failed")
  }

  const handleCreateChat = async () => {
    if (isCreating) return
    const userId = userIdInput.trim()
    if (!userId) {
      setUserIdError("Please enter a user ID.")
      return
    }
    setUserIdError("")
    setIsCreating(true)
    setErrorMessage("")

    try {
      const chatId = await fetchChatIdWithRetry(userId)
      await startWebSocket(chatId, userId)

      navigate(`/chat/${chatId}`)
    } catch (error) {
      console.error("Failed to create chat:", error)
      setErrorMessage(errorMessages.chatIdGenerationFailed)
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinChat = async () => {
    if (isJoining) return
    const chatId = chatIdInput.trim()
    const userId = userIdInput.trim()
    let hasValidationError = false

    if (!userId) {
      setUserIdError("Please enter a user ID.")
      hasValidationError = true
    } else {
      setUserIdError("")
    }

    if (!chatId) {
      setChatIdError("Please enter a chat ID.")
      hasValidationError = true
    } else {
      setChatIdError("")
    }

    if (hasValidationError) {
      return
    }

    setIsJoining(true)
    setErrorMessage("")
    
    try {
      await chatJoining( chatId, userId)
      navigate(`/chat/${chatId}`)
    }catch (error) {
      console.error("Failed to join chat:", error)
      setErrorMessage(
        error instanceof Error ? error.message : errorMessages.joinChatFailed,
      )
    }
     finally {
      setIsJoining(false)
    }
  }

  
  return (
    <div className="min-h-screen">
      <header className="bg-slate-950">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-4">
          <h1 className="text-base font-semibold tracking-wide text-white">Chat System</h1>
        </div>
      </header>

      <main className="flex justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-4">
          <header className="space-y-1 text-center">
            <p className="text-sm text-slate-600">Share chat ID to connect</p>
            <p className="text-sm text-slate-500">Chat instantly, no signup required</p>
          </header>

          <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
            Chat System
          </p>
          <h2 className="text-3xl font-semibold text-slate-900">Join a chat</h2>
          <p className="text-sm text-slate-500">
            Create a new room or join with an existing chat ID.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="space-y-3">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Enter User ID
            </label>
            <input
              type="text"
              placeholder="e.g. you"
              value={userIdInput}
              onChange={(event) => {
                const nextValue = event.target.value
                setUserIdInput(nextValue)
                if (nextValue.trim()) {
                  setUserIdError("")
                }
              }}
              aria-invalid={Boolean(userIdError)}
              aria-describedby={userIdError ? "user-id-error" : undefined}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
            />
            {userIdError ? (
              <p id="user-id-error" className="text-sm text-red-500">
                {userIdError}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleCreateChat}
            disabled={isCreating || !userIdInput.trim()}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            {isCreating ? "Creating..." : "Create Chat"}
          </button>

          <div className="space-y-3">
            <label className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Enter Chat ID
            </label>
            <input
              type="text"
              placeholder="e.g. 8f3k2r1z"
              value={chatIdInput}
              onChange={(event) => {
                const nextValue = event.target.value
                setChatIdInput(nextValue)
                if (nextValue.trim()) {
                  setChatIdError("")
                }
              }}
              aria-invalid={Boolean(chatIdError)}
              aria-describedby={chatIdError ? "chat-id-error" : undefined}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
            />
            {chatIdError ? (
              <p id="chat-id-error" className="text-sm text-red-500">
                {chatIdError}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleJoinChat}
              disabled={isJoining}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              {isJoining ? "Joining..." : "Join Chat"}
            </button>
          </div>
          {errorMessage ? (<ErrorScreen errorMessage={errorMessage} dismissError={dismissError} />) : null}
        </div>
          </div>

          <footer className="text-center">
            <a
              href="https://github.com/Vtk27/ChatService"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-800"
            >
              View Source on GitHub
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.66-.22.66-.49 0-.24-.01-1.04-.01-1.88-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.58 2.36 1.12 2.94.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.08 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.9c.85 0 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.95-2.34 4.81-4.57 5.07.36.32.68.95.68 1.92 0 1.38-.01 2.5-.01 2.84 0 .27.17.59.67.49A10.24 10.24 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z" />
              </svg>
            </a>
          </footer>
        </div>
      </main>
    </div>
  )
}

export default JoinPage
