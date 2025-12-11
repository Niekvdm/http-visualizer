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
 * Blueprint Mode - Technical schematic/CAD drawing style
 * 
 * Shows:
 * - Grid background with dimension lines
 * - Request as "component" with ports
 * - Response as connected component
 * - Dashed lines for data flow
 * - Technical annotations with measurements
 */

interface Component {
  x: number
  y: number
  width: number
  height: number
  label: string
  type: 'client' | 'request' | 'server' | 'response' | 'auth'
  ports: { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom' }[]
  data: string[]
}

interface Connection {
  from: { component: number; port: number }
  to: { component: number; port: number }
  progress: number
  label: string
  animated: boolean
}

type BlueprintState = 'idle' | 'selected' | 'connecting' | 'complete' | 'error'

export class BlueprintMode extends Container implements IPresentationMode {
  private options: PresentationModeOptions
  private settings: PresentationModeSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }

  // Graphics layers
  private backgroundGraphics: Graphics
  private gridGraphics: Graphics
  private componentsGraphics: Graphics
  private connectionsGraphics: Graphics
  private annotationsGraphics: Graphics
  private labelsContainer: Container

  // State
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private state: BlueprintState = 'idle'
  private responseData: { status: number; statusText: string; size: number; duration: number } | null = null
  private errorMessage: string | null = null

  // Components and connections
  private components: Component[] = []
  private connections: Connection[] = []
  private animationProgress: number = 0

  // Animation
  private ticker: Ticker
  private connectionSpeed: number = 0.015
  private dashOffset: number = 0

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  // Layout
  private readonly PADDING = 60
  private readonly GRID_SIZE = 20
  private readonly COMPONENT_WIDTH = 180
  private readonly COMPONENT_HEIGHT = 120

  // Blueprint colors
  private readonly BLUEPRINT_BG = 0x1a2744
  private readonly BLUEPRINT_LINE = 0x4a7ab8
  private readonly BLUEPRINT_ACCENT = 0x6cb4ee
  private readonly BLUEPRINT_TEXT = 0xc5ddf5

  constructor(options: PresentationModeOptions) {
    super()
    this.options = options

    // Create graphics layers
    this.backgroundGraphics = new Graphics()
    this.addChild(this.backgroundGraphics)
    
    this.gridGraphics = new Graphics()
    this.addChild(this.gridGraphics)

    this.connectionsGraphics = new Graphics()
    this.addChild(this.connectionsGraphics)

    this.componentsGraphics = new Graphics()
    this.addChild(this.componentsGraphics)

    this.annotationsGraphics = new Graphics()
    this.addChild(this.annotationsGraphics)

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
    this.drawConnections()
    this.drawComponents()
    this.drawAnnotations()
  }

