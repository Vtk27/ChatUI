import { wsUrl } from "../config"

export const startWebSocket = (chatId: string, userId: string) =>
    new Promise<void>((resolve, reject) => {
      const socketUrl = wsUrl(`/ws?userId=${encodeURIComponent(
        userId,
      )}&chatId=${encodeURIComponent(chatId)}`)
      const socket = new WebSocket(socketUrl)
      const timeoutId = window.setTimeout(() => {
        socket.close()
        reject(new Error("WebSocket connection timed out"))
      }, 5000)

      socket.onopen = () => {
        window.clearTimeout(timeoutId)
        window.__chatSocket = socket
        window.__chatUserId = userId
        window.localStorage.setItem("chatUserId", userId)
        resolve()
      }

      socket.onerror = () => {
        window.clearTimeout(timeoutId)
        socket.close()
        reject(new Error("WebSocket connection failed"))
      }
})
