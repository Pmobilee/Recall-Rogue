/** WebSocket message types */
export type WSMessageType =
  | 'lobby:join' | 'lobby:leave' | 'lobby:ready' | 'lobby:start'
  | 'dive:move' | 'dive:mine' | 'dive:quiz_answer' | 'dive:use_item'
  | 'dive:sync' | 'dive:end' | 'dive:ended' | 'dive:loot_summary'
  | 'chat:message'
  | 'player:connected'
  | 'miner:moved'
  | 'block:mined'
  | 'scholar:buff' | 'scholar:buff_applied' | 'scholar:buff_failed'
  | 'scholar:disconnected' | 'scholar:reconnected'
  | 'scholar:quiz_prompt'
  | 'ai_scholar:activated' | 'ai_scholar:action'
  | 'ping' | 'pong'
  | 'error'

export interface WSMessage {
  type: WSMessageType
  payload: Record<string, unknown>
  timestamp: number
  senderId: string
}

/** Connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

class WSClient {
  private ws: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private listeners: Map<string, ((msg: WSMessage) => void)[]> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  /** Connect to co-op server */
  connect(url: string, playerId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.state = 'connecting'

    try {
      this.ws = new WebSocket(`${url}?playerId=${encodeURIComponent(playerId)}`)

      this.ws.onopen = () => {
        this.state = 'connected'
        this.reconnectAttempts = 0
        this.emit('connection', { type: 'lobby:join' as WSMessageType, payload: { connected: true }, timestamp: Date.now(), senderId: playerId })
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage
          this.emit(msg.type, msg)
        } catch { /* ignore malformed */ }
      }

      this.ws.onclose = () => {
        this.state = 'disconnected'
        this.attemptReconnect(url, playerId)
      }

      this.ws.onerror = () => {
        this.state = 'error'
      }
    } catch {
      this.state = 'error'
    }
  }

  /** Send a message */
  send(type: WSMessageType, payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const msg: WSMessage = { type, payload, timestamp: Date.now(), senderId: '' }
    this.ws.send(JSON.stringify(msg))
  }

  /** Subscribe to message type */
  on(type: string, callback: (msg: WSMessage) => void): () => void {
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type)!.push(callback)
    return () => {
      const list = this.listeners.get(type)
      if (list) {
        const idx = list.indexOf(callback)
        if (idx >= 0) list.splice(idx, 1)
      }
    }
  }

  /** Emit to listeners */
  private emit(type: string, msg: WSMessage): void {
    const list = this.listeners.get(type)
    if (list) list.forEach(cb => cb(msg))
  }

  /** Reconnect with exponential backoff */
  private attemptReconnect(url: string, playerId: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return
    this.reconnectAttempts++
    setTimeout(() => {
      this.connect(url, playerId)
    }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1))
  }

  /** Disconnect */
  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.state = 'disconnected'
    this.listeners.clear()
  }

  /** Get connection state */
  getState(): ConnectionState {
    return this.state
  }

  /** Check if connected */
  isConnected(): boolean {
    return this.state === 'connected'
  }
}

export const wsClient = new WSClient()