  private drawBackground() {
    const { width, height } = this.options
    
    this.backgroundGraphics.clear()
    
    // Blueprint blue background
    this.backgroundGraphics.rect(0, 0, width, height)
    this.backgroundGraphics.fill({ color: this.BLUEPRINT_BG, alpha: 1 })

    // Subtle texture overlay
    for (let y = 0; y < height; y += 4) {
      this.backgroundGraphics.rect(0, y, width, 1)
      this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.05 })
    }

    // Border frame
    const frameInset = 20
    this.backgroundGraphics.rect(frameInset, frameInset, width - frameInset * 2, height - frameInset * 2)
    this.backgroundGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.5, width: 2 })

    // Corner marks
    const cornerSize = 15
    const corners = [
      [frameInset, frameInset],
      [width - frameInset, frameInset],
      [frameInset, height - frameInset],
      [width - frameInset, height - frameInset],
    ]

    for (const [cx, cy] of corners) {
      // Horizontal line
      this.backgroundGraphics.moveTo(cx - cornerSize, cy)
      this.backgroundGraphics.lineTo(cx + cornerSize, cy)
      this.backgroundGraphics.stroke({ color: this.BLUEPRINT_ACCENT, alpha: 0.8, width: 1 })
      
      // Vertical line
      this.backgroundGraphics.moveTo(cx, cy - cornerSize)
      this.backgroundGraphics.lineTo(cx, cy + cornerSize)
      this.backgroundGraphics.stroke({ color: this.BLUEPRINT_ACCENT, alpha: 0.8, width: 1 })
    }

    // Title block
    const titleBlockHeight = 40
    this.backgroundGraphics.rect(frameInset, height - frameInset - titleBlockHeight, width - frameInset * 2, titleBlockHeight)
    this.backgroundGraphics.fill({ color: this.BLUEPRINT_BG, alpha: 0.9 })
    this.backgroundGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.5, width: 1 })
  }

  private drawGrid() {
    const { width, height } = this.options
    
    this.gridGraphics.clear()

    // Main grid
    for (let x = this.PADDING; x < width - this.PADDING; x += this.GRID_SIZE) {
      const isMajor = (x - this.PADDING) % (this.GRID_SIZE * 5) === 0
      this.gridGraphics.moveTo(x, this.PADDING)
      this.gridGraphics.lineTo(x, height - this.PADDING - 50)
      this.gridGraphics.stroke({ 
        color: this.BLUEPRINT_LINE, 
        alpha: isMajor ? 0.2 : 0.08, 
        width: isMajor ? 1 : 0.5 
      })
    }

    for (let y = this.PADDING; y < height - this.PADDING - 50; y += this.GRID_SIZE) {
      const isMajor = (y - this.PADDING) % (this.GRID_SIZE * 5) === 0
      this.gridGraphics.moveTo(this.PADDING, y)
      this.gridGraphics.lineTo(width - this.PADDING, y)
      this.gridGraphics.stroke({ 
        color: this.BLUEPRINT_LINE, 
        alpha: isMajor ? 0.2 : 0.08, 
        width: isMajor ? 1 : 0.5 
      })
    }
  }

  private drawComponents() {
    const { width, height } = this.options
    
    this.componentsGraphics.clear()
    this.labelsContainer.removeChildren()

    if (this.state === 'idle') {
      const style = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 16,
        fill: this.BLUEPRINT_TEXT,
        align: 'center',
      })
      const text = new Text({ text: 'SELECT REQUEST TO VIEW SCHEMATIC', style })
      text.anchor.set(0.5)
      text.x = width / 2
      text.y = height / 2
      this.labelsContainer.addChild(text)
      return
    }

    // Draw each component
    for (const comp of this.components) {
      this.drawComponent(comp)
    }

    // Title block text
    const titleStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 11,
      fill: this.BLUEPRINT_TEXT,
    })

    const title = new Text({ text: 'HTTP REQUEST SCHEMATIC', style: titleStyle })
    title.x = 40
    title.y = height - 55
    this.labelsContainer.addChild(title)

    if (this.currentRequest) {
      const method = this.currentRequest.method
      const url = resolveVariables(this.currentRequest.url, this.resolvedVariables)
      const truncated = url.length > 60 ? url.slice(0, 57) + '...' : url

      const urlText = new Text({ text: `${method} ${truncated}`, style: titleStyle })
      urlText.x = 250
      urlText.y = height - 55
      this.labelsContainer.addChild(urlText)
    }

    if (this.responseData) {
      const statusText = new Text({ 
        text: `STATUS: ${this.responseData.status} | TIME: ${this.responseData.duration.toFixed(0)}ms | SIZE: ${this.formatBytes(this.responseData.size)}`, 
        style: titleStyle 
      })
      statusText.anchor.set(1, 0)
      statusText.x = width - 40
      statusText.y = height - 55
      this.labelsContainer.addChild(statusText)
    }
  }

  private drawComponent(comp: Component) {
    const { errorColor } = this.options

    // Component box
    this.componentsGraphics.rect(comp.x, comp.y, comp.width, comp.height)
    this.componentsGraphics.fill({ color: this.BLUEPRINT_BG, alpha: 0.95 })
    
    // Border color based on type
    let borderColor = this.BLUEPRINT_LINE
    if (comp.type === 'response' && this.state === 'error') {
      borderColor = errorColor
    } else if (comp.type === 'response' && this.responseData) {
      borderColor = this.responseData.status >= 400 ? errorColor : 0x27ca40
    }
    
    this.componentsGraphics.stroke({ color: borderColor, alpha: 0.8, width: 2 })

    // Component header
    this.componentsGraphics.rect(comp.x, comp.y, comp.width, 24)
    this.componentsGraphics.fill({ color: borderColor, alpha: 0.2 })

    // Header label
    const headerStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 10,
      fill: this.BLUEPRINT_ACCENT,
      fontWeight: 'bold',
    })
    const header = new Text({ text: comp.label, style: headerStyle })
    header.x = comp.x + 8
    header.y = comp.y + 6
    this.labelsContainer.addChild(header)

    // Component data
    const dataStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 9,
      fill: this.BLUEPRINT_TEXT,
    })

    comp.data.forEach((line, i) => {
      const truncated = line.length > 25 ? line.slice(0, 22) + '...' : line
      const text = new Text({ text: truncated, style: dataStyle })
      text.x = comp.x + 8
      text.y = comp.y + 32 + i * 14
      this.labelsContainer.addChild(text)
    })

    // Draw ports
    for (const port of comp.ports) {
      this.componentsGraphics.circle(comp.x + port.x, comp.y + port.y, 4)
      this.componentsGraphics.fill({ color: this.BLUEPRINT_ACCENT, alpha: 1 })
      this.componentsGraphics.circle(comp.x + port.x, comp.y + port.y, 6)
      this.componentsGraphics.stroke({ color: this.BLUEPRINT_ACCENT, alpha: 0.5, width: 1 })
    }

    // Dimension lines
    this.drawDimensionLine(
      comp.x, comp.y + comp.height + 15,
      comp.x + comp.width, comp.y + comp.height + 15,
      `${comp.width}px`
    )
  }

  private drawDimensionLine(x1: number, y1: number, x2: number, y2: number, label: string) {
    // Extension lines
    this.annotationsGraphics.moveTo(x1, y1 - 8)
    this.annotationsGraphics.lineTo(x1, y1 + 3)
    this.annotationsGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.5, width: 1 })

    this.annotationsGraphics.moveTo(x2, y2 - 8)
    this.annotationsGraphics.lineTo(x2, y2 + 3)
    this.annotationsGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.5, width: 1 })

    // Dimension line
    this.annotationsGraphics.moveTo(x1, y1)
    this.annotationsGraphics.lineTo(x2, y2)
    this.annotationsGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.5, width: 1 })

    // Arrowheads
    const arrowSize = 4
    this.annotationsGraphics.moveTo(x1, y1)
    this.annotationsGraphics.lineTo(x1 + arrowSize, y1 - arrowSize / 2)
    this.annotationsGraphics.lineTo(x1 + arrowSize, y1 + arrowSize / 2)
    this.annotationsGraphics.closePath()
    this.annotationsGraphics.fill({ color: this.BLUEPRINT_LINE, alpha: 0.5 })

    this.annotationsGraphics.moveTo(x2, y2)
    this.annotationsGraphics.lineTo(x2 - arrowSize, y2 - arrowSize / 2)
    this.annotationsGraphics.lineTo(x2 - arrowSize, y2 + arrowSize / 2)
    this.annotationsGraphics.closePath()
    this.annotationsGraphics.fill({ color: this.BLUEPRINT_LINE, alpha: 0.5 })

    // Label
    const style = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 8,
      fill: this.BLUEPRINT_LINE,
    })
    const text = new Text({ text: label, style })
    text.anchor.set(0.5, 0)
    text.x = (x1 + x2) / 2
    text.y = y1 + 3
    this.labelsContainer.addChild(text)
  }

  private drawConnections() {
    this.connectionsGraphics.clear()

    for (const conn of this.connections) {
      if (conn.progress <= 0) continue

      const fromComp = this.components[conn.from.component]
      const toComp = this.components[conn.to.component]
      
      if (!fromComp || !toComp) continue

      const fromPort = fromComp.ports[conn.from.port]
      const toPort = toComp.ports[conn.to.port]
      
      if (!fromPort || !toPort) continue

      const startX = fromComp.x + fromPort.x
      const startY = fromComp.y + fromPort.y
      const endX = toComp.x + toPort.x
      const endY = toComp.y + toPort.y

      // Calculate current end point based on progress
      const currentX = startX + (endX - startX) * conn.progress
      const currentY = startY + (endY - startY) * conn.progress

      // Draw dashed line
      this.drawDashedLine(startX, startY, currentX, currentY, conn.animated)

      // Draw arrowhead if complete
      if (conn.progress >= 1) {
        const angle = Math.atan2(endY - startY, endX - startX)
        const arrowSize = 8
        
        this.connectionsGraphics.moveTo(endX, endY)
        this.connectionsGraphics.lineTo(
          endX - arrowSize * Math.cos(angle - Math.PI / 6),
          endY - arrowSize * Math.sin(angle - Math.PI / 6)
        )
        this.connectionsGraphics.lineTo(
          endX - arrowSize * Math.cos(angle + Math.PI / 6),
          endY - arrowSize * Math.sin(angle + Math.PI / 6)
        )
        this.connectionsGraphics.closePath()
        this.connectionsGraphics.fill({ color: this.BLUEPRINT_ACCENT, alpha: 0.9 })
      }

      // Connection label
      if (conn.label && conn.progress > 0.5) {
        const labelX = (startX + endX) / 2
        const labelY = (startY + endY) / 2 - 10

        const style = new TextStyle({
          fontFamily: 'Fira Code, monospace',
          fontSize: 9,
          fill: this.BLUEPRINT_ACCENT,
        })
        const text = new Text({ text: conn.label, style })
        text.anchor.set(0.5)
        text.x = labelX
        text.y = labelY
        text.alpha = (conn.progress - 0.5) * 2
        this.labelsContainer.addChild(text)
      }

      // Animated dot at connection head
      if (conn.animated && conn.progress < 1) {
        this.connectionsGraphics.circle(currentX, currentY, 4)
        this.connectionsGraphics.fill({ color: this.BLUEPRINT_ACCENT, alpha: 1 })
      }
    }
  }

  private drawDashedLine(x1: number, y1: number, x2: number, y2: number, animated: boolean) {
    const dashLength = 8
    const gapLength = 4
    const totalLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    const angle = Math.atan2(y2 - y1, x2 - x1)
    
    const offset = animated ? this.dashOffset : 0
    let currentLength = offset % (dashLength + gapLength)

    while (currentLength < totalLength) {
      const dashStart = currentLength
      const dashEnd = Math.min(currentLength + dashLength, totalLength)

      if (dashEnd > dashStart) {
        const sx = x1 + dashStart * Math.cos(angle)
        const sy = y1 + dashStart * Math.sin(angle)
        const ex = x1 + dashEnd * Math.cos(angle)
        const ey = y1 + dashEnd * Math.sin(angle)

        this.connectionsGraphics.moveTo(sx, sy)
        this.connectionsGraphics.lineTo(ex, ey)
        this.connectionsGraphics.stroke({ color: this.BLUEPRINT_ACCENT, alpha: 0.8, width: 2 })
      }

      currentLength += dashLength + gapLength
    }
  }

  private drawAnnotations() {
    this.annotationsGraphics.clear()
    // Annotations are drawn with components
  }

  private update() {
    let needsRedraw = false

    // Update dash animation
    this.dashOffset += 0.5
    for (const conn of this.connections) {
      if (conn.animated && conn.progress < 1) {
        conn.progress = Math.min(1, conn.progress + this.connectionSpeed)
        needsRedraw = true
      }
    }

    if (needsRedraw || this.connections.some(c => c.animated)) {
      this.draw()
    }
  }

  private setupComponents() {
    const { width, height } = this.options

    this.components = []
    this.connections = []

    if (!this.currentRequest) return

    const centerY = (height - 100) / 2
    const hasAuth = this.currentRequest.auth?.type && this.currentRequest.auth.type !== 'none'

    // Client component
    this.components.push({
      x: this.PADDING + 20,
      y: centerY - this.COMPONENT_HEIGHT / 2,
      width: this.COMPONENT_WIDTH,
      height: this.COMPONENT_HEIGHT,
      label: 'CLIENT',
      type: 'client',
      ports: [
        { x: this.COMPONENT_WIDTH, y: this.COMPONENT_HEIGHT / 2, side: 'right' },
      ],
      data: [
        'User-Agent: Browser',
        'Accept: */*',
        `Headers: ${this.currentRequest.headers?.filter(h => h.enabled).length || 0}`,
      ],
    })

    // Request component
    const reqX = hasAuth ? width / 2 - this.COMPONENT_WIDTH / 2 : this.PADDING + this.COMPONENT_WIDTH + 100
    this.components.push({
      x: reqX,
      y: centerY - this.COMPONENT_HEIGHT / 2 - 30,
      width: this.COMPONENT_WIDTH,
      height: this.COMPONENT_HEIGHT,
      label: `REQUEST [${this.currentRequest.method}]`,
      type: 'request',
      ports: [
        { x: 0, y: this.COMPONENT_HEIGHT / 2, side: 'left' },
        { x: this.COMPONENT_WIDTH, y: this.COMPONENT_HEIGHT / 2, side: 'right' },
      ],
      data: [
        this.truncateUrl(resolveVariables(this.currentRequest.url, this.resolvedVariables), 24),
        `Body: ${this.currentRequest.body ? 'Yes' : 'No'}`,
        `Content-Type: ${this.getContentType()}`,
      ],
    })

    // Server component
    this.components.push({
      x: width - this.PADDING - this.COMPONENT_WIDTH - 20,
      y: centerY - this.COMPONENT_HEIGHT / 2,
      width: this.COMPONENT_WIDTH,
      height: this.COMPONENT_HEIGHT,
      label: 'SERVER',
      type: 'server',
      ports: [
        { x: 0, y: this.COMPONENT_HEIGHT / 2, side: 'left' },
      ],
      data: [
        this.getHostname(),
        'Protocol: HTTP/1.1',
        'Connection: Keep-Alive',
      ],
    })

    // Initial connection: Client -> Request
    this.connections.push({
      from: { component: 0, port: 0 },
      to: { component: 1, port: 0 },
      progress: 1,
      label: 'INIT',
      animated: false,
    })
  }

  private setupResponseComponent() {
    const { width, height } = this.options

    if (!this.responseData && !this.errorMessage) return

    const centerY = (height - 100) / 2

    // Response component
    const status = this.responseData?.status || 0
    const statusText = this.responseData?.statusText || 'ERROR'

    this.components.push({
      x: width / 2 - this.COMPONENT_WIDTH / 2,
      y: centerY - this.COMPONENT_HEIGHT / 2 + 80,
      width: this.COMPONENT_WIDTH,
      height: this.COMPONENT_HEIGHT,
      label: `RESPONSE [${status}]`,
      type: 'response',
      ports: [
        { x: this.COMPONENT_WIDTH / 2, y: 0, side: 'top' },
      ],
      data: this.errorMessage 
        ? ['ERROR', this.errorMessage.slice(0, 24)]
        : [
            `Status: ${status} ${statusText}`,
            `Size: ${this.formatBytes(this.responseData?.size || 0)}`,
            `Time: ${this.responseData?.duration.toFixed(0)}ms`,
          ],
    })

    // Connection: Request -> Response
    this.connections.push({
      from: { component: 1, port: 1 },
      to: { component: this.components.length - 1, port: 0 },
      progress: 0,
      label: this.responseData ? `${this.responseData.duration.toFixed(0)}ms` : 'ERROR',
      animated: true,
    })
  }

  private getContentType(): string {
    const header = this.currentRequest?.headers?.find(
      h => h.key.toLowerCase() === 'content-type' && h.enabled
    )
    if (header) {
      const value = resolveVariables(header.value, this.resolvedVariables)
      return value.split(';')[0].trim().slice(0, 20)
    }
    return 'application/json'
  }

  private getHostname(): string {
    try {
      const url = resolveVariables(this.currentRequest?.url || '', this.resolvedVariables)
      const parsed = new URL(url)
      return parsed.hostname.slice(0, 24)
    } catch {
      return 'unknown'
    }
  }

  private truncateUrl(url: string, maxLength: number): string {
    if (url.length <= maxLength) return url
    return url.slice(0, maxLength - 3) + '...'
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // IPresentationMode implementation

  public setRequest(request: ParsedRequest | null, variables: Record<string, string> = {}) {
    this.currentRequest = request
    this.resolvedVariables = variables
    this.responseData = null
    this.errorMessage = null
    this.components = []
    this.connections = []

    if (!request) {
      this.state = 'idle'
    } else {
      this.state = 'selected'
      this.setupComponents()
    }

    this.draw()
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    switch (phase) {
      case 'idle':
        this.state = this.currentRequest ? 'selected' : 'idle'
        this.responseData = null
        this.errorMessage = null
        this.setupComponents()
        break

      case 'authenticating':
      case 'fetching':
        this.state = 'connecting'
        // Animate the request server connection
        if (this.connections.length > 0) {
          this.connections[this.connections.length - 1].animated = true
          this.connections[this.connections.length - 1].progress = 0
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
    this.setupResponseComponent()
    this.draw()
  }

  public setError(message: string) {
    this.errorMessage = message
    this.setupResponseComponent()
    this.draw()
  }

  public resize(width: number, height: number) {
    this.options.width = width
    this.options.height = height
    this.setupComponents()
    if (this.responseData || this.errorMessage) {
      this.setupResponseComponent()
    }
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
    this.componentsGraphics.destroy()
    this.connectionsGraphics.destroy()
    this.annotationsGraphics.destroy()
    this.labelsContainer.destroy()
    super.destroy()
  }
}
