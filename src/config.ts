const defaultApiBaseUrl = "http://localhost:8081"

const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

export const API_BASE_URL = envApiBaseUrl && envApiBaseUrl.length > 0
  ? envApiBaseUrl
  : defaultApiBaseUrl

const withSlash = (path: string) => (path.startsWith("/") ? path : `/${path}`)

export const apiUrl = (path: string) => `${API_BASE_URL}${withSlash(path)}`

export const WS_BASE_URL = API_BASE_URL.startsWith("https://")
  ? `wss://${API_BASE_URL.slice("https://".length)}`
  : API_BASE_URL.startsWith("http://")
    ? `ws://${API_BASE_URL.slice("http://".length)}`
    : API_BASE_URL

export const wsUrl = (path: string) => `${WS_BASE_URL}${withSlash(path)}`
