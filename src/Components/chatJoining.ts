import { startWebSocket } from "./startWebSocket"
import { apiUrl } from "../config"

export const chatJoining = async (chatIdInput: string, userIdInput: string) => {
    const chatId = chatIdInput.trim()
    const userId = userIdInput.trim()
    
    
    const joinUrl = apiUrl(`/chat/join?chatId=${encodeURIComponent(
    chatId,
    )}&userId=${encodeURIComponent(userId)}`)
    const response = await fetch(joinUrl)
    if (!response.ok) {
    const data = await response.json()
    const message =
        typeof data?.message === "string" ? data.message.trim() : ""
    throw new Error(`Join chat failed: ${message || "Please check the chat ID and try again."}`)
    }

    await startWebSocket(chatId, userId)

     
  }
