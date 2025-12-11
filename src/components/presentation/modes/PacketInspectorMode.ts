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
 * Packet Inspector Mode - Hex dump visualization of request/response
 * 
 * Shows:
 * - Split view: hex on left, ASCII on right
 * - Syntax highlighting for headers vs body
 * - Byte offset column
 * - Animated "scanning" effect during execution
 */

interface HexLine {
  offset: number
  hex: string[]
  ascii: string
  type: 'header' | 'body' | 'separator'
}

type PacketState = 'idle' | 'selected' | 'scanning' | 'complete' | 'error'

export class PacketInspectorMode extends Container implements IPresentationMode {
  private options: PresentationModeOptions
  private settings: PresentationModeSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }

  // Graphics layers
  private backgroundGraphics: Graphics
  private gridGraphics: Graphics
  private scanlineGraphics: Graphics
  private labelsContainer: Container

  // State
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private state: PacketState = 'idle'
  private responseData: { status: number; statusText: string; size: number; duration: number } | null = null
  private errorMessage: string | null = null

  // Hex dump data
  private requestLines: HexLine[] = []
  private responseLines: HexLine[] = []
  private visibleLines: number = 0
  private scanPosition: number = 0
  private scrollOffset: number = 0

  // Animation
  private ticker: Ticker
  private scanSpeed: number = 0.5
  private glowPhase: number = 0

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  // Layout constants
  private readonly PADDING = 20
  private readonly LINE_HEIGHT = 18
  private readonly OFFSET_WIDTH = 70
  private readonly HEX_WIDTH = 380
  private readonly ASCII_WIDTH = 140
  private readonly BYTES_PER_LINE = 16

  // Colors
  private readonly HEADER_COLOR = 0x61affe
  private readonly BODY_COLOR = 0x49cc90
  private readonly SEPARATOR_COLOR = 0xfca130

  constructor(options: PresentationModeOptions) {
    super()
    this.options = options

    // Create graphics layers
    this.backgroundGraphics = new Graphics()
    this.addChild(this.backgroundGraphics)

    this.gridGraphics = new Graphics()
    this.addChild(this.gridGraphics)

    this.scanlineGraphics = new Graphics()
    this.addChild(this.scanlineGraphics)

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
    this.drawHexDump()
    this.drawScanEffect()
  }

  private drawBackground() {
    const { width, height, bgColor, primaryColor } = this.options
    
    this.backgroundGraphics.clear()
    
    // Main background - darker for hex dump aesthetic
    this.backgroundGraphics.rect(0, 0, width, height)
    this.backgroundGraphics.fill({ color: 0x0a0a0a, alpha: 0.98 })

    // CRT scanline effect
    for (let y = 0; y < height; y += 3) {
      this.backgroundGraphics.rect(0, y, width, 1)
      this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.15 })
    }

    // Header area
    this.backgroundGraphics.rect(0, 0, width, 50)
    this.backgroundGraphics.fill({ color: primaryColor, alpha: 0.08 })
    
    // Column headers background
    this.backgroundGraphics.rect(0, 50, width, height - 50)
    this.backgroundGraphics.fill({ color: 0x1a1a1a, alpha: 0.9 })

    // Border glow
    this.backgroundGraphics.rect(0, 0, width, 2)
    this.backgroundGraphics.fill({ color: primaryColor, alpha: 0.5 })
    this.backgroundGraphics.rect(0, height - 2, width, 2)
    this.backgroundGraphics.fill({ color: primaryColor, alpha: 0.5 })
  }

  private drawHexDump() {
    const { width, height, primaryColor, textColor, errorColor } = this.options
    
    this.gridGraphics.clear()
    this.labelsContainer.removeChildren()

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 14,
      fill: primaryColor,
      fontWeight: 'bold',
    })
    const title = new Text({ 
      text: '[ PACKET INSPECTOR ]', 
      style: titleStyle 
    })
    title.x = this.PADDING
    title.y = 15
    this.labelsContainer.addChild(title)

    if (this.state === 'idle') {
      const placeholderStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 16,
        fill: textColor,
        align: 'center',
      })
      const placeholder = new Text({ 
        text: 'Select a request to inspect packet data', 
        style: placeholderStyle 
      })
      placeholder.anchor.set(0.5)
      placeholder.x = width / 2
      placeholder.y = height / 2
      this.labelsContainer.addChild(placeholder)
      return
    }

    // Column headers
    const headerStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 10,
      fill: 0x888888,
    })

    const offsetHeader = new Text({ text: 'OFFSET', style: headerStyle })
    offsetHeader.x = this.PADDING
    offsetHeader.y = 55
    this.labelsContainer.addChild(offsetHeader)

    const hexHeader = new Text({ text: 'HEX DUMP', style: headerStyle })
    hexHeader.x = this.PADDING + this.OFFSET_WIDTH
    hexHeader.y = 55
    this.labelsContainer.addChild(hexHeader)

    const asciiHeader = new Text({ text: 'ASCII', style: headerStyle })
    asciiHeader.x = this.PADDING + this.OFFSET_WIDTH + this.HEX_WIDTH
    asciiHeader.y = 55
    this.labelsContainer.addChild(asciiHeader)

    // Determine which lines to show
    const lines = this.state === 'complete' || this.state === 'error' 
      ? [...this.requestLines, ...this.responseLines]
      : this.requestLines

    const startY = 85
    const maxVisibleLines = Math.floor((height - startY - this.PADDING) / this.LINE_HEIGHT)
    const displayLines = lines.slice(this.scrollOffset, this.scrollOffset + maxVisibleLines)

    // Draw hex lines
    displayLines.forEach((line, index) => {
      const y = startY + index * this.LINE_HEIGHT
      const isScanning = this.state === 'scanning' && index === Math.floor(this.scanPosition)
      if (isScanning) {
        this.gridGraphics.rect(0, y - 2, width, this.LINE_HEIGHT + 2)
        this.gridGraphics.fill({ color: primaryColor, alpha: 0.15 })
      }

      // Only show lines up to scan position during scanning
      if (this.state === 'scanning' && index > this.scanPosition) {
        return
      }

      // Offset column
      const offsetStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 11,
        fill: 0x666666,
      })
      const offsetText = new Text({ 
        text: line.offset.toString(16).toUpperCase().padStart(8, '0'), 
        style: offsetStyle 
      })
      offsetText.x = this.PADDING
      offsetText.y = y
      this.labelsContainer.addChild(offsetText)

      // Hex bytes
      const hexColor = line.type === 'header' ? this.HEADER_COLOR 
        : line.type === 'separator' ? this.SEPARATOR_COLOR 
        : this.BODY_COLOR

      line.hex.forEach((byte, byteIndex) => {
        const hexStyle = new TextStyle({
          fontFamily: 'Fira Code, monospace',
          fontSize: 11,
          fill: hexColor,
        })
        const byteText = new Text({ text: byte, style: hexStyle })
        byteText.x = this.PADDING + this.OFFSET_WIDTH + byteIndex * 23
        byteText.y = y
        
        // Fade in effect during scanning
        if (isScanning) {
          byteText.alpha = 0.5 + Math.sin(this.glowPhase + byteIndex * 0.3) * 0.5
        }
        
        this.labelsContainer.addChild(byteText)
      })

      // ASCII representation
      const asciiStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 11,
        fill: line.type === 'header' ? this.HEADER_COLOR : textColor,
      })
      const asciiText = new Text({ text: line.ascii, style: asciiStyle })
      asciiText.x = this.PADDING + this.OFFSET_WIDTH + this.HEX_WIDTH
      asciiText.y = y
      this.labelsContainer.addChild(asciiText)
    })

    // Status info
    if (this.state === 'complete' && this.responseData) {
      const statusColor = this.responseData.status >= 400 ? errorColor : 0x27ca40
      const statusStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 12,
        fill: statusColor,
      })
      const statusText = new Text({ 
        text: `${this.responseData.status} ${this.responseData.statusText} | ${this.responseData.size} bytes | ${this.responseData.duration.toFixed(0)}ms`, 
        style: statusStyle 
      })
      statusText.x - this.PADDING - 300
      statusText.y = 17
      this.labelsContainer.addChild(statusText)
    }

    // Error state
    if (this.state === 'error' && this.errorMessage) {
      const errorStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 12,
        fill: errorColor,
      })
      const errorText = new Text({ text: `ERROR: ${this.errorMessage}`, style: errorStyle })
      errorText.x = width - this.PADDING - 400
      errorText.y = 17
      this.labelsContainer.addChild(errorText)
    }

    // Scroll indicator
    if (lines.length > maxVisibleLines) {
      const scrollStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 10,
        fill: 0x666666,
      })
      const scrollText = new Text({ 
        text: `Lines ${this.scrollOffset + 1}-${Math.min(this.scrollOffset + maxVisibleLines, lines.length)} of ${lines.length}`, 
        style: scrollStyle 
      })
      scrollText.anchor.set(1, 0)
      scrollText.x = width - this.PADDING
      scrollText.y = height - 20
      this.labelsContainer.addChild(scrollText)
    }
  }

  private drawScanEffect() {
    const { width, height, primaryColor } = this.options
    
    this.scanlineGraphics.clear()

    if (this.state !== 'scanning') return

    const startY = 85
    const scanY = startY + this.scanPosition * this.LINE_HEIGHT

    // Scanning beam
    this.scanlineGraphics.rect(0, scanY - 1, width, 3)
    this.scanlineGraphics.fill({ color: primaryColor, alpha: 0.8 })

    // Glow trail
    for (let i = 1; i <= 5; i++) {
      this.scanlineGraphics.rect(0, scanY - i * this.LINE_HEIGHT, width, this.LINE_HEIGHT)
      this.scanlineGraphics.fill({ color: primaryColor, alpha: 0.1 - i * 0.02 })
    }
  }

  private update() {
    let needsRedraw = false

    // Update scanning animation
    if (this.state === 'scanning') {
      const maxLines = this.requestLines.length
      if (this.scanPosition < maxLines) {
        this.scanPosition += this.scanSpeed
        this.glowPhase += 0.2
        needsRedraw = true
      }
    }

    if (needsRedraw) {
      this.draw()
    }
  }

  private generateHexLines(data: string, type: 'header' | 'body' | 'separator'): HexLine[] {
    const lines: HexLine[] = []
    const bytes = new TextEncoder().encode(data)
    
    for (let i = 0; i < bytes.length; i += this.BYTES_PER_LINE) {
      const chunk = bytes.slice(i, i + this.BYTES_PER_LINE)
      const hex: string[] = []
      let ascii = ''

      for (let j = 0; j < this.BYTES_PER_LINE; j++) {
        if (j < chunk.length) {
          hex.push(chunk[j].toString(16).toUpperCase().padStart(2, '0'))
          // ASCII: printable chars only
          const char = chunk[j]
          ascii += (char >= 32 && char <= 126) ? String.fromCharCode(char) : '.'
        } else {
          hex.push('  ')
          ascii += ' '
        }
      }

      lines.push({
        offset: i,
        hex,
        ascii,
        type,
      })
    }

    return lines
  }

  private buildRequestHex() {
    if (!this.currentRequest) {
      this.requestLines = []
      return
    }

    const method = this.currentRequest.method
    const url = resolveVariables(this.currentRequest.url, this.resolvedVariables)
    const headers = this.currentRequest.headers || []

    // Build HTTP request string
    let requestStr = `${method} ${url} HTTP/1.1\r\n`
    
    for (const header of headers) {
      const value = resolveVariables(header.value, this.resolvedVariables)
      requestStr += `${header.key}: ${value}\r\n`
    }
    requestStr += '\r\n'

    // Generate hex lines for headers
    this.requestLines = this.generateHexLines(requestStr, 'header')

    // Add separator
    this.requestLines.push({
      offset: requestStr.length,
      hex: Array(this.BYTES_PER_LINE).fill('--'),
      ascii: '--- BODY ---'.padEnd(this.BYTES_PER_LINE, '-'),
      type: 'separator',
    })

    // Add body if present
    if (this.currentRequest.body) {
      const bodyStr = typeof this.currentRequest.body === 'string' 
        ? this.currentRequest.body 
        : JSON.stringify(this.currentRequest.body)
      const bodyLines = this.generateHexLines(bodyStr, 'body')
      
      // Adjust offsets
      const bodyOffset = requestStr.length + this.BYTES_PER_LINE
      bodyLines.forEach((line, i) => {
        line.offset = bodyOffset + i * this.BYTES_PER_LINE
      })
      
      this.requestLines.push(...bodyLines)
    }
  }

  private buildResponseHex() {
    if (!this.responseData) {
      this.responseLines = []
      return
    }

    // Separator between request and response
    const sepOffset = this.requestLines.length > 0 
      ? this.requestLines[this.requestLines.length - 1].offset + this.BYTES_PER_LINE
      : 0

    this.responseLines = [{
      offset: sepOffset,
      hex: Array(this.BYTES_PER_LINE).fill('--'),
      ascii: '=== RESPONSE ==='.padEnd(this.BYTES_PER_LINE, '='),
      type: 'separator',
    }]

    // Response status line
    const statusLine = `HTTP/1.1 ${this.responseData.status} ${this.responseData.statusText}\r\n\r\n`
    const statusLines = this.generateHexLines(statusLine, 'header')
    statusLines.forEach((line, i) => {
      line.offset = sepOffset + this.BYTES_PER_LINE + i * this.BYTES_PER_LINE
    })
    this.responseLines.push(...statusLines)
  }

  // IPresentationMode implementation

  public setRequest(request: ParsedRequest | null, variables: Record<string, string> = {}) {
    this.currentRequest = request
    this.resolvedVariables = variables
    this.responseData = null
    this.errorMessage = null
    this.requestLines = []
    this.responseLines = []
    this.scanPosition = 0
    this.scrollOffset = 0

    if (!request) {
      this.state = 'idle'
    } else {
      this.state = 'selected'
      this.buildRequestHex()
    }

    this.draw()
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    switch (phase) {
      case 'idle':
        this.state = this.currentRequest ? 'selected' : 'idle'
        this.scanPosition = 0
        this.responseData = null
        this.errorMessage = null
        this.responseLines = []
        break

      case 'authenticating':
      case 'fetching':
        this.state = 'scanning'
        this.scanPosition = 0
        break

      case 'success':
        this.state = 'complete'
        this.scanPosition = this.requestLines.length
        break

      case 'error':
        this.state = 'error'
        this.scanPosition = this.requestLines.length
        break
    }

    this.draw()
  }

  public setResponse(status: number, statusText: string, size: number, duration: number) {
    this.responseData = { status, statusText, size, duration }
    this.buildResponseHex()
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

  public handleInputClick(): boolean {
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
    this.gridGraphics.destroy()
    this.scanlineGraphics.destroy()
    this.labelsContainer.destroy()
    super.destroy()
  }
}

