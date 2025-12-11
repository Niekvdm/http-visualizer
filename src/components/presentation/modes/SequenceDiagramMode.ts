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
 * Sequence Diagram Mode - UML-style request/response timeline visualization
 * 
 * Shows:
 * - Client lifeline on the left
 * - Server lifeline on the right
 * - Auth server lifeline (if auth is present)
 * - Animated arrows for requests/responses
 * - Message labels with timing info
 */

interface LifelineConfig {
  x: number
  label: string
  color: number
}

interface MessageArrow {
  fromX: number
  toX: number
  y: number
  label: string
  type: 'request' | 'response' | 'auth'
  progress: number
  isAnimating: boolean
  color: number
}

type SequenceState = 'idle' | 'selected' | 'authenticating' | 'fetching' | 'complete' | 'error'

export class SequenceDiagramMode extends Container implements IPresentationMode {
  private options: PresentationModeOptions
  private settings: PresentationModeSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }

  // Graphics layers
  private backgroundGraphics: Graphics
  private lifelinesGraphics: Graphics
  private arrowsGraphics: Graphics
  private labelsContainer: Container

  // Lifelines
  private clientLifeline: LifelineConfig | null = null
  private authLifeline: LifelineConfig | null = null
  private serverLifeline: LifelineConfig | null = null

  // Message arrows
  private arrows: MessageArrow[] = []

  // State
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private hasAuth: boolean = false
  private state: SequenceState = 'idle'
  private responseData: { status: number; statusText: string; size: number; duration: number } | null = null
  private errorMessage: string | null = null

  // Animation
  private ticker: Ticker
  private arrowAnimationSpeed: number = 0.02

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  // Layout constants
  private readonly LIFELINE_WIDTH = 100
  private readonly HEADER_HEIGHT = 60
  private readonly ARROW_SPACING = 80
  private readonly PADDING = 40

  constructor(options: PresentationModeOptions) {
    super()
    this.options = options

    // Create graphics layers
    this.backgroundGraphics = new Graphics()
    this.addChild(this.backgroundGraphics)

    this.lifelinesGraphics = new Graphics()
    this.addChild(this.lifelinesGraphics)

    this.arrowsGraphics = new Graphics()
    this.addChild(this.arrowsGraphics)

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
    this.drawLifelines()
    this.drawArrows()
  }

  private drawBackground() {
    const { width, height, bgColor } = this.options
    
    this.backgroundGraphics.clear()
    this.backgroundGraphics.rect(0, 0, width, height)
    this.backgroundGraphics.fill({ color: bgColor, alpha: 0.95 })

    // Draw subtle grid pattern
    const gridSize = 20
    for (let x = 0; x < width; x += gridSize) {
      this.backgroundGraphics.moveTo(x, 0)
      this.backgroundGraphics.lineTo(x, height)
      this.backgroundGraphics.stroke({ color: this.options.primaryColor, alpha: 0.03, width: 1 })
    }
    for (let y = 0; y < height; y += gridSize) {
      this.backgroundGraphics.moveTo(0, y)
      this.backgroundGraphics.lineTo(width, y)
      this.backgroundGraphics.stroke({ color: this.options.primaryColor, alpha: 0.03, width: 1 })
    }
  }

  private drawLifelines() {
    const { width, height, primaryColor, secondaryColor, textColor } = this.options
    
    this.lifelinesGraphics.clear()
    
    // Clear existing labels
    this.labelsContainer.removeChildren()

    if (this.state === 'idle') {
      // Show placeholder message
      const style = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 16,
        fill: textColor,
        align: 'center',
      })
      const text = new Text({ text: 'Select a request to view sequence diagram', style })
      text.anchor.set(0.5)
      text.x = width / 2
      text.y = height / 2
      this.labelsContainer.addChild(text)
      return
    }

    // Calculate lifeline positions
    const lifelineCount = this.hasAuth ? 3 : 2
    const totalWidth = width - this.PADDING * 2
    const spacing = totalWidth / (lifelineCount + 1)

    // Client lifeline (always leftmost)
    this.clientLifeline = {
      x: this.PADDING + spacing,
      label: 'CLIENT',
      color: primaryColor,
    }

    // Auth lifeline (middle, if present)
    if (this.hasAuth) {
      this.authLifeline = {
        x: this.PADDING + spacing * 2,
        label: 'AUTH',
        color: secondaryColor,
      }
    } else {
      this.authLifeline = null
    }

    // Server lifeline (rightmost)
    this.serverLifeline = {
      x: this.hasAuth ? this.PADDING + spacing * 3 : this.PADDING + spacing * 2,
      label: 'SERVER',
      color: primaryColor,
    }

    // Draw each lifeline
    const lifelines = [this.clientLifeline, this.authLifeline, this.serverLifeline].filter(Boolean) as LifelineConfig[]
    
    for (const lifeline of lifelines) {
      // Draw header box
      const boxWidth = this.LIFELINE_WIDTH
      const boxHeight = 40
      const boxX = lifeline.x - boxWidth / 2
      const boxY = this.PADDING

      this.lifelinesGraphics.roundRect(boxX, boxY, boxWidth, boxHeight, 4)
      this.lifelinesGraphics.fill({ color: this.options.bgColor, alpha: 0.9 })
      this.lifelinesGraphics.stroke({ color: lifeline.color, width: 2, alpha: 0.8 })

      // Draw label
      const labelStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 12,
        fill: lifeline.color,
        fontWeight: 'bold',
      })
      const label = new Text({ text: lifeline.label, style: labelStyle })
      label.anchor.set(0.5)
      label.x = lifeline.x
      label.y = boxY + boxHeight / 2
      this.labelsContainer.addChild(label)

      // Draw dashed lifeline
      const lineStartY = boxY + boxHeight
      const lineEndY = height - this.PADDING
      const dashLength = 8
      const gapLength = 4

      let currentY = lineStartY
      while (currentY < lineEndY) {
        const dashEnd = Math.min(currentY + dashLength, lineEndY)
        this.lifelinesGraphics.moveTo(lifeline.x, currentY)
        this.lifelinesGraphics.lineTo(lifeline.x, dashEnd)
        this.lifelinesGraphics.stroke({ color: lifeline.color, width: 2, alpha: 0.5 })
        currentY += dashLength + gapLength
      }
    }
  }

  private drawArrows() {
    const { primaryColor, secondaryColor, errorColor, textColor } = this.options
    
    this.arrowsGraphics.clear()

    for (const arrow of this.arrows) {
      if (arrow.progress <= 0) continue

      const direction = arrow.toX > arrow.fromX ? 1 : -1
      const totalLength = Math.abs(arrow.toX - arrow.fromX)
      const currentLength = totalLength * arrow.progress
      const currentEndX = arrow.fromX + direction * currentLength

      // Determine arrow color
      let arrowColor = arrow.color
      if (this.state === 'error' && arrow.type === 'response') {
        arrowColor = errorColor
      }

      // Draw arrow line
      this.arrowsGraphics.moveTo(arrow.fromX, arrow.y)
      this.arrowsGraphics.lineTo(currentEndX, arrow.y)
      this.arrowsGraphics.stroke({ color: arrowColor, width: 2, alpha: 0.9 })

      // Draw arrowhead if complete
      if (arrow.progress >= 1) {
        const arrowSize = 8
        this.arrowsGraphics.moveTo(arrow.toX, arrow.y)
        this.arrowsGraphics.lineTo(arrow.toX - direction * arrowSize, arrow.y - arrowSize / 2)
        this.arrowsGraphics.lineTo(arrow.toX - direction * arrowSize, arrow.y + arrowSize / 2)
        this.arrowsGraphics.closePath()
        this.arrowsGraphics.fill({ color: arrowColor, alpha: 0.9 })
      }

      // Draw glow at arrow tip during animation
      if (arrow.isAnimating && arrow.progress > 0 && arrow.progress < 1) {
        this.arrowsGraphics.circle(currentEndX, arrow.y, 4)
        this.arrowsGraphics.fill({ color: arrowColor, alpha: 1 })
        this.arrowsGraphics.circle(currentEndX, arrow.y, 8)
        this.arrowsGraphics.fill({ color: arrowColor, alpha: 0.3 })
      }

      // Draw label above arrow
      if (arrow.label && arrow.progress > 0.5) {
        const labelStyle = new TextStyle({
          fontFamily: 'Fira Code, monospace',
          fontSize: 10,
          fill: textColor,
        })
        const labelText = new Text({ text: arrow.label, style: labelStyle })
        labelText.anchor.set(0.5)
        labelText.x = (arrow.fromX + arrow.toX) / 2
        labelText.y = arrow.y - 12
        labelText.alpha = Math.min(1, (arrow.progress - 0.5) * 4)
        this.labelsContainer.addChild(labelText)
      }
    }
  }

  private update() {
    let needsRedraw = false

    // Animate arrows
    for (const arrow of this.arrows) {
      if (arrow.isAnimating && arrow.progress < 1) {
        arrow.progress = Math.min(1, arrow.progress + this.arrowAnimationSpeed)
        needsRedraw = true
        
        if (arrow.progress >= 1) {
          arrow.isAnimating = false
        }
      }
    }

    if (needsRedraw) {
      // Clear and redraw labels for arrow labels
      this.labelsContainer.removeChildren()
      this.drawLifelines()
      this.drawArrows()
    }
  }

  private createArrow(
    fromLifeline: LifelineConfig,
    toLifeline: LifelineConfig,
    label: string,
    type: 'request' | 'response' | 'auth',
    animate: boolean = true
  ): MessageArrow {
    const baseY = this.HEADER_HEIGHT + this.PADDING + 40
    const y = baseY + this.arrows.length * this.ARROW_SPACING

    const arrow: MessageArrow = {
      fromX: fromLifeline.x,
      toX: toLifeline.x,
      y,
      label,
      type,
      progress: animate ? 0 : 1,
      isAnimating: animate,
      color: type === 'auth' ? this.options.secondaryColor : this.options.primaryColor,
    }

    this.arrows.push(arrow)
    return arrow
  }

  private clearArrows() {
    this.arrows = []
  }

  // IPresentationMode implementation

  public setRequest(request: ParsedRequest | null, variables: Record<string, string> = {}) {
    this.currentRequest = request
    this.resolvedVariables = variables
    this.hasAuth = request?.auth?.type !== undefined && request.auth.type !== 'none'
    this.responseData = null
    this.errorMessage = null
    this.clearArrows()

    if (!request) {
      this.state = 'idle'
    } else {
      this.state = 'selected'
    }

    this.draw()
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    const { primaryColor, secondaryColor } = this.options

    switch (phase) {
      case 'idle':
        this.state = this.currentRequest ? 'selected' : 'idle'
        this.clearArrows()
        this.responseData = null
        this.errorMessage = null
        break

      case 'authenticating':
        this.state = 'authenticating'
        this.clearArrows()
        if (this.clientLifeline && this.authLifeline) {
          this.createArrow(this.clientLifeline, this.authLifeline, 'AUTH REQUEST', 'auth')
        }
        break

      case 'fetching':
        this.state = 'fetching'
        // Add auth response if we were authenticating
        if (this.hasAuth && this.authLifeline && this.clientLifeline) {
          // Check if auth response already exists
          const hasAuthResponse = this.arrows.some(a => a.type === 'auth' && a.toX < a.fromX)
          if (!hasAuthResponse) {
            this.createArrow(this.authLifeline, this.clientLifeline, 'TOKEN', 'auth')
          }
        }
        // Add request arrow
        if (this.clientLifeline && this.serverLifeline) {
          const method = this.currentRequest?.method || 'GET'
          const url = this.truncateUrl(resolveVariables(this.currentRequest?.url || '', this.resolvedVariables), 30)
          this.createArrow(this.clientLifeline, this.serverLifeline, `${method} ${url}`, 'request')
        }
        break

      case 'success':
        this.state = 'complete'
        break

      case 'error':
        this.state = 'error'
        break
    }

    this.draw()
  }

  public setResponse(status: number, statusText: string, size: number, duration: number) {
    this.responseData = { status, statusText, size, duration }
    
    // Add response arrow
    if (this.serverLifeline && this.clientLifeline) {
      const label = `${status} ${statusText} (${duration.toFixed(0)}ms)`
      const arrow = this.createArrow(this.serverLifeline, this.clientLifeline, label, 'response')
      
      // Color based on status
      if (status >= 400) {
        arrow.color = this.options.errorColor
      } else if (status >= 200 && status < 300) {
        arrow.color = 0x27ca40 // Success green
      }
    }

    this.draw()
  }

  public setError(message: string) {
    this.errorMessage = message
    
    // Add error response arrow
    if (this.serverLifeline && this.clientLifeline) {
      const truncatedMsg = message.length > 40 ? message.slice(0, 37) + '...' : message
      const arrow = this.createArrow(this.serverLifeline, this.clientLifeline, `ERROR: ${truncatedMsg}`, 'response')
      arrow.color = this.options.errorColor
    }

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

  private truncateUrl(url: string, maxLength: number): string {
    if (url.length <= maxLength) return url
    try {
      const parsed = new URL(url)
      const path = parsed.pathname
      if (path.length > maxLength - 3) {
        return path.slice(0, maxLength - 3) + '...'
      }
      return path
    } catch {
      return url.slice(0, maxLength - 3) + '...'
    }
  }

  public destroy() {
    this.ticker.stop()
    this.ticker.destroy()
    this.backgroundGraphics.destroy()
    this.lifelinesGraphics.destroy()
    this.arrowsGraphics.destroy()
    this.labelsContainer.destroy()
    super.destroy()
  }
}

