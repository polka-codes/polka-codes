// Generated by polka.codes
// WebSocketManager handles WebSocket connections and message processing for the runner

import WebSocket from 'ws'

import { type WsIncomingMessage, type WsOutgoingMessage, wsIncomingMessageSchema } from './types'

export interface WebSocketManagerOptions {
  taskId: string
  sessionToken: string
  githubToken?: string
  apiUrl: string
  onMessage: (message: WsIncomingMessage) => Promise<void>
  onOpen?: () => void
}

export class WebSocketManager {
  private ws: WebSocket | null = null
  private isClosingExpected = false
  private reconnectAttempts = 0
  private initialConnectionEstablished = false
  private readonly MAX_RECONNECT_ATTEMPTS = 5
  private readonly INITIAL_RECONNECT_DELAY_MS = 1000 // 1 second

  #queuedMessages: WsOutgoingMessage[] = []

  constructor(private options: WebSocketManagerOptions) {}

  /**
   * Connects to the WebSocket server and sets up event handlers
   */
  public connect(): void {
    console.log(`Attempting to connect to WebSocket: ${this.options.apiUrl}/${this.options.taskId} (Attempt ${this.reconnectAttempts + 1})`)

    this.isClosingExpected = false // Reset flag on new connection attempt
    this.ws = new WebSocket(`${this.options.apiUrl}/${this.options.taskId}`, {
      headers: {
        'x-session-token': this.options.sessionToken,
        'x-github-token': this.options.githubToken,
      },
    })

    this.setupEventHandlers()
  }

  /**
   * Sends a message to the WebSocket server
   */
  public sendMessage(message: WsOutgoingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.#queuedMessages.push(message)
      return
    }

    try {
      const messageString = JSON.stringify(message)
      this.ws.send(messageString)
    } catch (error) {
      console.error('Failed to send message:', error)
      try {
        // Attempt to send an error message back if possible
        const errorMsg: WsOutgoingMessage = {
          type: 'error',
          message: 'Failed to send message',
          details: String(error),
        }

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(errorMsg))
        }
      } catch (sendError) {
        console.error('Failed to send generic error message:', sendError)
      }
    }
  }

  /**
   * Closes the WebSocket connection
   */
  public close(expected = true): void {
    this.isClosingExpected = expected
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return

    this.ws.on('open', this.handleOpen.bind(this))
    this.ws.on('message', this.handleMessage.bind(this))
    this.ws.on('error', this.handleError.bind(this))
    this.ws.on('close', this.handleClose.bind(this))
  }

  private handleOpen(): void {
    console.log('WebSocket connection established successfully.')
    this.initialConnectionEstablished = true
    this.reconnectAttempts = 0 // Reset attempts on successful connection

    if (this.options.onOpen) {
      this.options.onOpen()
    }

    // Process queued messages
    for (const message of this.#queuedMessages) {
      this.sendMessage(message)
    }
    this.#queuedMessages = []
  }

  private async handleMessage(data: WebSocket.Data): Promise<void> {
    try {
      const rawMessage = JSON.parse(data.toString())
      const message = wsIncomingMessageSchema.parse(rawMessage)

      // Delegate message handling to the provided callback
      await this.options.onMessage(message)
    } catch (error) {
      console.error('Error processing message:', error)
      // Send an error message back to the server
      this.sendMessage({
        type: 'error',
        message: 'Failed to process message',
        details: String(error),
      })
    }
  }

  private handleError(error: Error): void {
    console.error('WebSocket error occurred:', error)
  }

  private handleClose(code: number, reason: Buffer): void {
    console.log(`WebSocket connection closed. Code: ${code}, Reason: ${reason.toString() || 'No reason provided'}`)

    this.ws = null // Clear the reference

    if (this.isClosingExpected) {
      console.log('Connection closed as expected.')
      return // Don't reconnect if closure was intended
    }

    if (!this.initialConnectionEstablished) {
      console.error('Initial WebSocket connection failed or closed unexpectedly before completing handshake.')
      process.exit(1) // Exit if the first connection never fully established and closed
    }

    // Handle unexpected closure - Attempt to reconnect
    if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
      this.reconnectAttempts++
      // Exponential backoff with jitter
      const jitter = Math.random() * this.INITIAL_RECONNECT_DELAY_MS * 0.5 // Add up to 50% jitter
      const delay = this.INITIAL_RECONNECT_DELAY_MS * 2 ** (this.reconnectAttempts - 1) + jitter

      console.log(
        `Unexpected disconnection. Attempting to reconnect in ${(delay / 1000).toFixed(
          2,
        )} seconds... (Attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})`,
      )

      setTimeout(() => this.connect(), delay)
    } else {
      console.error(`Maximum reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached. Exiting.`)
      process.exit(1)
    }
  }
}
