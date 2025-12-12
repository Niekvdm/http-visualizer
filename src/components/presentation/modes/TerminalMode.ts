import { Container, Graphics, Text, TextStyle, BlurFilter } from 'pixi.js'
import type { ExecutionPhase, ParsedRequest } from '@/types'
import type { ExtendedResponseData } from './IPresentationMode'
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
  private vignette: Graphics
  private bezel: Graphics
  private screenMask: Graphics
  private glowContainer: Container
  private terminalContainer: Container
  private lines: TerminalLine[] = []
  private textObjects: Text[] = []
  private glowObjects: Text[] = []
  private glowFilter: BlurFilter
  private cursorBlink: Graphics
  private cursorGlow: Graphics
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
  private readonly BEZEL_WIDTH = 20

  private get maxLines(): number {
    const availableHeight = this.options.height - (this.PADDING * 2)
    return Math.max(1, Math.floor(availableHeight / this.LINE_HEIGHT) - 1)
  }

  constructor(options: TerminalModeOptions) {
    super()
    this.options = options

    // Background behind everything (dark frame area)
    this.background = new Graphics()
    this.addChild(this.background)

    // CRT screen background and effects
    this.crtOverlay = new Graphics()
    this.addChild(this.crtOverlay)

    // Scanlines (on screen)
    this.scanlines = new Graphics()
    this.addChild(this.scanlines)

    // Glow layer (blurred text for phosphor bloom effect)
    this.glowFilter = new BlurFilter({ strength: 2, quality: 5 })
    this.glowContainer = new Container()
    this.glowContainer.filters = [this.glowFilter]
    this.addChild(this.glowContainer)

    // Terminal content container (sharp text on top)
    this.terminalContainer = new Container()
    this.addChild(this.terminalContainer)

    // Vignette effect (darker edges, on top of text)
    this.vignette = new Graphics()
    this.addChild(this.vignette)

    // Screen mask (used for clipping, not visible)
    this.screenMask = new Graphics()

    // Bezel frame around the curved screen
    this.bezel = new Graphics()
    this.addChild(this.bezel)

    // Cursor glow (blurred)
    this.cursorGlow = new Graphics()
    this.cursorGlow.filters = [new BlurFilter({ strength: 4, quality: 2 })]
    this.addChild(this.cursorGlow)

    // Cursor on top of everything (sharp)
    this.cursorBlink = new Graphics()
    this.addChild(this.cursorBlink)

    this.draw()
    this.startCursorBlink()
    this.initTerminal()
  }

  private draw() {
    const { width, height, bgColor, primaryColor } = this.options

    // Background
    this.background.clear()
    this.background.rect(0, 0, width, height)
    this.background.fill({ color: bgColor })

    // CRT overlay effects
    this.crtOverlay.clear()

    // Scanlines
    this.scanlines.clear()
    for (let y = 0; y < height; y += 3) {
      this.scanlines.moveTo(0, y)
      this.scanlines.lineTo(width, y)
      this.scanlines.stroke({ color: 0x000000, alpha: 0.07, width: 1 })
    }

    // Vignette effect (edge shadows for CRT look)
    this.drawVignette(0, 0, width, height)

    // Clear unused graphics
    this.bezel.clear()

    this.updateCursor()
  }

  // Draw CRT phosphor backglow effect
  private drawBackglow(width: number, height: number, glowColor: number) {
    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = Math.max(width, height) * 0.7

    // Draw concentric ellipses from center outward with decreasing alpha
    for (let r = maxRadius; r > 0; r -= 20) {
      const alpha = 0.03 * (r / maxRadius)
      const scaleX = width / height // Stretch horizontally to make ellipse

      this.crtOverlay.ellipse(centerX, centerY, r * scaleX * 0.5, r * 0.5)
      this.crtOverlay.fill({ color: glowColor, alpha })
    }
  }

  // Draw a rectangle with curved/bulging edges (CRT screen shape)
  private drawCurvedRect(graphics: Graphics, x: number, y: number, w: number, h: number, curve: number) {
    const cx = curve * w // Horizontal curve offset
    const cy = curve * h // Vertical curve offset

    graphics.moveTo(x, y + cy)
    // Top edge (curves inward slightly)
    graphics.quadraticCurveTo(x + w / 2, y - cy * 0.5, x + w, y + cy)
    // Right edge
    graphics.quadraticCurveTo(x + w + cx * 0.5, y + h / 2, x + w, y + h - cy)
    // Bottom edge
    graphics.quadraticCurveTo(x + w / 2, y + h + cy * 0.5, x, y + h - cy)
    // Left edge
    graphics.quadraticCurveTo(x - cx * 0.5, y + h / 2, x, y + cy)
  }

  // Draw vignette effect
  private drawVignette(x: number, y: number, w: number, h: number) {
    this.vignette.clear()

    const edgeWidth = Math.min(w, h) * 0.15

    // Top edge shadow
    for (let i = 0; i < edgeWidth; i++) {
      const alpha = 0.15 * (1 - i / edgeWidth)
      this.vignette.moveTo(x, y + i)
      this.vignette.lineTo(x + w, y + i)
      this.vignette.stroke({ color: 0x000000, alpha, width: 1 })
    }

    // Bottom edge shadow
    for (let i = 0; i < edgeWidth; i++) {
      const alpha = 0.15 * (1 - i / edgeWidth)
      this.vignette.moveTo(x, y + h - i)
      this.vignette.lineTo(x + w, y + h - i)
      this.vignette.stroke({ color: 0x000000, alpha, width: 1 })
    }

    // Left edge shadow
    for (let i = 0; i < edgeWidth; i++) {
      const alpha = 0.1 * (1 - i / edgeWidth)
      this.vignette.moveTo(x + i, y)
      this.vignette.lineTo(x + i, y + h)
      this.vignette.stroke({ color: 0x000000, alpha, width: 1 })
    }

    // Right edge shadow
    for (let i = 0; i < edgeWidth; i++) {
      const alpha = 0.1 * (1 - i / edgeWidth)
      this.vignette.moveTo(x + w - i, y)
      this.vignette.lineTo(x + w - i, y + h)
      this.vignette.stroke({ color: 0x000000, alpha, width: 1 })
    }

    // Corner darkening
    const cornerSize = edgeWidth * 1.5
    this.drawCornerShadow(x, y, cornerSize, 0) // Top-left
    this.drawCornerShadow(x + w, y, cornerSize, 1) // Top-right
    this.drawCornerShadow(x + w, y + h, cornerSize, 2) // Bottom-right
    this.drawCornerShadow(x, y + h, cornerSize, 3) // Bottom-left
  }

  // Draw corner shadow for vignette
  private drawCornerShadow(cx: number, cy: number, size: number, corner: number) {
    for (let r = size; r > 0; r -= 2) {
      const alpha = 0.08 * (1 - r / size)
      const startAngle = (corner * Math.PI) / 2
      const endAngle = startAngle + Math.PI / 2

      this.vignette.arc(cx, cy, r, startAngle, endAngle)
      this.vignette.stroke({ color: 0x000000, alpha, width: 2 })
    }
  }

  // Draw the monitor bezel
  private drawBezel(width: number, height: number, curve: number, accentColor: number) {
    this.bezel.clear()

    const innerLeft = this.BEZEL_WIDTH
    const innerTop = this.BEZEL_WIDTH
    const innerWidth = width - this.BEZEL_WIDTH * 2
    const innerHeight = height - this.BEZEL_WIDTH * 2

    // Outer bezel (dark frame)
    this.bezel.roundRect(0, 0, width, height, 8)
    this.bezel.fill({ color: 0x1a1a1a })

    // Inner bezel edge (slight bevel)
    this.bezel.roundRect(4, 4, width - 8, height - 8, 6)
    this.bezel.fill({ color: 0x252525 })

    // Cut out the screen area
    this.drawCurvedRect(this.bezel, innerLeft, innerTop, innerWidth, innerHeight, curve)
    this.bezel.cut()

    // Screen edge glow (subtle reflection on bezel edge)
    this.bezel.moveTo(innerLeft, innerTop + innerHeight * 0.1)
    this.bezel.quadraticCurveTo(innerLeft - 2, innerTop + innerHeight / 2, innerLeft, innerTop + innerHeight * 0.9)
    this.bezel.stroke({ color: accentColor, alpha: 0.15, width: 1 })

    this.bezel.moveTo(innerLeft + innerWidth, innerTop + innerHeight * 0.1)
    this.bezel.quadraticCurveTo(innerLeft + innerWidth + 2, innerTop + innerHeight / 2, innerLeft + innerWidth, innerTop + innerHeight * 0.9)
    this.bezel.stroke({ color: accentColor, alpha: 0.1, width: 1 })
  }

  private updateCursor() {
    this.cursorBlink.clear()
    this.cursorGlow.clear()

    // Show cursor when typing or waiting for input
    if (this.cursorVisible) {
      const lineY = this.PADDING + (this.lines.length * this.LINE_HEIGHT)
      const curveOffset = this.getCurveOffset(lineY)

      if (this.state === 'typing' && this.typingText) {
        // Cursor at end of typing text
        const cursorX = this.PADDING + curveOffset + (this.typingIndex * 9)
        // Glow
        this.cursorGlow.rect(cursorX - 2, lineY - 2, 12, 20)
        this.cursorGlow.fill({ color: this.options.primaryColor })
        // Sharp cursor
        this.cursorBlink.rect(cursorX, lineY, 8, 16)
        this.cursorBlink.fill({ color: this.options.primaryColor })
      } else if (this.state === 'waiting-execute' || this.state === 'waiting-response') {
        // Cursor at start of new line
        const cursorX = this.PADDING + curveOffset
        // Glow
        this.cursorGlow.rect(cursorX - 2, lineY - 2, 12, 20)
        this.cursorGlow.fill({ color: this.options.primaryColor })
        // Sharp cursor
        this.cursorBlink.rect(cursorX, lineY, 8, 16)
        this.cursorBlink.fill({ color: this.options.primaryColor })
      }
    }
  }

  // Calculate horizontal offset for CRT barrel distortion effect
  private getCurveOffset(y: number): number {
    const centerY = this.options.height / 2
    const normalizedY = (y - centerY) / centerY // -1 to 1
    const curveStrength = 0 // Max pixels of curve at edges
    return curveStrength * (normalizedY * normalizedY) // Parabolic curve
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

    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines)
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
    // Clear existing text
    this.textObjects.forEach(t => t.destroy())
    this.textObjects = []
    this.glowObjects.forEach(t => t.destroy())
    this.glowObjects = []

    // Render completed lines with CRT curve effect
    this.lines.forEach((line, index) => {
      const y = this.PADDING + (index * this.LINE_HEIGHT)
      const curveOffset = this.getCurveOffset(y)
      const style = this.getTextStyle(line.type)
      const x = this.PADDING + curveOffset

      // Glow text (blurred copy)
      const glowText = new Text({ text: line.text, style })
      glowText.x = x
      glowText.y = y
      this.glowContainer.addChild(glowText)
      this.glowObjects.push(glowText)

      // Sharp text on top
      const text = new Text({ text: line.text, style })
      text.x = x
      text.y = y
      this.terminalContainer.addChild(text)
      this.textObjects.push(text)
    })

    // Render typing line
    if (this.state === 'typing' && this.typingText) {
      const y = this.PADDING + (this.lines.length * this.LINE_HEIGHT)
      const curveOffset = this.getCurveOffset(y)
      const style = this.getTextStyle(this.currentTypingType)
      const visibleText = this.typingText.substring(0, this.typingIndex)
      const x = this.PADDING + curveOffset

      // Glow text
      const glowText = new Text({ text: visibleText, style })
      glowText.x = x
      glowText.y = y
      this.glowContainer.addChild(glowText)
      this.glowObjects.push(glowText)

      // Sharp text
      const text = new Text({ text: visibleText, style })
      text.x = x
      text.y = y
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
  public setResponse(status: number, statusText: string, size: number, duration: number, extendedData?: ExtendedResponseData) {
    this.stateAfterTyping = 'waiting-response'

    // Show redirect chain first if present
    if (extendedData?.redirectChain && extendedData.redirectChain.length > 0) {
      this.typeLine('', 'output')
      this.typeLine('─'.repeat(35), 'info')
      this.typeLine(`REDIRECTS: (${extendedData.redirectChain.length} hops)`, 'info')

      extendedData.redirectChain.forEach((hop, index) => {
        const hopUrl = this.truncateUrl(hop.url, 45)
        const statusColor = hop.status >= 300 && hop.status < 400 ? 'command' : 'output'
        this.typeLine(`  ${index + 1}. [${hop.status}] ${hopUrl}`, statusColor)
        if (hop.duration > 0) {
          this.typeLine(`     └─ ${hop.duration.toFixed(0)}ms`, 'info')
        }
      })
    }

    this.typeLine('', 'output')
    this.typeLine('─'.repeat(35), 'info')
    this.typeLine('RESPONSE:', 'info')

    const statusType = status >= 200 && status < 300 ? 'success' : 'error'
    this.typeLine(`  Status: ${status} ${statusText}`, statusType)
    this.typeLine(`  Size: ${this.formatBytes(size)}`, 'output')
    this.typeLine(`  Time: ${duration.toFixed(0)}ms`, 'output')

    // Show extended timing breakdown if available
    if (extendedData?.timing) {
      const { timing } = extendedData
      this.typeLine('', 'output')
      this.typeLine('  Timing Breakdown:', 'info')
      if (timing.dns !== undefined && timing.dns > 0) {
        this.typeLine(`    DNS:      ${timing.dns.toFixed(0)}ms`, 'output')
      }
      if (timing.tcp !== undefined && timing.tcp > 0) {
        this.typeLine(`    TCP:      ${timing.tcp.toFixed(0)}ms`, 'output')
      }
      if (timing.tls !== undefined && timing.tls > 0) {
        this.typeLine(`    TLS:      ${timing.tls.toFixed(0)}ms`, 'output')
      }
      if (timing.ttfb !== undefined && timing.ttfb > 0) {
        this.typeLine(`    TTFB:     ${timing.ttfb.toFixed(0)}ms`, 'output')
      }
      if (timing.download !== undefined && timing.download > 0) {
        this.typeLine(`    Download: ${timing.download.toFixed(0)}ms`, 'output')
      }
    }

    // Show size breakdown if available
    if (extendedData?.sizeBreakdown) {
      const { sizeBreakdown } = extendedData
      this.typeLine('', 'output')
      this.typeLine('  Size Breakdown:', 'info')
      this.typeLine(`    Headers: ${this.formatBytes(sizeBreakdown.headers)}`, 'output')
      this.typeLine(`    Body:    ${this.formatBytes(sizeBreakdown.body)}`, 'output')
      if (sizeBreakdown.encoding && sizeBreakdown.encoding !== 'identity') {
        this.typeLine(`    Encoding: ${sizeBreakdown.encoding}`, 'output')
        if (sizeBreakdown.compressionRatio !== undefined) {
          const ratio = ((1 - sizeBreakdown.compressionRatio) * 100).toFixed(0)
          this.typeLine(`    Compressed: ${ratio}% savings`, 'success')
        }
      }
    }

    // Show TLS info if available
    if (extendedData?.tls) {
      const { tls } = extendedData
      this.typeLine('', 'output')
      this.typeLine('  TLS/SSL:', 'info')
      if (tls.protocol) {
        this.typeLine(`    Protocol: ${tls.protocol}`, 'output')
      }
      if (tls.cipher) {
        this.typeLine(`    Cipher:   ${this.truncateText(tls.cipher, 30)}`, 'output')
      }
    }

    // Show connection info
    if (extendedData?.protocol || extendedData?.serverIP || extendedData?.fromCache) {
      this.typeLine('', 'output')
      this.typeLine('  Connection:', 'info')
      if (extendedData.protocol) {
        this.typeLine(`    Protocol: ${extendedData.protocol}`, 'output')
      }
      if (extendedData.serverIP) {
        this.typeLine(`    Server:   ${extendedData.serverIP}`, 'output')
      }
      if (extendedData.fromCache) {
        this.typeLine(`    Cached:   Yes`, 'success')
      }
    }

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

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
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
    this.glowObjects.forEach(t => t.destroy())
    super.destroy()
  }
}
