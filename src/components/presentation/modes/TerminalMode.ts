import { Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { ExecutionPhase, ParsedRequest } from '@/types'
import { resolveVariables } from '@/utils/variableResolver'

export interface TerminalModeOptions {
  width: number
  height: number
  primaryColor: number
  secondaryColor: number
  bgColor: number
  textColor: number
  errorColor: number
}

export interface TerminalSettings {
  autoAdvance: boolean
  autoAdvanceDelay: number
  typingSpeed: number
}

interface TerminalLine {
  text: string
  type: 'command' | 'output' | 'success' | 'error' | 'info' | 'prompt'
  color: number
}

export type TerminalEvent = 'execute-request' | 'open-response'

// Simple state machine
type TerminalState = 'waiting-execute' | 'executing' | 'waiting-response' | 'idle' | 'typing'

interface QueuedLine {
  text: string
  type: TerminalLine['type']
  callback?: () => void
}

export class TerminalMode extends Container {
  private options: TerminalModeOptions
  private settings: TerminalSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }
  private background: Graphics
  private crtOverlay: Graphics
  private scanlines: Graphics
  private terminalContainer: Container
  private lines: TerminalLine[] = []
  private textObjects: Text[] = []
  private cursorBlink: Graphics
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private cursorInterval: ReturnType<typeof setInterval> | null = null
  private cursorVisible: boolean = true
  
  // Typing state
  private typingQueue: QueuedLine[] = []
  private typingText: string = ''
  private typingIndex: number = 0
  private typingInterval: ReturnType<typeof setInterval> | null = null
  private currentTypingType: TerminalLine['type'] = 'output'
  private typingCallback: (() => void) | undefined = undefined
  
  // Simple state
  private state: TerminalState = 'idle'
  private stateAfterTyping: TerminalState = 'idle'
  
  // Event callback
  private onEvent: ((event: TerminalEvent) => void) | null = null
  
  private readonly LINE_HEIGHT = 20
  private readonly PADDING = 20
  private readonly MAX_LINES = 22

  constructor(options: TerminalModeOptions) {
    super()
    this.options = options

    this.background = new Graphics()
    this.addChild(this.background)

    this.terminalContainer = new Container()
    this.addChild(this.terminalContainer)

    this.crtOverlay = new Graphics()
    this.addChild(this.crtOverlay)

    this.scanlines = new Graphics()
    this.addChild(this.scanlines)

    this.cursorBlink = new Graphics()
    this.addChild(this.cursorBlink)

    this.draw()
    this.startCursorBlink()
    this.initTerminal()
  }

  private draw() {
    const { width, height, bgColor, primaryColor } = this.options

    this.background.clear()
    this.background.rect(0, 0, width, height)
    this.background.fill({ color: bgColor })

    this.scanlines.clear()
    for (let y = 0; y < height; y += 3) {
      this.scanlines.moveTo(0, y)
      this.scanlines.lineTo(width, y)
      this.scanlines.stroke({ color: 0x000000, alpha: 0.08, width: 1 })
    }

    this.crtOverlay.clear()
    this.crtOverlay.rect(0, 0, width, 50)
    this.crtOverlay.fill({ color: primaryColor, alpha: 0.02 })
    this.crtOverlay.rect(0, height - 50, width, 50)
    this.crtOverlay.fill({ color: 0x000000, alpha: 0.08 })

    this.updateCursor()
  }

  private updateCursor() {
    this.cursorBlink.clear()
    
    // Show cursor when typing or waiting for input
    if (this.cursorVisible) {
      if (this.state === 'typing' && this.typingText) {
        // Cursor at end of typing text
        const lastLineY = this.PADDING + (this.lines.length * this.LINE_HEIGHT)
        const cursorX = this.PADDING + (this.typingIndex * 9)
        this.cursorBlink.rect(cursorX, lastLineY, 8, 16)
        this.cursorBlink.fill({ color: this.options.primaryColor })
      } else if (this.state === 'waiting-execute' || this.state === 'waiting-response') {
        // Cursor at start of new line
        const lastLineY = this.PADDING + (this.lines.length * this.LINE_HEIGHT)
        this.cursorBlink.rect(this.PADDING, lastLineY, 8, 16)
        this.cursorBlink.fill({ color: this.options.primaryColor })
      }
    }
  }

  private startCursorBlink() {
    this.cursorInterval = setInterval(() => {
      this.cursorVisible = !this.cursorVisible
      this.updateCursor()
    }, 530)
  }

  private initTerminal() {
    this.addLineImmediate('HTTP Visualizer v1.0 - Terminal Mode', 'info')
    this.addLineImmediate('═'.repeat(45), 'info')
    this.addLineImmediate('', 'output')
    this.addLineImmediate('Ready for requests...', 'output')
  }

  private getTextStyle(type: TerminalLine['type']): TextStyle {
    const { primaryColor, secondaryColor, textColor, errorColor } = this.options
    
    let color: number
    switch (type) {
      case 'command':
        color = primaryColor
        break
      case 'success':
        color = 0x27ca40
        break
      case 'error':
        color = errorColor
        break
      case 'info':
        color = 0x888888
        break
      case 'prompt':
        color = secondaryColor
        break
      default:
        color = textColor
    }

    return new TextStyle({
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: 14,
      fill: color,
      letterSpacing: 1,
    })
  }

  // Add line immediately (no typing)
  private addLineImmediate(text: string, type: TerminalLine['type'] = 'output') {
    const style = this.getTextStyle(type)
    const line: TerminalLine = { text, type, color: style.fill as number }
    this.lines.push(line)

    if (this.lines.length > this.MAX_LINES) {
      this.lines = this.lines.slice(-this.MAX_LINES)
    }

    this.renderLines()
  }

  // Queue a line to be typed
  private typeLine(text: string, type: TerminalLine['type'] = 'output', callback?: () => void) {
    this.typingQueue.push({ text, type, callback })
    this.processTypingQueue()
  }

  // Process the typing queue
  private processTypingQueue() {
    if (this.state === 'typing' || this.typingQueue.length === 0) return
    
    const next = this.typingQueue.shift()!
    this.startTyping(next.text, next.type, next.callback)
  }

  // Start typing a line
  private startTyping(text: string, type: TerminalLine['type'], callback?: () => void) {
    this.state = 'typing'
    this.typingText = text
    this.typingIndex = 0
    this.currentTypingType = type
    this.typingCallback = callback

    if (this.typingInterval) {
      clearInterval(this.typingInterval)
      this.typingInterval = null
    }

    // Handle empty strings immediately
    if (text.length === 0) {
      this.finishTyping()
      return
    }

    const typingSpeed = this.settings.typingSpeed || 50

    this.typingInterval = setInterval(() => {
      if (this.typingIndex < this.typingText.length) {
        this.typingIndex++
        this.renderLines()
        this.updateCursor()
      } else {
        this.finishTyping()
      }
    }, 1000 / typingSpeed)
  }

  // Finish typing current line
  private finishTyping() {
    if (this.typingInterval) {
      clearInterval(this.typingInterval)
      this.typingInterval = null
    }

    // Save the completed text and type before clearing
    const completedText = this.typingText
    const completedType = this.currentTypingType
    const callback = this.typingCallback
    
    // Clear typing state BEFORE adding line (so renderLines doesn't show duplicate)
    this.typingText = ''
    this.typingIndex = 0
    this.typingCallback = undefined
    this.state = 'idle'

    // Add the completed line
    this.addLineImmediate(completedText, completedType)
    
    // Execute callback
    callback?.()
    
    // Check if more in queue
    if (this.typingQueue.length > 0) {
      this.processTypingQueue()
    } else {
      // Done typing, restore final state
      this.state = this.stateAfterTyping
      this.updateCursor()
    }
  }

  private renderLines() {
    this.textObjects.forEach(t => t.destroy())
    this.textObjects = []

    const startY = this.PADDING

    // Render completed lines
    this.lines.forEach((line, index) => {
      const style = this.getTextStyle(line.type)
      const text = new Text({ text: line.text, style })
      text.x = this.PADDING
      text.y = startY + (index * this.LINE_HEIGHT)
      this.terminalContainer.addChild(text)
      this.textObjects.push(text)
    })

    // Render typing line
    if (this.state === 'typing' && this.typingText) {
      const style = this.getTextStyle(this.currentTypingType)
      const visibleText = this.typingText.substring(0, this.typingIndex)
      const text = new Text({ text: visibleText, style })
      text.x = this.PADDING
      text.y = startY + (this.lines.length * this.LINE_HEIGHT)
      this.terminalContainer.addChild(text)
      this.textObjects.push(text)
    }
  }

  public setEventCallback(callback: (event: TerminalEvent) => void) {
    this.onEvent = callback
  }

  public updateSettings(newSettings: Partial<TerminalSettings>) {
    this.settings = { ...this.settings, ...newSettings }
  }

  // Handle Enter key press
  public handleInput(): boolean {
    // Block input while typing
    if (this.state === 'typing') {
      return false
    }
    
    if (this.state === 'waiting-execute') {
      // User pressed Enter to execute
      this.state = 'executing'
      this.stateAfterTyping = 'executing'
      this.typeLine('', 'output')
      this.typeLine('> Executing request...', 'command', () => {
        this.onEvent?.('execute-request')
      })
      return true
    }
    
    if (this.state === 'waiting-response') {
      // User pressed Enter to open response
      this.stateAfterTyping = 'waiting-execute'
      this.typeLine('> Opening response...', 'command', () => {
        this.onEvent?.('open-response')
        // After opening response, show execute prompt
        this.typeLine('', 'output')
        this.typeLine('═'.repeat(45), 'info')
        this.typeLine('[ Press ENTER to execute ]', 'prompt')
      })
      return true
    }
    
    return false
  }

  // Handle click - disabled, use keyboard only
  public handleInputClick(): boolean {
    return false
  }

  // Called when user selects a request
  public setRequest(request: ParsedRequest | null, variables: Record<string, string> = {}) {
    // Clear any pending typing
    this.clearTyping()
    
    this.currentRequest = request
    this.resolvedVariables = variables
    
    if (!request) {
      this.lines = []
      this.initTerminal()
      this.state = 'idle'
      this.stateAfterTyping = 'idle'
      return
    }

    // Resolve URL with variables
    const resolvedUrl = resolveVariables(request.url, variables)

    // Show request info with typing
    this.lines = []
    this.stateAfterTyping = 'waiting-execute'
    
    this.typeLine('HTTP Visualizer v1.0 - Terminal Mode', 'info')
    this.typeLine('═'.repeat(45), 'info')
    this.typeLine('', 'output')
    this.typeLine('Request selected:', 'info')
    this.typeLine(`  Name: ${request.name}`, 'output')
    this.typeLine(`  Method: ${request.method}`, 'output')
    this.typeLine(`  URL: ${this.truncateUrl(resolvedUrl, 70)}`, 'output')
    this.typeLine(`  Headers: ${request.headers.length}`, 'output')
    this.typeLine(`  Body: ${request.body ? 'Yes' : 'No'}`, 'output')
    this.typeLine('', 'output')
    this.typeLine('[ Press ENTER to execute ]', 'prompt')
  }

  // Called when execution phase changes
  public setPhase(phase: ExecutionPhase, funnyText: string) {
    if (phase === 'authenticating') {
      this.typeLine('', 'output')
      this.typeLine('─'.repeat(35), 'info')
      this.typeLine('> Authenticating...', 'command')
    }
    
    if (phase === 'fetching') {
      this.typeLine('', 'output')
      const method = this.currentRequest?.method || 'GET'
      const rawUrl = this.currentRequest?.url || ''
      const resolvedUrl = resolveVariables(rawUrl, this.resolvedVariables)
      const url = this.truncateUrl(resolvedUrl, 60)
      this.typeLine(`> ${method} ${url}`, 'command')
      this.typeLine('  Sending request...', 'output')
      this.typeLine(`  ${funnyText}`, 'info')
    }
    
    if (phase === 'success') {
      this.typeLine('', 'output')
      this.typeLine('✓ Request completed successfully!', 'success')
    }
    
    if (phase === 'error') {
      this.typeLine('', 'output')
      this.typeLine('✗ Request failed!', 'error')
    }
  }

  // Called when response is received
  public setResponse(status: number, statusText: string, size: number, duration: number) {
    this.stateAfterTyping = 'waiting-response'
    
    this.typeLine('', 'output')
    this.typeLine('─'.repeat(35), 'info')
    this.typeLine('RESPONSE:', 'info')
    
    const statusType = status >= 200 && status < 300 ? 'success' : 'error'
    this.typeLine(`  Status: ${status} ${statusText}`, statusType)
    this.typeLine(`  Size: ${this.formatBytes(size)}`, 'output')
    this.typeLine(`  Time: ${duration.toFixed(0)}ms`, 'output')
    this.typeLine('─'.repeat(35), 'info')
    this.typeLine('', 'output')
    this.typeLine('[ Press ENTER to open response ]', 'prompt')
  }

  // Called when error occurs
  public setError(message: string) {
    this.stateAfterTyping = 'waiting-execute'
    
    this.typeLine('', 'output')
    this.typeLine('─'.repeat(35), 'error')
    this.typeLine('ERROR:', 'error')
    this.typeLine(`  ${message}`, 'error')
    this.typeLine('─'.repeat(35), 'error')
    this.typeLine('', 'output')
    this.typeLine('═'.repeat(45), 'info')
    this.typeLine('[ Press ENTER to execute ]', 'prompt')
  }

  // Called when JSON reveal modal is closed
  public onJsonRevealClosed() {
    // State should already be waiting-execute from handleInput
  }

  // Clear typing state
  private clearTyping() {
    if (this.typingInterval) {
      clearInterval(this.typingInterval)
      this.typingInterval = null
    }
    this.typingQueue = []
    this.typingText = ''
    this.typingIndex = 0
    this.typingCallback = undefined
    this.state = 'idle' // Reset state so new typing can start
  }

  public isWaitingForInput(): boolean {
    return this.state === 'waiting-execute' || this.state === 'waiting-response'
  }

  private truncateUrl(url: string, maxLength: number): string {
    if (url.length <= maxLength) return url
    try {
      const parsed = new URL(url)
      const path = parsed.pathname + parsed.search
      const availableForPath = maxLength - parsed.host.length - 4
      if (availableForPath > 10) {
        return parsed.host + path.substring(0, availableForPath) + '...'
      }
      return url.substring(0, maxLength) + '...'
    } catch {
      return url.substring(0, maxLength) + '...'
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  public resize(width: number, height: number) {
    this.options.width = width
    this.options.height = height
    this.draw()
    this.renderLines()
  }

  public setColors(primaryColor: number, secondaryColor: number, bgColor: number, textColor: number, errorColor: number) {
    this.options.primaryColor = primaryColor
    this.options.secondaryColor = secondaryColor
    this.options.bgColor = bgColor
    this.options.textColor = textColor
    this.options.errorColor = errorColor
    this.draw()
    this.renderLines()
  }

  public destroy() {
    this.clearTyping()
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval)
    }
    this.textObjects.forEach(t => t.destroy())
    super.destroy()
  }
}
