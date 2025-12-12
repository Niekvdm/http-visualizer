import { Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js'
import type { ExecutionPhase, ParsedRequest } from '@/types'
import type {
  IPresentationMode,
  PresentationModeOptions,
  PresentationModeSettings,
  PresentationModeEvent,
  ExtendedResponseData
} from './IPresentationMode'
import type { ResponseTiming, TlsInfo, SizeBreakdown, RedirectHop } from '@/types'
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
  waitingToStart: boolean  // True if arrow should wait for previous arrows to complete
  speedUp: boolean  // True if arrow should animate faster (phase completed early)
  color: number
}

interface ActivationBox {
  lifelineX: number
  startY: number
  endY: number
  color: number
  isActive: boolean
  type: 'auth' | 'fetch'
}

interface TimingBar {
  label: string
  duration: number
  color: number
  progress: number
}

// Chrome DevTools-style timing colors
const TIMING_COLORS = {
  dns: 0x7b7bb3,     // Purple/blue
  tcp: 0xf68d29,     // Orange
  tls: 0x9b59b6,     // Purple
  ttfb: 0x27ca40,    // Green
  download: 0x3498db, // Blue
  blocked: 0x95a5a6,  // Gray
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

  // Activation boxes
  private activationBoxes: ActivationBox[] = []
  private activationGraphics: Graphics | null = null

  // Animation time tracking
  private animationTime: number = 0
  private waitingDotsFrame: number = 0

  // State
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private hasAuth: boolean = false
  private state: SequenceState = 'idle'
  private responseData: { status: number; statusText: string; size: number; duration: number } | null = null
  private errorMessage: string | null = null

  // Extended response data
  private timingData: ResponseTiming | null = null
  private tlsInfo: TlsInfo | null = null
  private sizeBreakdown: SizeBreakdown | null = null
  private redirectChain: RedirectHop[] = []
  private timingBars: TimingBar[] = []
  private timingGraphics: Graphics | null = null

  // Error state effects
  private errorBurstGraphics: Graphics | null = null
  private errorShakeOffset: number = 0
  private errorBurstProgress: number = 0
  private isErrorAnimating: boolean = false
  private errorBurstPending: boolean = false  // Wait for error arrow to complete before bursting

  // Connection badges
  private badgesGraphics: Graphics | null = null

  // Interactive elements
  private hoveredElement: { type: 'arrow'; index: number } | null = null
  private wasHovering: boolean = false  // Track previous hover state for unhover detection
  private selectedElementIndex: number = 0
  private interactiveElements: { type: 'arrow'; bounds: { x: number; y: number; width: number; height: number } }[] = []
  private highlightGraphics: Graphics | null = null

  // Animation
  private ticker: Ticker
  private arrowAnimationSpeed: number = 0.02
  private arrowFastSpeed: number = 0.15  // Fast speed when phase completes early

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

    // Activation boxes layer (behind arrows)
    this.activationGraphics = new Graphics()
    this.addChild(this.activationGraphics)

    this.arrowsGraphics = new Graphics()
    this.addChild(this.arrowsGraphics)

    // Timing bars layer
    this.timingGraphics = new Graphics()
    this.addChild(this.timingGraphics)

    // Error burst effects layer (on top)
    this.errorBurstGraphics = new Graphics()
    this.addChild(this.errorBurstGraphics)

    // Connection badges layer
    this.badgesGraphics = new Graphics()
    this.addChild(this.badgesGraphics)

    // Highlight layer for hover/selection effects
    this.highlightGraphics = new Graphics()
    this.addChild(this.highlightGraphics)

    this.labelsContainer = new Container()
    this.addChild(this.labelsContainer)

    // Enable interactivity
    this.eventMode = 'static'
    this.on('pointermove', this.onPointerMove.bind(this))
    this.on('pointerdown', this.onPointerDown.bind(this))

    // Start animation ticker
    this.ticker = new Ticker()
    this.ticker.add(() => this.update())
    this.ticker.start()

    this.draw()
  }

  private draw() {
    this.drawBackground()
    this.drawLifelines()
    this.drawActivationBoxes()
    this.drawArrows()
    this.drawTimingBars()
    this.drawErrorEffects()
    this.drawConnectionBadges()
    this.drawHighlights()
    this.updateInteractiveElements()
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
      // Apply shake offset to server lifeline during error animation
      const isServerLifeline = lifeline === this.serverLifeline
      const shakeX = isServerLifeline && this.isErrorAnimating ? this.errorShakeOffset : 0

      // Draw header box
      const boxWidth = this.LIFELINE_WIDTH
      const boxHeight = 40
      const boxX = lifeline.x - boxWidth / 2 + shakeX
      const boxY = this.PADDING

      // Error glow effect on server lifeline
      if (isServerLifeline && this.state === 'error' && this.isErrorAnimating) {
        const glowAlpha = Math.max(0, 0.4 - this.errorBurstProgress * 0.3)
        this.lifelinesGraphics.roundRect(boxX - 4, boxY - 4, boxWidth + 8, boxHeight + 8, 6)
        this.lifelinesGraphics.fill({ color: this.options.errorColor, alpha: glowAlpha })
      }

      this.lifelinesGraphics.roundRect(boxX, boxY, boxWidth, boxHeight, 4)
      this.lifelinesGraphics.fill({ color: this.options.bgColor, alpha: 0.9 })

      // Error state border color
      const borderColor = isServerLifeline && this.state === 'error' ? this.options.errorColor : lifeline.color
      this.lifelinesGraphics.stroke({ color: borderColor, width: 2, alpha: 0.8 })

      // Draw label
      const labelStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 12,
        fill: isServerLifeline && this.state === 'error' ? this.options.errorColor : lifeline.color,
        fontWeight: 'bold',
      })
      const label = new Text({ text: lifeline.label, style: labelStyle })
      label.anchor.set(0.5)
      label.x = lifeline.x + shakeX
      label.y = boxY + boxHeight / 2
      this.labelsContainer.addChild(label)

      // Draw dashed lifeline
      const lineStartY = boxY + boxHeight
      const lineEndY = height - this.PADDING
      const dashLength = 8
      const gapLength = 4
      const lineColor = isServerLifeline && this.state === 'error' ? this.options.errorColor : lifeline.color

      let currentY = lineStartY
      while (currentY < lineEndY) {
        const dashEnd = Math.min(currentY + dashLength, lineEndY)
        this.lifelinesGraphics.moveTo(lifeline.x + shakeX, currentY)
        this.lifelinesGraphics.lineTo(lifeline.x + shakeX, dashEnd)
        this.lifelinesGraphics.stroke({ color: lineColor, width: 2, alpha: 0.5 })
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

  private drawActivationBoxes() {
    if (!this.activationGraphics) return
    this.activationGraphics.clear()

    // Only draw activation boxes during active states
    if (this.state !== 'authenticating' && this.state !== 'fetching') {
      return
    }

    const boxWidth = 16
    const pulseAlpha = 0.3 + 0.2 * Math.sin(this.animationTime * 4)
    const glowSize = 4 + 2 * Math.sin(this.animationTime * 3)

    for (const box of this.activationBoxes) {
      if (!box.isActive) continue

      const boxX = box.lifelineX - boxWidth / 2

      // Draw outer glow
      this.activationGraphics.roundRect(
        boxX - glowSize,
        box.startY - glowSize,
        boxWidth + glowSize * 2,
        box.endY - box.startY + glowSize * 2,
        4
      )
      this.activationGraphics.fill({ color: box.color, alpha: pulseAlpha * 0.3 })

      // Draw main activation box
      this.activationGraphics.roundRect(boxX, box.startY, boxWidth, box.endY - box.startY, 3)
      this.activationGraphics.fill({ color: this.options.bgColor, alpha: 0.95 })
      this.activationGraphics.stroke({ color: box.color, width: 2, alpha: 0.8 + pulseAlpha * 0.2 })

      // Draw inner highlight
      this.activationGraphics.roundRect(boxX + 2, box.startY + 2, boxWidth - 4, box.endY - box.startY - 4, 2)
      this.activationGraphics.fill({ color: box.color, alpha: pulseAlpha * 0.15 })

      // Draw waiting dots animation
      const dotsY = box.startY + (box.endY - box.startY) / 2
      const dotCount = 3
      const dotSpacing = 4
      const dotsStartX = box.lifelineX - ((dotCount - 1) * dotSpacing) / 2

      for (let i = 0; i < dotCount; i++) {
        // Each dot pulses at different times
        const dotPhase = (this.waitingDotsFrame + i) % 4
        const dotAlpha = dotPhase < 3 ? 0.4 + (dotPhase === i % 3 ? 0.6 : 0) : 0.4
        const dotSize = dotPhase === i % 3 ? 2.5 : 2

        this.activationGraphics.circle(dotsStartX + i * dotSpacing, dotsY, dotSize)
        this.activationGraphics.fill({ color: box.color, alpha: dotAlpha })
      }
    }
  }

  private createActivationBox(lifeline: LifelineConfig, type: 'auth' | 'fetch'): ActivationBox {
    const startY = this.HEADER_HEIGHT + this.PADDING + 20
    const height = type === 'auth' ? 100 : 120

    const box: ActivationBox = {
      lifelineX: lifeline.x,
      startY,
      endY: startY + height,
      color: type === 'auth' ? this.options.secondaryColor : this.options.primaryColor,
      isActive: true,
      type,
    }

    this.activationBoxes.push(box)
    return box
  }

  private clearActivationBoxes() {
    this.activationBoxes = []
  }

  private clearTimingBars() {
    this.timingBars = []
    this.timingData = null
    this.tlsInfo = null
    this.sizeBreakdown = null
    this.redirectChain = []
  }

  private getStatusColor(status: number): number {
    if (status >= 500) return this.options.errorColor
    if (status >= 400) return 0xe74c3c // Red
    if (status >= 300) return 0xf39c12 // Orange
    if (status >= 200) return 0x27ca40 // Green
    return this.options.textColor
  }

  private getResponseColor(): number {
    if (!this.responseData) return this.options.primaryColor
    return this.getStatusColor(this.responseData.status)
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  }

  private drawErrorEffects() {
    if (!this.errorBurstGraphics) return
    this.errorBurstGraphics.clear()

    if (this.state !== 'error') return

    // Find the error arrow
    const errorArrow = this.arrows.find(a => a.type === 'response' && a.progress >= 1)
    if (!errorArrow) return

    const centerX = (errorArrow.fromX + errorArrow.toX) / 2
    const centerY = errorArrow.y

    // Draw animated burst effects only while animating
    if (this.isErrorAnimating) {
      const burstAlpha = Math.max(0, 1 - this.errorBurstProgress)

      // Outer expanding rings
      for (let i = 0; i < 3; i++) {
        const ringProgress = Math.max(0, this.errorBurstProgress - i * 0.15)
        const ringRadius = 10 + ringProgress * 50
        const ringAlpha = Math.max(0, 0.5 - ringProgress * 0.5)

        if (ringAlpha > 0) {
          this.errorBurstGraphics.circle(centerX, centerY, ringRadius)
          this.errorBurstGraphics.stroke({ color: this.options.errorColor, width: 2, alpha: ringAlpha })
        }
      }

      // Particle burst effect
      if (this.errorBurstProgress < 0.8) {
        const particleCount = 8
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2
          const distance = this.errorBurstProgress * 60
          const particleX = centerX + Math.cos(angle) * distance
          const particleY = centerY + Math.sin(angle) * distance
          const particleAlpha = Math.max(0, 1 - this.errorBurstProgress * 1.5)
          const particleSize = 3 * (1 - this.errorBurstProgress)

          this.errorBurstGraphics.circle(particleX, particleY, particleSize)
          this.errorBurstGraphics.fill({ color: this.options.errorColor, alpha: particleAlpha })
        }
      }
    }

    // X mark - always show when in error state (animate in, then persist)
    const xProgress = this.isErrorAnimating
      ? Math.min(1, Math.max(0, this.errorBurstProgress - 0.2) * 2)
      : 1

    if (xProgress > 0) {
      const xSize = 12 * xProgress
      const xAlpha = Math.min(1, xProgress * 2)

      // Draw X
      this.errorBurstGraphics.moveTo(centerX - xSize, centerY - xSize)
      this.errorBurstGraphics.lineTo(centerX + xSize, centerY + xSize)
      this.errorBurstGraphics.stroke({ color: this.options.errorColor, width: 3, alpha: xAlpha })

      this.errorBurstGraphics.moveTo(centerX + xSize, centerY - xSize)
      this.errorBurstGraphics.lineTo(centerX - xSize, centerY + xSize)
      this.errorBurstGraphics.stroke({ color: this.options.errorColor, width: 3, alpha: xAlpha })

      // Subtle glow behind X (fades during animation, stays subtle after)
      const glowAlpha = this.isErrorAnimating
        ? Math.max(0.1, 0.3 - this.errorBurstProgress * 0.2)
        : 0.1
      this.errorBurstGraphics.circle(centerX, centerY, xSize + 5)
      this.errorBurstGraphics.fill({ color: this.options.errorColor, alpha: glowAlpha })
    }
  }

  private drawJaggedArrowLine(arrow: MessageArrow) {
    // Draw a jagged/broken line effect for error arrows
    const direction = arrow.toX > arrow.fromX ? 1 : -1
    const totalLength = Math.abs(arrow.toX - arrow.fromX)
    const segmentCount = 8
    const segmentLength = totalLength / segmentCount
    const jaggedAmplitude = 4

    let currentX = arrow.fromX
    let isUp = true

    for (let i = 0; i < segmentCount; i++) {
      const nextX = arrow.fromX + direction * (i + 1) * segmentLength
      const jaggedY = arrow.y + (isUp ? -jaggedAmplitude : jaggedAmplitude)

      this.arrowsGraphics.moveTo(currentX, i === 0 ? arrow.y : (isUp ? arrow.y + jaggedAmplitude : arrow.y - jaggedAmplitude))
      this.arrowsGraphics.lineTo(nextX, jaggedY)

      currentX = nextX
      isUp = !isUp
    }
  }

  private triggerErrorAnimation() {
    this.isErrorAnimating = true
    this.errorBurstProgress = 0
    this.errorShakeOffset = 0
  }

  private resetErrorAnimation() {
    this.isErrorAnimating = false
    this.errorBurstPending = false
    this.errorBurstProgress = 0
    this.errorShakeOffset = 0
  }

  private drawConnectionBadges() {
    if (!this.badgesGraphics) return
    this.badgesGraphics.clear()

    // Only show badges after we have response data
    if (this.state !== 'complete' && this.state !== 'error') return
    if (!this.serverLifeline) return

    const badges: { label: string; color: number; icon?: string }[] = []

    // HTTPS/TLS badge
    if (this.tlsInfo) {
      const tlsVersion = this.tlsInfo.protocol || 'TLS'
      badges.push({
        label: tlsVersion,
        color: 0x27ca40, // Green for secure
        icon: '🔒',
      })
    } else if (this.currentRequest?.url?.startsWith('http://')) {
      badges.push({
        label: 'HTTP',
        color: 0xf39c12, // Orange for insecure
        icon: '⚠',
      })
    }

    // Compression badge
    if (this.sizeBreakdown?.encoding && this.sizeBreakdown.encoding !== 'identity') {
      const encoding = this.sizeBreakdown.encoding.toUpperCase()
      let ratio = ''
      if (this.sizeBreakdown.compressionRatio !== undefined) {
        ratio = ` ${Math.round((1 - this.sizeBreakdown.compressionRatio) * 100)}%`
      }
      badges.push({
        label: `${encoding}${ratio}`,
        color: 0x3498db, // Blue
        icon: '📦',
      })
    }

    // Redirect badge
    if (this.redirectChain && this.redirectChain.length > 0) {
      badges.push({
        label: `${this.redirectChain.length} redirect${this.redirectChain.length > 1 ? 's' : ''}`,
        color: 0x9b59b6, // Purple
        icon: '↪',
      })
    }

    if (badges.length === 0) return

    // Draw badges below the server lifeline header
    const badgeStartY = this.PADDING + 50
    const badgeHeight = 18
    const badgeSpacing = 4
    const badgeX = this.serverLifeline.x

    for (let i = 0; i < badges.length; i++) {
      const badge = badges[i]
      const badgeY = badgeStartY + i * (badgeHeight + badgeSpacing)

      // Measure label width
      const labelWidth = badge.label.length * 6 + (badge.icon ? 14 : 0) + 12
      const badgeLeft = badgeX - labelWidth / 2

      // Draw badge background
      this.badgesGraphics.roundRect(badgeLeft, badgeY, labelWidth, badgeHeight, 9)
      this.badgesGraphics.fill({ color: badge.color, alpha: 0.15 })
      this.badgesGraphics.stroke({ color: badge.color, width: 1, alpha: 0.5 })

      // Draw badge text
      const textStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 9,
        fill: badge.color,
        fontWeight: 'bold',
      })
      const displayText = badge.icon ? `${badge.icon} ${badge.label}` : badge.label
      const badgeText = new Text({ text: displayText, style: textStyle })
      badgeText.anchor.set(0.5)
      badgeText.x = badgeX
      badgeText.y = badgeY + badgeHeight / 2
      this.labelsContainer.addChild(badgeText)
    }
  }

  private drawHighlights() {
    if (!this.highlightGraphics) return
    this.highlightGraphics.clear()

    if (!this.hoveredElement) return

    const element = this.interactiveElements[this.hoveredElement.index]
    if (!element) return

    const pulseAlpha = 0.4 + 0.2 * Math.sin(this.animationTime * 5)

    if (element.type === 'arrow') {
      // Find the response arrow that's being hovered
      const responseArrow = this.arrows.find(a => a.type === 'response' && a.progress >= 1)
      if (responseArrow) {
        const fromX = responseArrow.fromX
        const toX = responseArrow.toX
        const y = responseArrow.y

        // Draw glowing arrow line (multiple layers for glow effect)
        // Outer glow
        this.highlightGraphics.moveTo(fromX, y)
        this.highlightGraphics.lineTo(toX, y)
        this.highlightGraphics.stroke({ color: responseArrow.color, width: 8, alpha: pulseAlpha * 0.3 })

        // Middle glow
        this.highlightGraphics.moveTo(fromX, y)
        this.highlightGraphics.lineTo(toX, y)
        this.highlightGraphics.stroke({ color: responseArrow.color, width: 5, alpha: pulseAlpha * 0.5 })

        // Inner bright line
        this.highlightGraphics.moveTo(fromX, y)
        this.highlightGraphics.lineTo(toX, y)
        this.highlightGraphics.stroke({ color: 0xffffff, width: 2, alpha: pulseAlpha * 0.6 })
      }
    }
  }

  private updateInteractiveElements() {
    this.interactiveElements = []

    // Add only response arrows as interactive elements (they open response popup)
    for (let i = 0; i < this.arrows.length; i++) {
      const arrow = this.arrows[i]
      // Only response arrows are clickable, and only after animation completes
      if (arrow.type !== 'response' || arrow.progress < 1) continue

      const minX = Math.min(arrow.fromX, arrow.toX)
      const maxX = Math.max(arrow.fromX, arrow.toX)

      this.interactiveElements.push({
        type: 'arrow',
        bounds: {
          x: minX,
          y: arrow.y - 15,
          width: maxX - minX,
          height: 30,
        }
      })
    }
  }

  private onPointerMove(event: { global: { x: number; y: number } }) {
    const localPos = this.toLocal(event.global)
    const x = localPos.x
    const y = localPos.y

    let found = false
    for (let i = 0; i < this.interactiveElements.length; i++) {
      const element = this.interactiveElements[i]
      const { bounds } = element

      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {
        if (!this.hoveredElement || this.hoveredElement.index !== i) {
          this.hoveredElement = { type: element.type, index: i }
          this.cursor = 'pointer'
        }
        found = true
        break
      }
    }

    if (!found && this.hoveredElement) {
      this.hoveredElement = null
      this.cursor = 'default'
    }
  }

  private onPointerDown(event: { global: { x: number; y: number } }) {
    if (!this.hoveredElement) return

    const element = this.interactiveElements[this.hoveredElement.index]
    if (!element) return

    // Response arrows open the response popup
    if (element.type === 'arrow' && (this.state === 'complete' || this.state === 'error')) {
      this.onEvent?.('open-response')
    }
  }

  public navigateElements(direction: 'next' | 'prev') {
    if (this.interactiveElements.length === 0) return

    if (direction === 'next') {
      this.selectedElementIndex = (this.selectedElementIndex + 1) % this.interactiveElements.length
    } else {
      this.selectedElementIndex = (this.selectedElementIndex - 1 + this.interactiveElements.length) % this.interactiveElements.length
    }

    const element = this.interactiveElements[this.selectedElementIndex]
    if (element) {
      this.hoveredElement = { type: element.type, index: this.selectedElementIndex }
    }
  }

  public activateSelectedElement() {
    if (!this.hoveredElement) return false

    const element = this.interactiveElements[this.hoveredElement.index]
    if (!element) return false

    if (element.type === 'arrow') {
      if (this.state === 'complete' || this.state === 'error') {
        this.onEvent?.('open-response')
        return true
      }
    }
    return false
  }

  private createTimingBars(timing: ResponseTiming) {
    this.timingBars = []

    const phases: { key: keyof typeof TIMING_COLORS; value: number | undefined; label: string }[] = [
      { key: 'blocked', value: timing.blocked, label: 'Blocked' },
      { key: 'dns', value: timing.dns, label: 'DNS' },
      { key: 'tcp', value: timing.tcp, label: 'TCP' },
      { key: 'tls', value: timing.tls, label: 'TLS' },
      { key: 'ttfb', value: timing.ttfb, label: 'TTFB' },
      { key: 'download', value: timing.download, label: 'Download' },
    ]

    for (const phase of phases) {
      if (phase.value && phase.value > 0) {
        this.timingBars.push({
          label: phase.label,
          duration: phase.value,
          color: TIMING_COLORS[phase.key],
          progress: 0,
        })
      }
    }
  }

  private drawTimingBars() {
    if (!this.timingGraphics) return
    this.timingGraphics.clear()

    // Only draw if we have timing data and a response arrow
    if (this.timingBars.length === 0 || this.state !== 'complete') return

    // Find the response arrow
    const responseArrow = this.arrows.find(a => a.type === 'response' && a.progress >= 1)
    if (!responseArrow) return

    const barHeight = 6
    const barY = responseArrow.y + 20
    const totalDuration = this.timingBars.reduce((sum, bar) => sum + bar.duration, 0)
    const maxBarWidth = Math.abs(responseArrow.toX - responseArrow.fromX) - 40
    const startX = Math.min(responseArrow.fromX, responseArrow.toX) + 20

    let currentX = startX

    // Draw background bar
    this.timingGraphics.roundRect(startX - 2, barY - 2, maxBarWidth + 4, barHeight + 4, 4)
    this.timingGraphics.fill({ color: this.options.bgColor, alpha: 0.8 })
    this.timingGraphics.stroke({ color: this.options.textColor, width: 1, alpha: 0.2 })

    // Draw each timing segment
    for (let i = 0; i < this.timingBars.length; i++) {
      const bar = this.timingBars[i]
      const barWidth = (bar.duration / totalDuration) * maxBarWidth * Math.min(1, bar.progress)

      if (barWidth > 1) {
        // Main bar
        this.timingGraphics.roundRect(currentX, barY, barWidth, barHeight, 2)
        this.timingGraphics.fill({ color: bar.color, alpha: 0.9 })

        // Highlight
        this.timingGraphics.roundRect(currentX, barY, barWidth, barHeight / 2, 2)
        this.timingGraphics.fill({ color: 0xffffff, alpha: 0.2 })
      }

      currentX += (bar.duration / totalDuration) * maxBarWidth
    }

    // Draw timing labels below the bar
    const labelY = barY + barHeight + 8
    currentX = startX

    for (const bar of this.timingBars) {
      const barWidth = (bar.duration / totalDuration) * maxBarWidth

      if (barWidth > 30 && bar.progress >= 1) {
        const labelStyle = new TextStyle({
          fontFamily: 'Share Tech Mono, monospace',
          fontSize: 8,
          fill: bar.color,
        })
        const label = new Text({ text: `${bar.label} ${bar.duration.toFixed(0)}ms`, style: labelStyle })
        label.anchor.set(0.5, 0)
        label.x = currentX + barWidth / 2
        label.y = labelY
        label.alpha = bar.progress
        this.labelsContainer.addChild(label)
      }

      currentX += barWidth
    }

    // Draw total timing label
    if (this.timingData) {
      const totalStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 9,
        fill: this.options.textColor,
        fontWeight: 'bold',
      })
      const totalLabel = new Text({ text: `Total: ${this.timingData.total.toFixed(0)}ms`, style: totalStyle })
      totalLabel.anchor.set(1, 0.5)
      totalLabel.x = startX + maxBarWidth
      totalLabel.y = barY + barHeight / 2
      this.labelsContainer.addChild(totalLabel)
    }
  }

  private update() {
    let needsRedraw = false

    // Update animation time
    this.animationTime += 0.016 // ~60fps

    // Update waiting dots frame (slower animation)
    if (Math.floor(this.animationTime * 3) !== Math.floor((this.animationTime - 0.016) * 3)) {
      this.waitingDotsFrame = (this.waitingDotsFrame + 1) % 4
    }

    // Always redraw activation boxes if in active state (for pulsing animation)
    if (this.state === 'authenticating' || this.state === 'fetching') {
      needsRedraw = true
    }

    // Animate arrows sequentially
    let previousArrowComplete = true
    for (const arrow of this.arrows) {
      // Start waiting arrows when previous arrow completes
      if (arrow.waitingToStart && previousArrowComplete) {
        arrow.waitingToStart = false
        arrow.isAnimating = true
      }

      if (arrow.isAnimating && arrow.progress < 1) {
        // Use fast speed if arrow needs to catch up, normal speed otherwise
        const speed = arrow.speedUp ? this.arrowFastSpeed : this.arrowAnimationSpeed
        arrow.progress = Math.min(1, arrow.progress + speed)
        needsRedraw = true

        if (arrow.progress >= 1) {
          arrow.isAnimating = false

          // Trigger error burst when error response arrow completes
          if (this.errorBurstPending && this.state === 'error' && arrow.type === 'response') {
            this.errorBurstPending = false
            this.triggerErrorAnimation()
          }
        }
      }

      // Track if this arrow is complete for the next arrow
      previousArrowComplete = arrow.progress >= 1 && !arrow.isAnimating && !arrow.waitingToStart
    }

    // Animate timing bars (staggered reveal)
    const timingBarSpeed = 0.04
    for (let i = 0; i < this.timingBars.length; i++) {
      const bar = this.timingBars[i]
      if (bar.progress < 1) {
        // Stagger the animation of each bar
        const staggerDelay = i * 0.1
        if (this.animationTime > staggerDelay) {
          bar.progress = Math.min(1, bar.progress + timingBarSpeed)
          needsRedraw = true
        }
      }
    }

    // Animate error effects
    if (this.isErrorAnimating) {
      this.errorBurstProgress = Math.min(1.5, this.errorBurstProgress + 0.03)

      // Shake effect during burst
      if (this.errorBurstProgress < 0.5) {
        this.errorShakeOffset = Math.sin(this.animationTime * 30) * 3 * (1 - this.errorBurstProgress * 2)
      } else {
        this.errorShakeOffset = 0
      }

      needsRedraw = true

      // Stop animation when complete
      if (this.errorBurstProgress >= 1.5) {
        this.isErrorAnimating = false
      }
    }

    // Redraw highlights if hovering (for pulse effect) or if hover state changed (for unhover reset)
    const isHovering = this.hoveredElement !== null
    if (isHovering || this.wasHovering !== isHovering) {
      needsRedraw = true
    }
    this.wasHovering = isHovering

    if (needsRedraw) {
      // Clear and redraw labels for arrow labels
      this.labelsContainer.removeChildren()
      this.drawLifelines()
      this.drawActivationBoxes()
      this.drawArrows()
      this.drawTimingBars()
      this.drawErrorEffects()
      this.drawConnectionBadges()
      this.drawHighlights()

      // Update interactive elements when arrows change
      this.updateInteractiveElements()
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

    // Check if there are any arrows still animating - new arrow should wait
    const hasAnimatingArrows = this.arrows.some(a => a.isAnimating || a.waitingToStart)

    const arrow: MessageArrow = {
      fromX: fromLifeline.x,
      toX: toLifeline.x,
      y,
      label,
      type,
      progress: animate ? 0 : 1,
      isAnimating: animate && !hasAnimatingArrows,  // Only start immediately if no other arrows animating
      waitingToStart: animate && hasAnimatingArrows, // Wait if there are animating arrows
      speedUp: false,
      color: type === 'auth' ? this.options.secondaryColor : this.options.primaryColor,
    }

    this.arrows.push(arrow)
    return arrow
  }

  private clearArrows() {
    this.arrows = []
  }

  // Speed up all incomplete arrows when phase completes early
  private speedUpIncompleteArrows() {
    for (const arrow of this.arrows) {
      if (arrow.progress < 1) {
        arrow.speedUp = true
        // If waiting to start, start it now with speedUp
        if (arrow.waitingToStart) {
          arrow.waitingToStart = false
          arrow.isAnimating = true
        }
      }
    }
  }

  // IPresentationMode implementation

  public setRequest(request: ParsedRequest | null, variables: Record<string, string> = {}) {
    this.currentRequest = request
    this.resolvedVariables = variables
    this.hasAuth = request?.auth?.type !== undefined && request.auth.type !== 'none'
    this.responseData = null
    this.errorMessage = null
    this.clearArrows()
    this.clearActivationBoxes()
    this.resetErrorAnimation()
    this.clearTimingBars()
    this.animationTime = 0

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
        this.clearActivationBoxes()
        this.responseData = null
        this.errorMessage = null
        break

      case 'authenticating':
        this.state = 'authenticating'
        this.clearArrows()
        this.clearActivationBoxes()
        this.animationTime = 0

        // Create activation box on auth server
        if (this.authLifeline) {
          this.createActivationBox(this.authLifeline, 'auth')
        }

        if (this.clientLifeline && this.authLifeline) {
          this.createArrow(this.clientLifeline, this.authLifeline, 'AUTH REQUEST', 'auth')
        }
        break

      case 'fetching':
        // If coming from a terminal state (not authenticating), clear everything for fresh start
        if (this.state !== 'authenticating') {
          this.clearArrows()
          this.clearActivationBoxes()
          this.clearTimingBars()
          this.resetErrorAnimation()
          this.responseData = null
          this.errorMessage = null
        }

        this.state = 'fetching'
        this.animationTime = 0

        // Speed up any incomplete arrows from previous phase (only relevant when coming from authenticating)
        this.speedUpIncompleteArrows()

        // Deactivate auth box if present
        for (const box of this.activationBoxes) {
          if (box.type === 'auth') {
            box.isActive = false
          }
        }

        // Add auth response if we were authenticating
        if (this.hasAuth && this.authLifeline && this.clientLifeline) {
          // Check if auth response already exists
          const hasAuthResponse = this.arrows.some(a => a.type === 'auth' && a.toX < a.fromX)
          if (!hasAuthResponse) {
            this.createArrow(this.authLifeline, this.clientLifeline, 'TOKEN', 'auth')
          }
        }

        // Create activation box on server
        if (this.serverLifeline) {
          this.createActivationBox(this.serverLifeline, 'fetch')
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
        // Deactivate all boxes
        for (const box of this.activationBoxes) {
          box.isActive = false
        }
        break

      case 'error':
        this.state = 'error'
        // Deactivate all boxes
        for (const box of this.activationBoxes) {
          box.isActive = false
        }
        break
    }

    this.draw()
  }

  public setResponse(status: number, statusText: string, size: number, duration: number, extendedData?: ExtendedResponseData) {
    this.responseData = { status, statusText, size, duration }
    this.clearTimingBars()
    this.animationTime = 0

    // Speed up any incomplete arrows from previous phase
    this.speedUpIncompleteArrows()

    // Store extended data
    if (extendedData) {
      this.timingData = extendedData.timing || null
      this.tlsInfo = extendedData.tls || null
      this.sizeBreakdown = extendedData.sizeBreakdown || null
      this.redirectChain = extendedData.redirectChain || []

      // Create timing bars if we have timing data
      if (this.timingData) {
        this.createTimingBars(this.timingData)
      }
    }

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
    this.animationTime = 0

    // Speed up any incomplete arrows from previous phase
    this.speedUpIncompleteArrows()

    // Mark error burst as pending - will trigger when error arrow completes
    this.errorBurstPending = true

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
    // Only handle click if hovering over an interactive element
    // Otherwise let onPointerDown handle specific element clicks
    if (this.hoveredElement) {
      return this.activateSelectedElement()
    }
    return false
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
    this.off('pointermove')
    this.off('pointerdown')
    this.backgroundGraphics.destroy()
    this.lifelinesGraphics.destroy()
    this.activationGraphics?.destroy()
    this.arrowsGraphics.destroy()
    this.timingGraphics?.destroy()
    this.errorBurstGraphics?.destroy()
    this.badgesGraphics?.destroy()
    this.highlightGraphics?.destroy()
    this.labelsContainer.destroy()
    super.destroy()
  }
}

