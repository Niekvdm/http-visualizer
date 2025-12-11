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
 * HAR Timeline Mode - HTTP Archive format visualization
 * 
 * Shows:
 * - Horizontal timeline with request bar
 * -acked bars for multiple requests (future-ready)
 * - Request/response size indicators
 * - Timing breakdown within each bar
 * - Filmstrip-style phase markers
 */

interface TimelineEntry {
  url: string
  method: string
  status: number
  statusText: string
  startTime: number
  duration: number
  size: number
  phases: {
    blocked: number
    dns: number
    connect: number
    ssl: number
    send: number
    wait: number
    receive: number
  }
}

type HarState = 'idle' | 'selected' | 'loading' | 'complete' | 'error'

export class HarTimelineMode extends Container implements IPresentationMode {
  private options: PresentationModeOptions
  private settings: PresentationModeSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }

  // Graphics layers
  private backgroundGraphics: Graphics
  private timelineGraphics: Graphics
  private barsGraphics: Graphics
  private markersGraphics: Graphics
  private labelsContainer: Container

  // State
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private state: HarState = 'idle'
  private responseData: { status: number; statusText: string; size: number; duration: number } | null = null
  private errorMessage: string | null = null

  // Timeline data
  private entries: TimelineEntry[] = []
  private animationProgress: number = 0
  private timelineStart: number = 0
  private timelineEnd: number = 1000

  // Animation
  private ticker: Ticker
  private animationSpeed: number = 0.02
  private pulsePhase: number = 0

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  // Layout
  private readonly PADDING = 40
  private readonly HEADER_HEIGHT = 80
  private readonly ROW_HEIGHT = 50
  private readonly URL_COLUMN_WIDTH = 250
  private readonly TIME_COLUMN_WIDTH = 80

  // Phase colors (HAR standard colors)
  private readonly PHASE_COLORS = {
    blocked: 0xa8a8a8,
    dns: 0x5faf5f,
    connect: 0xffaf00,
    ssl: 0xafafaf,
    send: 0x5f87af,
    wait: 0x5fafaf,
    receive: 0x5f87ff,
  }

  constructor(options: PresentationModeOptions) {
    super()
    this.options = options

    // Create graphics layers
    this.backgroundGraphics = new Graphics()
    this.addChild(this.backgroundGraphics)

    this.timelineGraphics = new Graphics()
    this.addChild(this.timelineGraphics)

    this.markersGraphics = new Graphics()
    this.addChild(this.markersGraphics)

    this.barsGraphics = new Graphics()
    this.addChild(this.barsGraphics)

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
    this.drawTimeline()
    this.drawEntries()
    this.drawLegend()
  }

  private drawBackground() {
    const { width, height, bgColor, primaryColor } = this.options
    
    this.backgroundGraphics.clear()
    
    // Main background
    this.backgroundGraphics.rect(0, 0, width, height)
    this.backgroundGraphics.fill({ color: bgColor, alpha: 0.95 })

    // Header area
    this.backgroundGraphics.rect(0, 0, width, this.HEADER_HEIGHT)
    this.backgroundGraphics.fill({ color: primaryColor, alpha: 0.05 })

    // Column divider
    this.backgroundGraphics.moveTo(this.URL_COLUMN_WIDTH, this.HEADER_HEIGHT)
    this.backgroundGraphics.lineTo(this.URL_COLUMN_WIDTH, height)
    this.backgroundGraphics.stroke({ color: primaryColor, alpha: 0.1, width: 1 })

    // Subtle grid
    const timelineX = this.URL_COLUMN_WIDTH + this.TIME_COLUMN_WIDTH
    const timelineWidth = width - timelineX - this.PADDING
    const gridStep = timelineWidth / 10

    for (let i = 0; i <= 10; i++) {
      const x = timelineX + i * gridStep
      this.backgroundGraphics.moveTo(x, this.HEADER_HEIGHT)
      this.backgroundGraphics.lineTo(x, height)
      this.backgroundGraphics.stroke({ color: primaryColor, alpha: 0.05, width: 1 })
    }
  }

  private drawTimeline() {
    const { width, primaryColor, textColor } = this.options
    
    this.timelineGraphics.clear()

    // Column headers
    const headerStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 11,
      fill: textColor,
      fontWeight: 'bold',
    })

    // URL column header
    const urlHeader = new Text({ text: 'URL', style: headerStyle })
    urlHeader.x = this.PADDING
    urlHeader.y = 30
    this.labelsContainer.addChild(urlHeader)

    // Time column header
    const timeHeader = new Text({ text: 'Time', style: headerStyle })
    timeHeader.x = this.URL_COLUMN_WIDTH + 10
    timeHeader.y = 30
    this.labelsContainer.addChild(timeHeader)

    // Waterfall column header
    const waterfallHeader = new Text({ text: 'Waterfall', style: headerStyle })
    waterfallHeader.x = this.URL_COLUMN_WIDTH + this.TIME_COLUMN_WIDTH + 10
    waterfallHeader.y = 30
    this.labelsContainer.addChild(waterfallHeader)

    // Time scale
    const timelineX = this.URL_COLUMN_WIDTH + this.TIME_COLUMN_WIDTH
    const timelineWidth = width - timelineX - this.PADDING
    const duration = this.timelineEnd - this.timelineStart

    const scaleStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 9,
      fill: 0x888888,
    })

    const intervals = this.calculateTimeIntervals(duration)
    for (const time of intervals) {
      const x = timelineX + (time / duration) * timelineWidth
      
      // Tick mark
      this.timelineGraphics.moveTo(x, this.HEADER_HEIGHT - 10)
      this.timelineGraphics.lineTo(x, this.HEADER_HEIGHT)
      this.timelineGraphics.stroke({ color: primaryColor, alpha: 0.3, width: 1 })

      // Time label
      const label = new Text({ text: this.formatTime(time), style: scaleStyle })
      label.anchor.set(0.5, 0)
      label.x = x
      label.y = this.HEADER_HEIGHT - 25
      this.labelsContainer.addChild(label)
    }

    // Timeline baseline
    this.timelineGraphics.moveTo(timelineX, this.HEADER_HEIGHT)
    this.timelineGraphics.lineTo(width - this.PADDING, this.HEADER_HEIGHT)
    this.timelineGraphics.stroke({ color: primaryColor, alpha: 0.5, width: 2 })
  }

  private drawEntries() {
    const { width, height, primaryColor, textColor, errorColor } = this.options
    
    this.barsGraphics.clear()

    if (this.state === 'idle') {
      const placeholderStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 16,
        fill: textColor,
        align: 'center',
      })
      const placeholder = new Text({ 
        text: 'Select a request to view HAR timeline', 
        style: placeholderStyle 
      })
      placeholder.anchor.set(0.5)
      placeholder.x = width / 2
      placeholder.y = height / 2
      this.labelsContainer.addChild(placeholder)
      return
    }

    const timelineX = this.URL_COLUMN_WIDTH + this.TIME_COLUMN_WIDTH
    const timelineWidth = width - timelineX - this.PADDING
    const duration = this.timelineEnd - this.timelineStart

    this.entries.forEach((entry, index) => {
      const rowY = this.HEADER_HEIGHT + 10 + index * this.ROW_HEIGHT

      // Row background on hover effect
      if (index % 2 === 0) {
        this.barsGraphics.rect(0, rowY, width, this.ROW_HEIGHT)
        this.barsGraphics.fill({ color: primaryColor, alpha: 0.02 })
      }

      // URL (truncated)
      const urlStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 11,
        fill: textColor,
      })
      const truncatedUrl = this.truncateUrl(entry.url, 35)
      const urlText = new Text({ text: truncatedUrl, style: urlStyle })
      urlText.x = this.PADDING
      urlText.y = rowY + 15
      this.labelsContainer.addChild(urlText)

      // Method badge
      const methodColor = this.getMethodColor(entry.method)
      const methodStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 9,
        fill: methodColor,
        fontWeight: 'bold',
      })
      const methodText = new Text({ text: entry.method, style: methodStyle })
      methodText.x = this.PADDING
      methodText.y = rowY + 32
      this.labelsContainer.addChild(methodText)

      // Status badge (when complete)
      if (entry.status > 0) {
        const statusColor = entry.status >= 400 ? errorColor : 0x27ca40
        const statusStyle = new TextStyle({
          fontFamily: 'Fira Code, monospace',
          fontSize: 9,
          fill: statusColor,
        })
        const statusText = new Text({ text: `${entry.status}`, style: statusStyle })
        statusText.x = this.PADDING + 50
        statusText.y = rowY + 32
        this.labelsContainer.addChild(statusText)
      }

      // Time column
      const timeStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 11,
        fill: textColor,
      })
      const timeText = new Text({ 
        text: this.formatTime(entry.duration), 
        style: timeStyle 
      })
      timeText.x = this.URL_COLUMN_WIDTH + 10
      timeText.y = rowY + 15
      this.labelsContainer.addChild(timeText)

      // Waterfall bar
      const barStartX = timelineX + (entry.startTime / duration) * timelineWidth
      const animatedDuration = entry.duration * this.animationProgress
      const barWidth = Math.max(2, (animatedDuration / duration) * timelineWidth)
      const barY = rowY + 12
      const barHeight = 24

      // Draw phase segments
      let phaseX = barStartX
      const phases = ['blocked', 'dns', 'connect', 'ssl', 'send', 'wait', 'receive'] as const
      
      for (const phaseName of phases) {
        const phaseDuration = entry.phases[phaseName]
        if (phaseDuration <= 0) continue

        const phaseWidth = (phaseDuration / entry.duration) * barWidth
        if (phaseWidth < 1) continue

        const phaseColor = this.PHASE_COLORS[phaseName]
        
        this.barsGraphics.rect(phaseX, barY, phaseWidth, barHeight)
        this.barsGraphics.fill({ color: phaseColor, alpha: 0.85 })

        phaseX += phaseWidth
      }

      // Bar border
      this.barsGraphics.rect(barStartX, barY, barWidth, barHeight)
      this.barsGraphics.stroke({ color: primaryColor, alpha: 0.3, width: 1 })

      // Animated glow during loading
      if (this.state === 'loading' && this.animationProgress < 1) {
        const glowX = barStartX + barWidth
        this.barsGraphics.circle(glowX, barY + barHeight / 2, 4)
        this.barsGraphics.fill({ color: primaryColor, alpha: 0.8 + Math.sin(this.pulsePhase) * 0.2 })
      }

      // Size indicator
      if (entry.size > 0) {
        const sizeStyle = new TextStyle({
          fontFamily: 'Fira Code, monospace',
          fontSize: 9,
          fill: 0x888888,
        })
        const sizeText = new Text({ 
          text: this.formatBytes(entry.size), 
          style: sizeStyle 
        })
        sizeText.x = this.URL_COLUMN_WIDTH + 10
        sizeText.y = rowY + 32
        this.labelsContainer.addChild(sizeText)
      }
    })

    // Error message
    if (this.state === 'error' && this.errorMessage) {
      const errorStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 12,
        fill: errorColor,
      })
      const errorText = new Text({ text: `Error: ${this.errorMessage}`, style: errorStyle })
      errorText.x = this.PADDING
      errorText.y = this.HEADER_HEIGHT + 10 + this.entries.length * this.ROW_HEIGHT + 20
      this.labelsContainer.addChild(errorText)
    }
  }

  private drawLegend() {
    const { height, textColor } = this.options

    if (this.state === 'idle') return

    const legendY = height - 35
    let legendX = this.PADDING

    const phases = [
      { name: 'Blocked', color: this.PHASE_COLORS.blocked },
      { name: 'DNS', color: this.PHASE_COLORS.dns },
      { name: 'Connect', color: this.PHASE_COLORS.connect },
      { name: 'SSL', color: this.PHASE_COLORS.ssl },
      { name: 'Send', color: this.PHASE_COLORS.send },
      { name: 'Wait', color: this.PHASE_COLORS.wait },
      { name: 'Receive', color: this.PHASE_COLORS.receive },
    ]

    const labelStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 9,
      fill: textColor,
    })

    for (const phase of phases) {
      // Color box
      this.markersGraphics.rect(legendX, legendY, 12, 12)
      this.markersGraphics.fill({ color: phase.color, alpha: 0.85 })

      // Label
      const label = new Text({ text: phase.name, style: labelStyle })
      label.x = legendX + 16
      label.y = legendY + 1
      this.labelsContainer.addChild(label)

      legendX += 70
    }
  }

  private update() {
    let needsRedraw = false
    
    // Update animation
    if (this.state === 'loading' && this.animationProgress < 1) {
      this.animationProgress = Math.min(1, this.animationProgress + this.animationSpeed)
      this.pulsePhase += 0.15
      needsRedraw = true
    }

    if (needsRedraw) {
      this.labelsContainer.removeChildren()
      this.markersGraphics.clear()
      this.draw()
    }
  }

  private generateEntry() {
    if (!this.currentRequest) {
      this.entries = []
      return
    }

    const url = resolveVariables(this.currentRequest.url, this.resolvedVariables)
    const method = this.currentRequest.method

    // Generate simulated timing phases
    const blocked = Math.random() * 20
    const dns = Math.random() * 30 + 10
    const connect = Math.random() * 40 + 20
    const ssl = url.startsWith('https') ? Math.random() * 50 + 30 : 0
    const send = Math.random() * 10 + 5
    const wait = Math.random() * 150 + 50
    const receive = Math.random() * 100 + 20

    const duration = blocked + dns + connect + ssl + send + wait + receive

    this.entries = [{
      url,
      method,
      status: 0,
      statusText: '',
      startTime: 0,
      duration,
      size: 0,
      phases: { blocked, dns, connect, ssl, send, wait, receive },
    }]

    this.timelineEnd = duration * 1.2
  }

  private calculateTimeIntervals(maxTime: number): number[] {
    const intervals: number[] = []
    let step = 100

    if (maxTime <= 100) step = 20
    else if (maxTime <= 500) step = 100
    else if (maxTime <= 1000) step = 200
    else if (maxTime <= 5000) step = 1000
    else step = 2000

    for (let t = 0; t <= maxTime; t += step) {
      intervals.push(t)
    }

    return intervals
  }

  private formatTime(ms: number): string {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  private getMethodColor(method: string): number {
    const colors: Record<string, number> = {
      GET: 0x61affe,
      POST: 0x49cc90,
      PUT: 0xfca130,
      DELETE: 0xf93e3e,
      PATCH: 0x50e3c2,
      HEAD: 0x9012fe,
      OPTIONS: 0x0d5aa7,
    }
    return colors[method] || this.options.primaryColor
  }

  private truncateUrl(url: string, maxLength: number): string {
    if (url.length <= maxLength) return url
    try {
      const parsed = new URL(url)
      const path = parsed.pathname + parsed.search
      if (path.length > maxLength - 3) {
        return '...' + path.slice(-(maxLength - 3))
      }
      return parsed.host.slice(0, 15) + path
    } catch {
      return url.slice(0, maxLength - 3) + '...'
    }
  }

  // IPresentationMode implementation

  public setRequest(request: ParsedRequest | null, variables: Record<string, string> = {}) {
    this.currentRequest = request
    this.resolvedVariables = variables
    this.responseData = null
    this.errorMessage = null
    this.animationProgress = 0

    if (!request) {
      this.state = 'idle'
      this.entries = []
    } else {
      this.state = 'selected'
      this.generateEntry()
      this.animationProgress = 1 // Show full bar when selected
    }

    this.labelsContainer.removeChildren()
    this.markersGraphics.clear()
    this.draw()
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    switch (phase) {
      case 'idle':
        this.state = this.currentRequest ? 'selected' : 'idle'
        this.animationProgress = 1
        this.responseData = null
        this.errorMessage = null
        break

      case 'authenticating':
      case 'fetching':
        this.state = 'loading'
        this.animationProgress = 0
        this.generateEntry()
        break

      case 'success':
        this.state = 'complete'
        this.animationProgress = 1
        break

      case 'error':
        this.state = 'error'
        this.animationProgress = 1
        break
    }

    this.labelsContainer.removeChildren()
    this.markersGraphics.clear()
    this.draw()
  }

  public setResponse(status: number, statusText: string, size: number, duration: number) {
    this.responseData = { status, statusText, size, duration }

    // Update entry with real data
    if (this.entries.length > 0) {
      this.entries[0].status = status
      this.entries[0].statusText = statusText
      this.entries[0].size = size
      this.entries[0].duration = duration
      this.timelineEnd = duration * 1.2

      // Redistribute phase times based on actual duration
      const ratio = duration / (this.entries[0].phases.blocked + this.entries[0].phases.dns + 
        this.entries[0].phases.connect + this.entries[0].phases.ssl + 
        this.entries[0].phases.send + this.entries[0].phases.wait + this.entries[0].phases.receive)
      
      Object.keys(this.entries[0].phases).forEach(key => {
        this.entries[0].phases[key as keyof typeof this.entries[0]['phases']] *= ratio
      })
    }

    this.labelsContainer.removeChildren()
    this.markersGraphics.clear()
    this.draw()
  }

  public setError(message: string) {
    this.errorMessage = message
    this.labelsContainer.removeChildren()
    this.markersGraphics.clear()
    this.draw()
  }

  public resize(width: number, height: number) {
    this.options.width = width
    this.options.height = height
    this.labelsContainer.removeChildren()
    this.markersGraphics.clear()
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
    this.labelsContainer.removeChildren()
    this.markersGraphics.clear()
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
    this.timelineGraphics.destroy()
    this.barsGraphics.destroy()
    this.markersGraphics.destroy()
    this.labelsContainer.destroy()
    super.destroy()
  }
}

