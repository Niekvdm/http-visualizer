import { Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js'
import type { ExecutionPhase, ParsedRequest } from '@/types'
import type { 
  IPresentationMode, 
  PresentationModeOptions, 
  PresentationModeSettings,
  PresentationModeEvent 
} from './IPresentationMode'
import { resolveVariables } from '@/utils/variableResolver'

/**
 * cURL Mode - Terminal-style cURL command display
 * 
 * Shows:
 * - Generated equivalent cURL command
 * - Syntax highlighting for flags, URLs, headers
 * - Typing animation for command construction
 * - "Execute" animation with spinner
 */

interface CurlToken {
  text: string
  type: 'command' | 'flag' | 'url' | 'header' | 'data' | 'string' | 'operator'
}

type CurlState = 'idle' | 'selected' | 'typing' | 'executing' | 'complete' | 'error'

export class CurlMode extends Container implements IPresentationMode {
  private options: PresentationModeOptions
  private settings: PresentationModeSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }

  // Graphics layers
  private backgroundGraphics: Graphics
  private terminalGraphics: Graphics
  private cursorGraphics: Graphics
  private labelsContainer: Container

  // State
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private state: CurlState = 'idle'
  private responseData: { status: number; statusText: string; size: number; duration: number } | null = null
  private errorMessage: string | null = null

  // cURL command
  private curlTokens: CurlToken[] = []
  private typedChars: number = 0
  private totalChars: number = 0

  // Animation
  private ticker: Ticker
  private typingSpeed: number = 3
  private cursorVisible: boolean = true
  private cursorBlinkTimer: number = 0
  private spinnerFrame: number = 0
  private spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠧', '⠇', '⠏']

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  // Layout
  private readonly PADDING = 30
  private readonly LINE_HEIGHT = 24
  private readonly CHAR_WIDTH = 9.6

  // Syntax colors
  private readonly COLORS = {
    command: 0x61affe,    // Blue
    flag: 0xfca130,       // Orange
    url: 0x49cc90,        // Green
    header: 0xe3c22e,     // Yellow
    data: 0x9012fe,       // Purple
    string: 0x49cc90,     // Green
    operator: 0xffffff,   // White
  }

  constructor(options: PresentationModeOptions) {
    super()
    this.options = options

    // Create graphics layers
    this.backgroundGraphics = new Graphics()
    this.addChild(this.backgroundGraphics)

    this.terminalGraphics = new Graphics()
    this.addChild(this.terminalGraphics)

    this.cursorGraphics = new Graphics()
    this.addChild(this.cursorGraphics)

    this.labelsContainer = new Container()
    this.addChild(this.labelsContainer)

    // Start animation ticker
    this.ticker = new Ticker()
    this.ticker.add(() => this.update())
    this.ticker.start()

    this.draw()
  }

  private draw() {
    this.drawBackground()
    this.drawTerminal()
    this.drawCursor()
  }

  private drawBackground() {
    const { width, height, primaryColor } = this.options
    
    this.backgroundGraphics.clear()
    
    // Terminal background - dark with slight transparency
    this.backgroundGraphics.roundRect(this.PADDING / 2, this.PADDING / 2, width - this.PADDING, height - this.PADDING, 8)
    this.backgroundGraphics.fill({ color: 0x0d1117, alpha: 0.98 })
    this.backgroundGraphics.stroke({ color: primaryColor, alpha: 0.3, width: 2 })

    // Terminal title bar
    this.backgroundGraphics.roundRect(this.PADDING / 2, this.PADDING / 2, width - this.PADDING, 35, 8)
    this.backgroundGraphics.fill({ color: 0x161b22, alpha: 1 })

    // Window buttons
    const buttonY = this.PADDING / 2 + 12
    const buttonX = this.PADDING / 2 + 15
    
    // Close button (red)
    this.backgroundGraphics.circle(buttonX, buttonY, 6)
    this.backgroundGraphics.fill({ color: 0xff5f56 })
    
    // Minimize button (yellow)
    this.backgroundGraphics.circle(buttonX + 20, buttonY, 6)
    this.backgroundGraphics.fill({ color: 0xffbd2e })
    
    // Maximize button (green)
    this.backgroundGraphics.circle(buttonX + 40, buttonY, 6)
    this.backgroundGraphics.fill({ color: 0x27c93f })

    // Scanline effect
    for (let y = this.PADDING / 2 + 35; y < height - this.PADDING / 2; y += 3) {
      this.backgroundGraphics.rect(this.PADDING / 2, y, width - this.PADDING, 1)
      this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.1 })
    }
  }

  private drawTerminal() {
    const { width, height, primaryColor, textColor, errorColor } = this.options
    
    this.terminalGraphics.clear()
    this.labelsContainer.removeChildren()

    // Terminal title
    const titleStyle = new TextStyle({
      fontFamily: 'SF Mono, Fira Code, monospace',
      fontSize: 12,
      fill: 0x8b949e,
    })
    const title = new Text({ text: 'curl — bash', style: titleStyle })
    title.anchor.set(0.5, 0.5)
    title.x = width / 2
    title.y = this.PADDING / 2 + 17
    this.labelsContainer.addChild(title)

    const contentY = this.PADDING / 2 + 50

    if (this.state === 'idle') {
      const placeholderStyle = new TextStyle({
        fontFamily: 'SF Mono, Fira Code, monospace',
        fontSize: 14,
        fill: textColor,
        align: 'center',
      })
      const placeholder = new Text({ 
        text: 'Select a request to generate cURL command', 
        style: placeholderStyle 
      })
      placeholder.anchor.set(0.5)
      placeholder.x = width / 2
      placeholder.y = height / 2
      this.labelsContainer.addChild(placeholder)
      return
    }

    // Prompt
    const promptStyle = new TextStyle({
      fontFamily: 'SF Mono, Fira Code, monospace',
      fontSize: 14,
      fill: 0x58a6ff,
    })
    const prompt = new Text({ text: '$ ', style: promptStyle })
    prompt.x = this.PADDING
    prompt.y = contentY
    this.labelsContainer.addChild(prompt)

    // Build visible command based on typing progress
    let currentX = this.PADDING + 20
    let currentY = contentY
    let charsRendered = 0
    const maxWidth = width - this.PADDING * 2 - 40

    for (const token of this.curlTokens) {
      for (let i = 0; i < token.text.length; i++) {
        if (charsRendered >= this.typedChars) break

        const char = token.text[i]
        
        // Handle line wrapping for long commands
        if (char === '\n' || currentX > this.PADDING + maxWidth) {
          currentX = this.PADDING + 40 // Indent continuation
          currentY += this.LINE_HEIGHT
        }

        if (char === '\n') {
          charsRendered++
          continue
        }

        const charStyle = new TextStyle({
          fontFamily: 'SF Mono, Fira Code, monospace',
          fontSize: 14,
          fill: this.COLORS[token.type] || textColor,
        })
        const charText = new Text({ text: char, style: charStyle })
        charText.x = currentX
        charText.y = currentY
        this.labelsContainer.addChild(charText)

        currentX += this.CHAR_WIDTH
        charsRendered++
      }

      if (charsRendered >= this.typedChars) break
    }

    // Store cursor position for drawing
    this.drawCursorAt(currentX, currentY)

    // Executing spinner
    if (this.state === 'executing') {
      const spinnerY = currentY + this.LINE_HEIGHT * 2

      const spinnerStyle = new TextStyle({
        fontFamily: 'SF Mono, Fira Code, monospace',
        fontSize: 14,
        fill: primaryColor,
      })
      const spinner = new Text({ 
        text: `${this.spinnerChars[this.spinnerFrame]} Executing request...`, 
        style: spinnerStyle 
      })
      spinner.x = this.PADDING
      spinner.y = spinnerY
      this.labelsContainer.addChild(spinner)
    }

    // Response output
    if (this.state === 'complete' && this.responseData) {
      const outputY = currentY + this.LINE_HEIGHT * 2

      // Status line
      const statusColor = this.responseData.status >= 400 ? errorColor : 0x27c93f
      const statusStyle = new TextStyle({
        fontFamily: 'SF Mono, Fira Code, monospace',
        fontSize: 13,
        fill: statusColor,
      })
      const statusText = new Text({ 
        text: `< HTTP/1.1 ${this.responseData.status} ${this.responseData.statusText}`, 
        style: statusStyle 
      })
      statusText.x = this.PADDING
      statusText.y = outputY
      this.labelsContainer.addChild(statusText)

      // Timing info
      const infoStyle = new TextStyle({
        fontFamily: 'SF Mono, Fira Code, monospace',
        fontSize: 12,
        fill: 0x8b949e,
      })
      const infoText = new Text({ 
        text: `\n  time_total: ${(this.responseData.duration / 1000).toFixed(3)}s\n  size_download: ${this.responseData.size} bytes`, 
        style: infoStyle 
      })
      infoText.x = this.PADDING
      infoText.y = outputY + this.LINE_HEIGHT
      this.labelsContainer.addChild(infoText)

      // Prompt for next command
      const nextPromptStyle = new TextStyle({
        fontFamily: 'SF Mono, Fira Code, monospace',
        fontSize: 14,
        fill: 0x58a6ff,
      })
      const nextPrompt = new Text({ text: '$ _', style: nextPromptStyle })
      nextPrompt.x = this.PADDING
      nextPrompt.y = outputY + this.LINE_HEIGHT * 4
      this.labelsContainer.addChild(nextPrompt)
    }

    // Error output
    if (this.state === 'error' && this.errorMessage) {
      const outputY = currentY + this.LINE_HEIGHT * 2

      const errorStyle = new TextStyle({
        fontFamily: 'SF Mono, Fira Code, monospace',
        fontSize: 13,
        fill: errorColor,
      })
      const errorText = new Text({ 
        text: `curl: (7) ${this.errorMessage}`, 
        style: errorStyle 
      })
      errorText.x = this.PADDING
      errorText.y = outputY
      this.labelsContainer.addChild(errorText)
    }
  }

  private drawCursor() {
    // Cursor is drawn in drawCursorAt
  }

  private drawCursorAt(x: number, y: number) {
    this.cursorGraphics.clear()

    if (!this.cursorVisible) return
    if (this.state !== 'typing' && this.state !== 'selected') return

    this.cursorGraphics.rect(x, y, 2, this.LINE_HEIGHT - 4)
    this.cursorGraphics.fill({ color: this.options.primaryColor, alpha: 0.9 })
  }

  private update() {
    let needsRedraw = false

    // Cursor blink
    this.cursorBlinkTimer += 1
    if (this.cursorBlinkTimer >= 30) {
      this.cursorBlinkTimer = 0
      this.cursorVisible = !this.cursorVisible
      needsRedraw = true
    }

    // Typing animation
    if (this.state === 'typing' && this.typedChars < this.totalChars) {
      this.typedChars = Math.min(this.totalChars, this.typedChars + this.typingSpeed)
      needsRedraw = true

      if (this.typedChars >= this.totalChars) {
        // Typing complete, start executing
        this.state = 'executing'
      }
    }

    // Spinner animation
    if (this.state === 'executing') {
      this.spinnerFrame = (this.spinnerFrame + 1) % this.spinnerChars.length
      needsRedraw = true
    }

    if (needsRedraw) {
      this.draw()
    }
  }

  private generateCurlCommand() {
    if (!this.currentRequest) {
      this.curlTokens = []
      this.totalChars = 0
      return
    }

    this.curlTokens = []

    // curl command
    this.curlTokens.push({ text: 'curl', type: 'command' })
    this.curlTokens.push({ text: ' ', type: 'operator' })

    // Method flag (if not GET)
    const method = this.currentRequest.method
    if (method !== 'GET') {
      this.curlTokens.push({ text: '-X', type: 'flag' })
      this.curlTokens.push({ text: ' ', type: 'operator' })
      this.curlTokens.push({ text: method, type: 'string' })
      this.curlTokens.push({ text: ' ', type: 'operator' })
    }

    // URL
    const url = resolveVariables(this.currentRequest.url, this.resolvedVariables)
    this.curlTokens.push({ text: "'", type: 'operator' })
    this.curlTokens.push({ text: url, type: 'url' })
    this.curlTokens.push({ text: "'", type: 'operator' })

    // Headers
    const headers = this.currentRequest.headers || []
    for (const header of headers) {
      if (!header.enabled) continue
      const value = resolveVariables(header.value, this.resolvedVariables)
      
      this.curlTokens.push({ text: ' \\\n  ', type: 'operator' })
      this.curlTokens.push({ text: '-H', type: 'flag' })
      this.curlTokens.push({ text: ' ', type: 'operator' })
      this.curlTokens.push({ text: "'", type: 'operator' })
      this.curlTokens.push({ text: `${header.key}: ${value}`, type: 'header' })
      this.curlTokens.push({ text: "'", type: 'operator' })
    }

    // Body data
    if (this.currentRequest.body) {
      const bodyStr = typeof this.currentRequest.body === 'string' 
        ? this.currentRequest.body 
        : JSON.stringify(this.currentRequest.body)
      
      this.curlTokens.push({ text: ' \\\n  ', type: 'operator' })
      this.curlTokens.push({ text: '-d', type: 'flag' })
      this.curlTokens.push({ text: ' ', type: 'operator' })
      this.curlTokens.push({ text: "'", type: 'operator' })
      this.curlTokens.push({ text: bodyStr.slice(0, 100) + (bodyStr.length > 100 ? '...' : ''), type: 'data' })
      this.curlTokens.push({ text: "'", type: 'operator' })
    }

    // Calculate total characters
    this.totalChars = this.curlTokens.reduce((sum, token) => sum + token.text.length, 0)
  }

  // IPresentationMode implementation

  public setRequest(request: ParsedRequest | null, variables: Record<string, string> = {}) {
    this.currentRequest = request
    this.resolvedVariables = variables
    this.responseData = null
    this.errorMessage = null
    this.typedChars = 0
    this.spinnerFrame = 0

    if (!request) {
      this.state = 'idle'
      this.curlTokens = []
      this.totalChars = 0
    } else {
      this.state = 'selected'
      this.generateCurlCommand()
      // Show command immediately when selected
      this.typedChars = this.totalChars
    }

    this.draw()
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    switch (phase) {
      case 'idle':
        this.state = this.currentRequest ? 'selected' : 'idle'
        this.typedChars = this.totalChars
        this.responseData = null
        this.errorMessage = null
        break

      case 'authenticating':
      case 'fetching':
        if (this.state === 'selected') {
          // Reset and start typing animation
          this.typedChars = 0
          this.state = 'typing'
        } else {
          this.state = 'executing'
        }
        break

      case 'success':
        this.state = 'complete'
        this.typedChars = this.totalChars
        break

      case 'error':
        this.state = 'error'
        this.typedChars = this.totalChars
        break
    }

    this.draw()
  }

  public setResponse(status: number, statusText: string, size: number, duration: number) {
    this.responseData = { status, statusText, size, duration }
    this.draw()
  }

  public setError(message: string) {
    this.errorMessage = message
    this.draw()
  }

  public resize(width: number, height: number) {
    this.options.width = width
    this.options.height = height
    this.draw()
  }

  public setColors(
    primaryColor: number,
    secondaryColor: number,
    bgColor: number,
    textColor: number,
    errorColor: number
  ) {
    this.options.primaryColor = primaryColor
    this.options.secondaryColor = secondaryColor
    this.options.bgColor = bgColor
    this.options.textColor = textColor
    this.options.errorColor = errorColor
    this.draw()
  }

  public updateSettings(settings: Partial<PresentationModeSettings>) {
    this.settings = { ...this.settings, ...settings }
    if (settings.typingSpeed) {
      this.typingSpeed = Math.max(1, settings.typingSpeed / 20)
    }
  }

  public setEventCallback(callback: (event: PresentationModeEvent) => void) {
    this.onEvent = callback
  }

  public handleInput(): boolean {
    if (this.state === 'selected') {
      this.onEvent?.('execute-request')
      return true
    }
    if (this.state === 'complete' || this.state === 'error') {
      this.onEvent?.('open-response')
      return true
    }
    return false
  }

  public handleClick(): boolean {
    return this.handleInput()
  }

  public isWaitingForInput(): boolean {
    return this.state === 'selected' || this.state === 'complete' || this.state === 'error'
  }

  public onJsonRevealClosed() {
    // No special handling needed
  }

  public destroy() {
    this.ticker.stop()
    this.ticker.destroy()
    this.backgroundGraphics.destroy()
    this.terminalGraphics.destroy()
    this.cursorGraphics.destroy()
    this.labelsContainer.destroy()
    super.destroy()
  }
}

