import { nanoid } from "nanoid"
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEventHandler } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { errorMessages } from "../Components/errorMessages"
import { FiCheck, FiClipboard, FiRefreshCw } from "react-icons/fi"
import { chatJoining } from "../Components/chatJoining"
import { FaSignOutAlt } from "react-icons/fa"
import { apiUrl } from "../config"

type Message = {
  messageId: string
  chatId: string
  sender: string
  text: string
  createdAt: number
}

const fallbackUserId = "you"

declare global {
  interface Window {
    __chatSocket?: WebSocket
    __chatUserId?: string
  }
}

// const seedMessages = (
//   chatId: string,
//   currentUserId: string,
//   otherUserId: string,
// ): Message[] => [
//   {
//     messageId: nanoid(),
//     chatId,
//     sender: otherUserId,
//     text: "Hey! Just joined the room.",
//     createdAt: Date.now() - 1000 * 60 * 12,
//   },
//   {
//     messageId: nanoid(),
//     chatId,
//     sender: currentUserId,
//     text: "Nice - I can see your messages on the left.",
//     createdAt: Date.now() - 1000 * 60 * 8,
//   },
//   {
//     messageId: nanoid(),
//     chatId,
//     sender: otherUserId,
//     text: "Perfect. Send something else to test alignment.",
//     createdAt: Date.now() - 1000 * 60 * 5,
//   },
// ]

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ""
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function ChatPage() {
  const navigate = useNavigate()
  const params = useParams()
  const chatId = params.chatId ?? "unknown"
  const currentUserId =
    window.__chatUserId?.trim() ||
    window.localStorage.getItem("chatUserId")?.trim() ||
    fallbackUserId
  const [otherUserId, setOtherUserId] = useState("other")
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState("")
  const [isConnecting, setIsConnecting] = useState(true)
  const [isConnected, setIsConnected] = useState(false)
  const [joinNotice, setJoinNotice] = useState("")
  const [loadError, setLoadError] = useState("")
  const dismissLoadError = () => setLoadError("")
  const endRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const messageIdSetRef = useRef<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement | null>(null)
  const loadingMoreRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const hasMoreRef = useRef(true)
  const isHistoryMutationRef = useRef(false)
  const isInitialLoadDoneRef = useRef(false)
  const previousScrollTopRef = useRef<number | null>(null)
  const orderedMessages = useMemo(() => messages, [messages])

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try{
      await navigator.clipboard.writeText(chatId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }catch(e){
      console.error("Copy failed: ",e)
    }
  }

  const fetchMore = useCallback(async () =>{
    if(loadingMoreRef.current || !hasMoreRef.current) return

    loadingMoreRef.current = true
    setLoading(true);
    try{
      isHistoryMutationRef.current = true
      const oldestMessageId = orderedMessages[0]?.messageId
      console.log("Fetching more messages before ID:", oldestMessageId)
      if(!oldestMessageId) return 
      const fetchUrl = apiUrl(`/messages?chatId=${encodeURIComponent(chatId)}&lastMessageId=${encodeURIComponent(oldestMessageId)}&limit=5`)
      const response = await fetch(fetchUrl)
      if (!response.ok) {
        const data = await response.json()
        const message =
            typeof data?.message === "string" ? data.message.trim() : ""
        throw new Error(`Join chat failed: ${message || "Please check the chat ID and try again."}`)
      }
      const data = (await response.json()) as Array<{
          messageId: string
          chatId: string
          senderId: string
          content: string
          createdAt: number
        }>
      const mapped: Message[] = data.map((item) => ({
        messageId: item.messageId,
        chatId: item.chatId,
        sender: item.senderId,
        text: item.content,
        createdAt: item.createdAt,
      }))
      const uniqueMessage = mapped.filter( (m) => !messageIdSetRef.current.has(m.messageId) )
      setMessages((prev) => [...uniqueMessage, ...prev ])
      uniqueMessage.forEach((m) => messageIdSetRef.current.add(m.messageId))
      if (mapped.length === 0 || uniqueMessage.length === 0) {
        hasMoreRef.current = false
      }
     } catch (error) {
      console.error("Failed to fetch more messages:", error)
      setLoadError("Failed to fetch more messages.")
    } finally {
      loadingMoreRef.current = false
      requestAnimationFrame(() => {
        isHistoryMutationRef.current = false
      })
      setLoading(false)
    }
  }, [orderedMessages, chatId])

  useEffect(() =>{
    const el = containerRef.current;
    if(!el) return
    previousScrollTopRef.current = el.scrollTop

    const handleScroll = () =>{
      const currentScrollTop = el.scrollTop
      const previousScrollTop = previousScrollTopRef.current
      const isScrollingUp = previousScrollTop !== null && currentScrollTop < previousScrollTop
      previousScrollTopRef.current = currentScrollTop

      if (!isInitialLoadDoneRef.current) return
      if (!isScrollingUp) return
      if(currentScrollTop <= 20 ){
        if(orderedMessages.length > 0 && !loadingMoreRef.current) {
          fetchMore()
        }
      }
    }

    el.addEventListener("scroll", handleScroll)
    return () => {
      el.removeEventListener("scroll", handleScroll)
    }
  }, [fetchMore, orderedMessages.length])

  useEffect(() => {
    if (isHistoryMutationRef.current) return
    if(loadingMoreRef.current === true) return
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [orderedMessages.length])

  const socketMessage = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data as string)
          console.log("Socket payload:", payload)
          if (!payload) return
          if (payload.type === "sendChatAck") {
            const tempId = String(payload.tempId || "").trim()
            const messageId = String(payload.messageId || "").trim()
            if (tempId && messageId) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.messageId === tempId ? { ...msg, messageId } : msg,
                ),
              )
              messageIdSetRef.current.add(messageId)
              console.log("Message ACK received:", { tempId, messageId })
            }
            return
          }
          if (payload.type === "userJoined") {
            const joinedUserId = String(payload.userId || "").trim()
            if (!joinedUserId) return
            console.log("userJoined received:", joinedUserId)
            setJoinNotice(`${joinedUserId} joined the chat`)
            return
          }
          if (typeof payload.message !== "string") return
          const incomingSender = payload.fromUserId || payload.sender || otherUserId
          if (payload.fromUserId || payload.sender) {
            setOtherUserId(incomingSender)
          }
          const incomingMessageId =
            String(payload.messageId || payload.id || "").trim() || nanoid()
          if (messageIdSetRef.current.has(incomingMessageId)) {
            return
          }
          messageIdSetRef.current.add(incomingMessageId)
          const incoming: Message = {
            messageId: incomingMessageId,
            chatId,
            sender: incomingSender,
            text: payload.message,
            createdAt: Date.now(),
          }
          setMessages((prev) => [...prev, incoming])
        } catch (error) {
          console.warn("Failed to parse incoming message:", error)
        }
      }

  const loadInitialMessages = async () => {
    const controller = new AbortController()
    isInitialLoadDoneRef.current = false
    hasMoreRef.current = true
    isHistoryMutationRef.current = false
    const loadMessages = async () => {
      try {
        const response = await fetch(
          apiUrl(`/messages?chatId=${encodeURIComponent(
            chatId,
          )}&limit=5`),
          { signal: controller.signal },
        )
        if (!response.ok) {
          throw new Error(`Failed to load messages: ${response.status}`)
        }
        const data = (await response.json()) as Array<{
          messageId: string
          chatId: string
          senderId: string
          content: string
          createdAt: number
        }>
        const mapped: Message[] = data.map((item) => ({
          messageId: item.messageId,
          chatId: item.chatId,
          sender: item.senderId,
          text: item.content,
          createdAt: item.createdAt,
        }))
        console.log("Initial messages loaded:", mapped)
        messageIdSetRef.current = new Set(mapped.map((m) => m.messageId))
        setMessages(mapped)
        setLoadError("")
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            endRef.current?.scrollIntoView({ behavior: "smooth" })
            isInitialLoadDoneRef.current = true
            resolve()
          })
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        console.error("Failed to load messages:", error)
        setLoadError(errorMessages.loadMessagesFailed)
        isInitialLoadDoneRef.current = true
      }
    }
    await loadMessages()
    return () => controller.abort()
  }

  useEffect(() => {
    let isCancelled = false

    const attachSocket = (socket: WebSocket) => {
      socketRef.current = socket
      setIsConnecting(socket.readyState === WebSocket.CONNECTING)
      setIsConnected(socket.readyState === WebSocket.OPEN)
      socket.onopen = () => {
        setIsConnecting(false)
        setIsConnected(true)
      }
      socket.onclose = () => {
        setIsConnected(false)
        setIsConnecting(false)
      }
      socket.onerror = () => {
        setIsConnected(false)
        setIsConnecting(false)
      }
      socket.onmessage = socketMessage
    }

    const initSocket = async () => {
      try {
        const existing = window.__chatSocket
        const isExistingUsable =
          !!existing &&
          (existing.readyState === WebSocket.OPEN ||
            existing.readyState === WebSocket.CONNECTING)

        if (isExistingUsable) {
          await loadInitialMessages()
          if (isCancelled) return
          attachSocket(existing)
          return
        }

        await chatJoining(chatId, currentUserId)
        await loadInitialMessages()
        if (isCancelled) return

        const joinedSocket = window.__chatSocket
        if (!joinedSocket) {
          throw new Error("WebSocket not initialized after joining chat")
        }
        attachSocket(joinedSocket)
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to join chat:", error)
          setIsConnecting(false)
          setIsConnected(false)
          setLoadError(errorMessages.joinChatFailed)
          navigate("/")
        }
      }
    }

    initSocket()

    return () => {
      isCancelled = true
    }
  }, [chatId])

  const handleSend = () => {
    const trimmed = draft.trim()
    if (!trimmed) return

    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket is not connected")
      return
    }

    const tempId = nanoid()
    socketRef.current.send(
      JSON.stringify({
        type: "sendChat",
        chatId,
        message: trimmed,
        tempId,
      }),
    )

    const nextMessage: Message = {
      messageId: tempId,
      chatId,
      sender: currentUserId,
      text: trimmed,
      createdAt: Date.now(),
    }

    setMessages((prev) => [...prev, nextMessage])
    setDraft("")
  }

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter") {
      event.preventDefault()
      handleSend()
    }
  }

  const exitChat = () => {
    socketRef.current?.addEventListener("close", () => {navigate("/")}, { once: true })
    socketRef.current?.close(1000, "User left the chat")
    window.__chatSocket = undefined
  }
  
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-slate-200 bg-white/80 px-3 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              Chat Room
            </p>
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">#{chatId} {copied? (<FiCheck className="text-green-500" />) : (<FiClipboard onClick={handleCopy} className="cursor-pointer" title="Copy to clipboard" />)}</h2>
          </div>
          <div className="text-xs text-slate-400">
            {isConnecting ? "Reconnecting..." : isConnected ? "Online" : "Offline"}
          </div>
           <button
            type="button"
            onClick={exitChat}
            className="rounded-2xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Exit Chat <FaSignOutAlt className="inline ml-1" />
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col px-3 pb-4 pt-4">
          <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm">
            <div className="flex min-h-0 flex-1 flex-col">
              {joinNotice ? (
                <div className="mb-4 flex justify-center">
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400 shadow-sm">
                    {joinNotice}
                  </div>
                </div>
              ) : null}
              {loading && (
                  <div className="flex justify-center p-2">
                      <FiRefreshCw className="animate-spin" />
                    </div>
                  )}
              {loadError ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
                  <div className="relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl ring-1 ring-black/5">
                    <div className="absolute right-4 top-4">
                      <button
                        type="button"
                        onClick={dismissLoadError}
                        aria-label="Close error"
                        className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        <span className="text-base leading-none">Ã—</span>
                      </button>
                    </div>
                    <div className="flex flex-col items-center text-center">
                      <div className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-200">
                        <span className="text-2xl leading-none">Ã—</span>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-rose-500">Error</h3>
                      <p className="mt-2 text-sm text-slate-500">{loadError}</p>
                      <button
                        type="button"
                        onClick={dismissLoadError}
                        className="mt-5 rounded-full bg-rose-500 px-6 py-2 text-sm font-semibold text-white shadow-md shadow-rose-200 transition hover:bg-rose-400"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
              <div ref={containerRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
              {orderedMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    No messages yet
                  </div>
                  <p className="mt-4 max-w-sm text-sm text-slate-500">
                    Say hello to start the conversation. Your messages will appear
                    here.
                  </p>
                </div>
              ) : (
                orderedMessages.map((message) => {
                  const isMine = message.sender === currentUserId
                  return (
                    <div
                      key={message.messageId}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                          isMine
                            ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-slate-200"
                            : "border border-slate-200 bg-white text-slate-700 shadow-slate-100"
                        }`}
                      >
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {isMine ? currentUserId : message.sender}
                        </p>
                        <p className="leading-relaxed">{message.text}</p>
                        <div className="mt-2 flex justify-end text-[10px] font-medium tracking-[0.16em] text-slate-400/80">
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
                <div ref={endRef} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
          <input
            type="text"
            placeholder="Type a message..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
          />
          <button
            type="button"
            onClick={handleSend}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatPage
