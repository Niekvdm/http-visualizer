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
 * Waterfall Mode - Chrome DevTools-style timing waterfall visualization
 * 
 * Shows horizontal timing bars for each request phase:
 * - Blocked/Queued (gray)
 * - DNS Lookup (teal)
 * - TCP Connection (orange)
 * - TLS Handshake (purple)
 * - Request/TTFB (green)
 * - Content Download (blue)
 */

interface TimingPhase {
  name: string
  color: number
  startPercent: number
  endPercent: number
  duration: number
  label: string
}

type WaterfallState = 'idle' | 'selected' | 'executing' | 'complete' | 'error'

export class WaterfallMode extends Container implements IPresentationMode {
  private options: PresentationModeOptions
  private settings: PresentationModeSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }

  // Graphics layers
  private backgroundGraphics: Graphics
  private gridGraphics: Graphics
  private barsGraphics: Graphics
  private labelsContainer: Container
  private glowGraphics: Graphics

  // State
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private state: WaterfallState = 'idle'
  private responseData: { status: number; statusText: string; size: number; duration: number } | null = null
  private errorMessage: string | null = null

  // Timing phases
  private phases: TimingPhase[] = []
  private animationProgress: number = 0
  private totalDuration: number = 0

  // Animation
  private ticker: Ticker
  private animationSpeed: number = 0.015
  private pulsePhase: number = 0

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  // Layout constants
  private readonly PADDING = 40
  private readonly BAR_HEIGHT = 32
  private readonly LABEL_WIDTH = 120
  private readonly TIME_SCALE_HEIGHT = 40

  // Phase colors (Chrome DevTools inspired)
  private readonly PHASE_COLORS = {
    blocked: 0x808080,    // Gray
    dns: 0x00bcd4,        // Teal
    tcp: 0xff9800,        // Orange
    tls: 0x9c27b0,        // Purple
    ttfb: 0x4caf50,       // Green
    download: 0x2196f3,   // Blue
  }

  constructor(options: PresentationModeOptions) {
    super()
    this.options = options

    // Create graphics layers
    this.backgroundGraphics = new Graphics()
    this.addChild(this.backgroundGraphics)

    this.gridGraphics = new Graphics()
    this.addChild(this.gridGraphics)

    this.glowGraphics = new Graphics()
    this.addChild(this.glowGraphics)

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
    this.drawGrid()
    this.drawBars()
    this.drawLabels()
  }

  private drawBackground() {
    const { width, height, bgColor, primaryColor } = this.options
    
    this.backgroundGraphics.clear()
    
    // Main background
    this.backgroundGraphics.rect(0, 0, width, height)
    this.backgroundGraphics.fill({ color: bgColor, alpha: 0.95 })

    // Subtle scanline effect
    for (let y = 0; y < height; y += 2) {
      this.backgroundGraphics.rect(0, y, width, 1)
      this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.03 })
    }

    // Header area
    this.backgroundGraphics.rect(0, 0, width, 60)
    this.backgroundGraphics.fill({ color: primaryColor, alpha: 0.05 })
    
    // Header line
    this.backgroundGraphics.moveTo(0, 60)
    this.backgroundGraphics.lineTo(width, 60)
    this.backgroundGraphics.stroke({ color: primaryColor, alpha: 0.3, width: 1 })
  }

  private drawGrid() {
    const { width, height, primaryColor, textColor } = this.options
    
    this.gridGraphics.clear()

    if (this.state === 'idle') return

    const barAreaX = this.PADDING + this.LABEL_WIDTH
    const barAreaWidth = width - barAreaX - this.PADDING
    const barAreaY = 80

    // Time scale markers
    const maxTime = this.totalDuration > 0 ? this.totalDuration : 1000
    const intervals = this.calculateTimeIntervals(maxTime)

    for (const time of intervals) {
      const x = barAreaX + (time / maxTime) * barAreaWidth
      
      // Vertical grid line
      this.gridGraphics.moveTo(x, barAreaY)
      this.gridGraphics.lineTo(x, height - this.PADDING)
      this.gridGraphics.stroke({ color: primaryColor, alpha: 0.1, width: 1 })

      // Time label
      const labelStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 10,
        fill: textColor,
      })
      const label = new Text({ text: this.formatTime(time), style: labelStyle })
      label.alpha = 0.6
      label.anchor.set(0.5, 0)
      label.x = x
      label.y = barAreaY - 20
      this.labelsContainer.addChild(label)
    }
  }

  private drawBars() {
    const { width, height, primaryColor, errorColor, textColor } = this.options
    
    this.barsGraphics.clear()
    this.glowGraphics.clear()

    if (this.state === 'idle') {
      // Show placeholder message
      const style = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 16,
        fill: textColor,
        align: 'center',
      })
      const text = new Text({ text: 'Select a request to view timing waterfall', style })
      text.anchor.set(0.5)
      text.x = width / 2
      text.y = height / 2
      this.labelsContainer.addChild(text)
      return
    }

    const barAreaX = this.PADDING + this.LABEL_WIDTH
    const barAreaWidth = width - barAreaX - this.PADDING
    const barY = 120

    // Draw request info
    if (this.currentRequest) {
      const method = this.currentRequest.method
      const url = resolveVariables(this.currentRequest.url, this.resolvedVariables)
      const truncatedUrl = this.truncateUrl(url, 60)

      const methodStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 14,
        fill: this.getMethodColor(method),
        fontWeight: 'bold',
      })
      const methodText = new Text({ text: method, style: methodStyle })
      methodText.x = this.PADDING
      methodText.y = 25
      this.labelsContainer.addChild(methodText)

      const urlStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 12,
        fill: textColor,
      })
      const urlText = new Text({ text: truncatedUrl, style: urlStyle })
      urlText.x = this.PADDING + 60
      urlText.y = 27
      this.labelsContainer.addChild(urlText)
    }

    // Draw timing phases
    if (this.phases.length > 0) {
      const maxTime = this.totalDuration > 0 ? this.totalDuration : 1000

      for (let i = 0; i < this.phases.length; i++) {
        const phase = this.phases[i]
        const phaseY = barY + i * (this.BAR_HEIGHT + 12)
        
        // Calculate bar position based on animation
        const phaseProgress = Math.min(1, Math.max(0, 
          (this.animationProgress - phase.startPercent) / (phase.endPercent - phase.startPercent)
        ))

        if (phaseProgress <= 0) continue

        const barX = barAreaX + (phase.startPercent * barAreaWidth)
        const barWidth = (phase.endPercent - phase.startPercent) * barAreaWidth * phaseProgress

        // Phase label
        const labelStyle = new TextStyle({
          fontFamily: 'Fira Code, monospace',
          fontSize: 11,
          fill: textColor,
        })
        const label = new Text({ text: phase.name, style: labelStyle })
        label.anchor.set(1, 0.5)
        label.x = barAreaX - 10
        label.y = phaseY + this.BAR_HEIGHT / 2
        this.labelsContainer.addChild(label)

        // Glow effect during animation
        if (this.state === 'executing' && phaseProgress < 1) {
          this.glowGraphics.roundRect(barX - 2, phaseY - 2, barWidth + 4, this.BAR_HEIGHT + 4, 4)
          this.glowGraphics.fill({ color: phase.color, alpha: 0.2 + Math.sin(this.pulsePhase) * 0.1 })
        }

        // Bar background (track)
        const fullBarWidth = (phase.endPercent - phase.startPercent) * barAreaWidth
        this.barsGraphics.roundRect(barX, phaseY, fullBarWidth, this.BAR_HEIGHT, 4)
        this.barsGraphics.fill({ color: phase.color, alpha: 0.1 })
        this.barsGraphics.stroke({ color: phase.color, alpha: 0.3, width: 1 })

        // Bar fill
        if (barWidth > 0) {
          this.barsGraphics.roundRect(barX, phaseY, barWidth, this.BAR_HEIGHT, 4)
          this.barsGraphics.fill({ color: phase.color, alpha: 0.8 })

          // Striped pattern for active bar
          if (this.state === 'executing' && phaseProgress < 1) {
            const stripeWidth = 8
            for (let sx = barX; sx < barX + barWidth; sx += stripeWidth * 2) {
              const sw = Math.min(stripeWidth, barX + barWidth - sx)
              this.barsGraphics.rect(sx, phaseY, sw, this.BAR_HEIGHT)
              this.barsGraphics.fill({ color: 0xffffff, alpha: 0.1 })
            }
          }
        }

        // Duration label
        if (phaseProgress >= 1 && phase.duration > 0) {
          const durationStyle = new TextStyle({
            fontFamily: 'Fira Code, monospace',
            fontSize: 10,
            fill: 0xffffff,
            fontWeight: 'bold',
          })
          const durationText = new Text({ text: `${phase.duration.toFixed(0)}ms`, style: durationStyle })
          durationText.anchor.set(0.5, 0.5)
          durationText.x = barX + fullBarWidth / 2
          durationText.y = phaseY + this.BAR_HEIGHT / 2
          this.labelsContainer.addChild(durationText)
        }
      }
    }

    // Draw total time
    if (this.state === 'complete' && this.responseData) {
      const totalY = barY + this.phases.length * (this.BAR_HEIGHT + 12) + 20

      const totalStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 18,
        fill: primaryColor,
        fontWeight: 'bold',
      })
      const totalText = new Text({ 
        text: `Total: ${this.responseData.duration.toFixed(0)}ms`, 
        style: totalStyle 
      })
      totalText.x = barAreaX
      totalText.y = totalY
      this.labelsContainer.addChild(totalText)

      // Status badge
      const statusColor = this.responseData.status >= 400 ? errorColor : 0x27ca40
      const statusStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 14,
        fill: statusColor,
        fontWeight: 'bold',
      })
      const statusText = new Text({ 
        text: `${this.responseData.status} ${this.responseData.statusText}`, 
        style: statusStyle 
      })
      statusText.x = barAreaX + 200
      statusText.y = totalY + 2
      this.labelsContainer.addChild(statusText)

      // Size
      const sizeStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 12,
        fill: textColor,
      })
      const sizeText = new Text({ 
        text: this.formatBytes(this.responseData.size), 
        style: sizeStyle 
      })
      sizeText.x = barAreaX + 400
      sizeText.y = totalY + 3
      this.labelsContainer.addChild(sizeText)
    }

    // Error state
    if (this.state === 'error' && this.errorMessage) {
      const errorY = barY + this.phases.length * (this.BAR_HEIGHT + 12) + 20

      const errorStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 14,
        fill: errorColor,
      })
      const errorText = new Text({ text: `Error: ${this.errorMessage}`, style: errorStyle })
      errorText.x = barAreaX
      errorText.y = errorY
      this.labelsContainer.addChild(errorText)
    }
  }

  private drawLabels() {
    // Labels are drawn in drawBars for this mode
  }

  private update() {
    let needsRedraw = false

    // Update animation
    if (this.state === 'executing' && this.animationProgress < 1) {
      this.animationProgress = Math.min(1, this.animationProgress + this.animationSpeed)
      this.pulsePhase += 0.1
      needsRedraw = true
    }

    if (needsRedraw) {
      this.labelsContainer.removeChildren()
      this.draw()
    }
  }

  private generateTimingPhases() {
    this.phases = []
    
    // Simulate timing phases with realistic proportions
    // These will be replaced with real data when available
    const hasAuth = this.currentRequest?.auth?.type && this.currentRequest.auth.type !== 'none'
    
    let currentPercent = 0

    // Blocked/Queued (small random delay)
    const blockedDuration = Math.random() * 20 + 5
    this.phases.push({
      name: 'Blocked',
      color: this.PHASE_COLORS.blocked,
      startPercent: currentPercent,
      endPercent: currentPercent + 0.05,
      duration: blockedDuration,
      label: 'Waiting in queue',
    })
    currentPercent += 0.05

    // DNS Lookup
    const dnsDuration = Math.random() * 30 + 10
    this.phases.push({
      name: 'DNS Lookup',
      color: this.PHASE_COLORS.dns,
      startPercent: currentPercent,
      endPercent: currentPercent + 0.1,
      duration: dnsDuration,
      label: 'Resolving hostname',
    })
    currentPercent += 0.1

    // TCP Connection
    const tcpDuration = Math.random() * 40 + 20
    this.phases.push({
      name: 'TCP',
      color: this.PHASE_COLORS.tcp,
      startPercent: currentPercent,
      endPercent: currentPercent + 0.15,
      duration: tcpDuration,
      label: 'Establishing connection',
    })
    currentPercent += 0.15

    // TLS Handshake (only for HTTPS)
    const url = this.currentRequest?.url || ''
    const isHttps = url.startsWith('https://') || !url.startsWith('http://')
    if (isHttps) {
      const tlsDuration = Math.random() * 50 + 30
      this.phases.push({
        name: 'TLS',
        color: this.PHASE_COLORS.tls,
        startPercent: currentPercent,
        endPercent: currentPercent + 0.15,
        duration: tlsDuration,
        label: 'SSL/TLS negotiation',
      })
      currentPercent += 0.15
    }

    // Time to First Byte (TTFB)
    const ttfbDuration = Math.random() * 100 + 50
    this.phases.push({
      name: 'TTFB',
      color: this.PHASE_COLORS.ttfb,
      startPercent: currentPercent,
      endPercent: currentPercent + 0.25,
      duration: ttfbDuration,
      label: 'Waiting for server',
    })
    currentPercent += 0.25

    // Content Download
    const remainingPercent = 1 - currentPercent
    const downloadDuration = Math.random() * 200 + 100
    this.phases.push({
      name: 'Download',
      color: this.PHASE_COLORS.download,
      startPercent: currentPercent,
      endPercent: 1,
      duration: downloadDuration,
      label: 'Receiving data',
    })

    // Calculate total
    this.totalDuration = this.phases.reduce((sum, p) => sum + p.duration, 0)
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
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024) return `${(bytes / 1024).toFixed(1)} KB`
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
    return url.slice(0, maxLength - 3) + '...'
  }

  // IPresentationMode implementation

  public setRequest(request: ParsedRequest | null, variables: Record<string, string> = {}) {
    this.currentRequest = request
    this.resolvedVariables = variables
    this.responseData = null
    this.errorMessage = null
    this.phases = []
    this.animationProgress = 0

    if (!request) {
      this.state = 'idle'
    } else {
      this.state = 'selected'
      this.generateTimingPhases()
    }

    this.labelsContainer.removeChildren()
    this.draw()
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    switch (phase) {
      case 'idle':
        this.state = this.currentRequest ? 'selected' : 'idle'
        this.animationProgress = 0
        this.responseData = null
        this.errorMessage = null
        break

      case 'authenticating':
      case 'fetching':
        this.state = 'executing'
        if (this.animationProgress === 0) {
          this.generateTimingPhases()
        }
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
    this.draw()
  }

  public setResponse(status: number, statusText: string, size: number, duration: number) {
    this.responseData = { status, statusText, size, duration }
    this.totalDuration = duration

    // Recalculate phase durations based on actual total
    if (this.phases.length > 0) {
      const ratio = duration / this.phases.reduce((sum, p) => sum + p.duration, 0)
      for (const phase of this.phases) {
        phase.duration *= ratio
      }
    }

    this.labelsContainer.removeChildren()
    this.draw()
  }

  public setError(message: string) {
    this.errorMessage = message
    this.labelsContainer.removeChildren()
    this.draw()
  }

  public resize(width: number, height: number) {
    this.options.width = width
    this.options.height = height
    this.labelsContainer.removeChildren()
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
    this.barsGraphics.destroy()
    this.glowGraphics.destroy()
    this.labelsContainer.destroy()
    super.destroy()
  }
}

