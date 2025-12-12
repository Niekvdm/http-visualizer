import { Container, Graphics, Text, TextStyle, Ticker, RenderTexture, Sprite } from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import type { ExecutionPhase, ParsedRequest, RedirectHop } from '@/types'
import type {
  IPresentationMode,
  PresentationModeOptions,
  PresentationModeSettings,
  PresentationModeEvent,
  ExtendedResponseData
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
 * - Redirect chain visualization
 */

interface Component {
  x: number
  y: number
  width: number
  height: number
  label: string
  type: 'client' | 'request' | 'server' | 'response' | 'auth' | 'redirect'
  ports: { x: number; y: number; side: 'left' | 'right' | 'top' | 'bottom' }[]
  data: string[]
  isRedirect?: boolean
  redirectIndex?: number
  refDesignator?: string // e.g., "A1", "B2"
}

interface Connection {
  from: { component: number; port: number }
  to: { component: number; port: number }
  progress: number
  label: string
  animated: boolean
  isRedirect?: boolean
  // Orthogonal path segments (H/V only)
  segments?: { x1: number; y1: number; x2: number; y2: number }[]
}

type BlueprintState = 'idle' | 'selected' | 'connecting' | 'complete' | 'error'

export class BlueprintMode extends Container implements IPresentationMode {
  private options: PresentationModeOptions
  private settings: PresentationModeSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }

  // Viewport for pan/zoom
  private viewport: Viewport
  private viewportMask: Graphics

  // Graphics layers - OUTSIDE viewport (static frame)
  private frameGraphics: Graphics
  private titleBlockContainer: Container

  // Graphics layers - INSIDE viewport (zoomable content)
  private backgroundGraphics: Graphics
  private gridGraphics: Graphics
  private componentsGraphics: Graphics
  private staticConnectionsGraphics: Graphics // Static connections (not animating)
  private connectionsGraphics: Graphics // Animated connections (redrawn each frame)
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

  // Redirect chain support
  private redirectChain: RedirectHop[] = []

  // Animation
  private ticker: Ticker
  private connectionSpeed: number = 0.015
  private dashOffset: number = 0
  private fpsText: Text | null = null
  private fpsUpdateCounter: number = 0

  // Dirty flags for selective redrawing
  private dirtyFlags = {
    frame: true,
    grid: true,
    components: true,
    connections: true,
  }

  // Grid caching
  private gridTexture: RenderTexture | null = null
  private gridSprite: Sprite | null = null

  // Text pooling
  private textPool: Text[] = []
  private activeTexts: Text[] = []
  private activeConnectionTexts: Text[] = [] // Separate tracking for connection labels
  private styleCache: Map<string, TextStyle> = new Map()

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  // Layout
  private readonly PADDING = 60
  private readonly GRID_SIZE = 20
  private readonly COMPONENT_WIDTH = 160
  private readonly COMPONENT_HEIGHT = 100
  private readonly REDIRECT_WIDTH = 120
  private readonly REDIRECT_HEIGHT = 70
  private readonly MAX_VISIBLE_REDIRECTS = 4
  private readonly COL_SPACING = 80 // Gap between columns
  private readonly ROW_SPACING = 50 // Gap between rows
  private readonly DOUBLE_BORDER_GAP = 4 // Gap for double-line borders

  // Blueprint colors
  private readonly BLUEPRINT_BG = 0x1a2744
  private readonly BLUEPRINT_LINE = 0x4a7ab8
  private readonly BLUEPRINT_ACCENT = 0x6cb4ee
  private readonly BLUEPRINT_TEXT = 0xc5ddf5

  constructor(options: PresentationModeOptions) {
    super()
    this.options = options

    // Create static frame layer (outside viewport - doesn't zoom)
    this.frameGraphics = new Graphics()
    this.addChild(this.frameGraphics)

    // Frame dimensions for clamping
    const frameInset = 20
    const titleBlockHeight = 45
    const contentWidth = options.width - frameInset * 2
    const contentHeight = options.height - frameInset * 2 - titleBlockHeight

    // Create viewport for pan/zoom (noTicker - we'll update manually)
    // Screen size = visible area (content area within frame)
    // World size = full drawing area (we use full canvas dimensions for drawing)
    this.viewport = new Viewport({
      screenWidth: contentWidth,
      screenHeight: contentHeight,
      worldWidth: options.width,
      worldHeight: options.height,
      noTicker: true,
      events: options.events,
    })

    // Position viewport at frame inner edge
    this.viewport.position.set(frameInset, frameInset)

    // Configure viewport interactions
    this.viewport
      .drag({ mouseButtons: 'middle' })
      .pinch()
      .wheel({ smooth: 5 })
      .decelerate({ friction: 0.95 })
      .clampZoom({ minScale: 1, maxScale: 1.5 })
      .clamp({ direction: 'all', underflow: 'center' })

    // Create mask to clip viewport content to the frame area (must be sibling, not child)
    this.viewportMask = new Graphics()
    this.viewportMask.rect(frameInset, frameInset, contentWidth, contentHeight)
    this.viewportMask.fill({ color: 0xffffff })
    this.addChild(this.viewportMask)

    this.addChild(this.viewport)
    this.viewport.mask = this.viewportMask

    // Create graphics layers inside viewport (zoomable content)
    this.backgroundGraphics = new Graphics()
    this.viewport.addChild(this.backgroundGraphics)

    this.gridGraphics = new Graphics()
    this.viewport.addChild(this.gridGraphics)

    this.staticConnectionsGraphics = new Graphics()
    this.viewport.addChild(this.staticConnectionsGraphics)

    this.connectionsGraphics = new Graphics()
    this.viewport.addChild(this.connectionsGraphics)

    this.componentsGraphics = new Graphics()
    this.viewport.addChild(this.componentsGraphics)

    this.annotationsGraphics = new Graphics()
    this.viewport.addChild(this.annotationsGraphics)

    this.labelsContainer = new Container()
    this.viewport.addChild(this.labelsContainer)

    // Create title block container (outside viewport - doesn't zoom)
    this.titleBlockContainer = new Container()
    this.addChild(this.titleBlockContainer)

    // Double-click to reset view
    this.viewport.on('dblclick', () => this.resetView())

    // Redraw on zoom to update scale indicator
    this.viewport.on('zoomed', () => {
      this.markDirty({ frame: true })
      this.drawFrame()
      this.dirtyFlags.frame = false
    })

    // Start animation ticker
    this.ticker = new Ticker()
    this.ticker.add(() => this.update())
    this.ticker.start()

    // Create FPS counter
    const fpsStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 10,
      fill: this.BLUEPRINT_TEXT,
      align: 'right',
    })
    this.fpsText = new Text({ text: 'FPS: --', style: fpsStyle })
    this.fpsText.anchor.set(1, 0)
    this.fpsText.x = options.width - 25
    this.fpsText.y = 5
    this.addChild(this.fpsText)

    this.draw()
  }

  // Reset viewport to default position and zoom
  public resetView() {
    this.viewport.animate({
      scale: 1,
      position: { x: 0, y: 0 },
      time: 300,
      ease: 'easeOutQuad',
    })
  }

  // Mark specific elements as needing redraw
  private markDirty(flags: Partial<typeof this.dirtyFlags>) {
    Object.assign(this.dirtyFlags, flags)
  }

  // Mark all elements as dirty (full redraw)
  private markAllDirty() {
    this.dirtyFlags.frame = true
    this.dirtyFlags.grid = true
    this.dirtyFlags.components = true
    this.dirtyFlags.connections = true
  }

  // Get a cached TextStyle or create a new one
  private getCachedStyle(key: string, createStyle: () => TextStyle): TextStyle {
    let style = this.styleCache.get(key)
    if (!style) {
      style = createStyle()
      this.styleCache.set(key, style)
    }
    return style
  }

  // Get a Text object from the pool or create a new one
  private getPooledText(content: string, style: TextStyle): Text {
    let text: Text
    if (this.textPool.length > 0) {
      text = this.textPool.pop()!
      text.text = content
      text.style = style
      text.alpha = 1
      text.anchor.set(0, 0)
      text.visible = true
    } else {
      text = new Text({ text: content, style })
    }
    this.activeTexts.push(text)
    return text
  }

  // Return all active texts to the pool
  private recycleTexts() {
    for (const text of this.activeTexts) {
      text.visible = false
      if (text.parent) {
        text.parent.removeChild(text)
      }
      this.textPool.push(text)
    }
    this.activeTexts = []
  }

  // Return only connection texts to the pool (for animation redraws)
  private recycleConnectionTexts() {
    for (const text of this.activeConnectionTexts) {
      text.visible = false
      if (text.parent) {
        text.parent.removeChild(text)
      }
      this.textPool.push(text)
    }
    this.activeConnectionTexts = []
  }

  // Get a pooled text for connection labels (tracked separately)
  private getPooledConnectionText(content: string, style: TextStyle): Text {
    let text: Text
    if (this.textPool.length > 0) {
      text = this.textPool.pop()!
      text.text = content
      text.style = style
      text.alpha = 1
      text.anchor.set(0, 0)
      text.visible = true
    } else {
      text = new Text({ text: content, style })
    }
    this.activeConnectionTexts.push(text)
    return text
  }

  // Invalidate grid cache (call on resize or color change)
  private invalidateGridCache() {
    if (this.gridTexture) {
      this.gridTexture.destroy(true)
      this.gridTexture = null
    }
    if (this.gridSprite) {
      this.gridSprite.destroy()
      this.gridSprite = null
    }
    this.dirtyFlags.grid = true
  }

  private draw() {
    if (this.dirtyFlags.frame) {
      this.drawFrame()
      this.dirtyFlags.frame = false
    }
    this.drawBackground()
    if (this.dirtyFlags.grid) {
      this.drawGrid()
      this.dirtyFlags.grid = false
    }
    // Connections are always redrawn during animation (dash offset changes)
    this.drawConnections()
    if (this.dirtyFlags.components) {
      this.drawComponents()
      this.dirtyFlags.components = false
    }
    this.drawAnnotations()
    // Clear connections dirty flag after full draw
    this.dirtyFlags.connections = false
  }

  // Draw static frame elements (outside viewport - doesn't zoom)
  private drawFrame() {
    const { width, height } = this.options

    this.frameGraphics.clear()
    this.titleBlockContainer.removeChildren()

    // Blueprint blue background (full canvas)
    this.frameGraphics.rect(0, 0, width, height)
    this.frameGraphics.fill({ color: this.BLUEPRINT_BG, alpha: 1 })

    // Border frame (double line for blueprint authenticity)
    const frameInset = 20
    const innerFrameInset = frameInset + 4

    // Outer frame
    this.frameGraphics.rect(frameInset, frameInset, width - frameInset * 2, height - frameInset * 2)
    this.frameGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.6, width: 2 })

    // Inner frame
    this.frameGraphics.rect(innerFrameInset, innerFrameInset, width - innerFrameInset * 2, height - innerFrameInset * 2)
    this.frameGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.3, width: 1 })

    // Registration marks (crosshairs in corners)
    this.drawFrameRegistrationMarks(frameInset, width, height)

    // Fold marks
    this.drawFrameFoldMarks(width, height)

    // Title block
    const titleBlockHeight = 45
    this.frameGraphics.rect(frameInset, height - frameInset - titleBlockHeight, width - frameInset * 2, titleBlockHeight)
    this.frameGraphics.fill({ color: this.BLUEPRINT_BG, alpha: 0.98 })
    this.frameGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.5, width: 1 })

    // Title block dividers
    const dividerX1 = frameInset + 200
    const dividerX2 = width - frameInset - 200
    this.frameGraphics.moveTo(dividerX1, height - frameInset - titleBlockHeight)
    this.frameGraphics.lineTo(dividerX1, height - frameInset)
    this.frameGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.3, width: 1 })

    this.frameGraphics.moveTo(dividerX2, height - frameInset - titleBlockHeight)
    this.frameGraphics.lineTo(dividerX2, height - frameInset)
    this.frameGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.3, width: 1 })

    // Draw title block text
    this.drawTitleBlockText(width, height)
  }

  private drawFrameRegistrationMarks(frameInset: number, width: number, height: number) {
    const markSize = 12
    const circleRadius = 6
    const positions = [
      { x: frameInset + 30, y: frameInset + 30 },
      { x: width - frameInset - 30, y: frameInset + 30 },
      { x: frameInset + 30, y: height - frameInset - 60 },
      { x: width - frameInset - 30, y: height - frameInset - 60 },
    ]

    for (const pos of positions) {
      this.frameGraphics.moveTo(pos.x - markSize, pos.y)
      this.frameGraphics.lineTo(pos.x + markSize, pos.y)
      this.frameGraphics.stroke({ color: this.BLUEPRINT_ACCENT, alpha: 0.7, width: 1 })

      this.frameGraphics.moveTo(pos.x, pos.y - markSize)
      this.frameGraphics.lineTo(pos.x, pos.y + markSize)
      this.frameGraphics.stroke({ color: this.BLUEPRINT_ACCENT, alpha: 0.7, width: 1 })

      this.frameGraphics.circle(pos.x, pos.y, circleRadius)
      this.frameGraphics.stroke({ color: this.BLUEPRINT_ACCENT, alpha: 0.5, width: 1 })
    }
  }

  private drawFrameFoldMarks(width: number, height: number) {
    const markSize = 8

    this.frameGraphics.moveTo(width / 2 - markSize, 0)
    this.frameGraphics.lineTo(width / 2, markSize)
    this.frameGraphics.lineTo(width / 2 + markSize, 0)
    this.frameGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.4, width: 1 })

    this.frameGraphics.moveTo(0, height / 2 - markSize)
    this.frameGraphics.lineTo(markSize, height / 2)
    this.frameGraphics.lineTo(0, height / 2 + markSize)
    this.frameGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.4, width: 1 })

    this.frameGraphics.moveTo(width, height / 2 - markSize)
    this.frameGraphics.lineTo(width - markSize, height / 2)
    this.frameGraphics.lineTo(width, height / 2 + markSize)
    this.frameGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.4, width: 1 })
  }

  private drawTitleBlockText(width: number, height: number) {
    const titleStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 11,
      fill: this.BLUEPRINT_TEXT,
    })

    const smallStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 9,
      fill: this.BLUEPRINT_LINE,
    })

    // Left section: Title and drawing number
    const title = new Text({ text: 'HTTP REQUEST SCHEMATIC', style: titleStyle })
    title.x = 40
    title.y = height - 58
    this.titleBlockContainer.addChild(title)

    const drawingNum = new Text({ text: `DWG: HTTP-${Date.now().toString(36).toUpperCase().slice(-6)}`, style: smallStyle })
    drawingNum.x = 40
    drawingNum.y = height - 42
    this.titleBlockContainer.addChild(drawingNum)

    // Middle section: Method and URL
    if (this.currentRequest) {
      const method = this.currentRequest.method
      const url = resolveVariables(this.currentRequest.url, this.resolvedVariables)
      const truncated = url.length > 50 ? url.slice(0, 47) + '...' : url

      const urlText = new Text({ text: `${method} ${truncated}`, style: titleStyle })
      urlText.x = 220
      urlText.y = height - 58
      this.titleBlockContainer.addChild(urlText)

      if (this.redirectChain.length > 0) {
        const redirectInfo = new Text({ text: `REDIRECTS: ${this.redirectChain.length}`, style: smallStyle })
        redirectInfo.x = 220
        redirectInfo.y = height - 42
        this.titleBlockContainer.addChild(redirectInfo)
      }
    }

    // Right section: Status, Scale, Rev
    const revText = new Text({ text: 'REV: A', style: smallStyle })
    revText.anchor.set(1, 0)
    revText.x = width - 40
    revText.y = height - 42
    this.titleBlockContainer.addChild(revText)

    // Show actual zoom level from viewport
    const zoomLevel = this.viewport.scale.x
    const scaleDisplay = zoomLevel >= 1
      ? `${zoomLevel.toFixed(1)}:1`
      : `1:${(1 / zoomLevel).toFixed(1)}`
    const scaleText = new Text({ text: `SCALE: ${scaleDisplay}`, style: smallStyle })
    scaleText.anchor.set(1, 0)
    scaleText.x = width - 100
    scaleText.y = height - 42
    this.titleBlockContainer.addChild(scaleText)

    if (this.responseData) {
      const statusText = new Text({
        text: `${this.responseData.status} ${this.responseData.statusText} | ${this.responseData.duration.toFixed(0)}ms | ${this.formatBytes(this.responseData.size)}`,
        style: titleStyle
      })
      statusText.anchor.set(1, 0)
      statusText.x = width - 40
      statusText.y = height - 58
      this.titleBlockContainer.addChild(statusText)
    } else {
      const pendingText = new Text({ text: 'AWAITING RESPONSE', style: titleStyle })
      pendingText.anchor.set(1, 0)
      pendingText.x = width - 40
      pendingText.y = height - 58
      this.titleBlockContainer.addChild(pendingText)
    }
  }

  // Draw zoomable content background (inside viewport)
  private drawBackground() {
    this.backgroundGraphics.clear()
    // Background is now drawn by drawFrame() outside viewport
    // This layer is kept for any content-area background effects if needed
  }

  private drawGrid() {
    const { width, height } = this.options

    this.gridGraphics.clear()

    const gridTop = this.PADDING
    const gridBottom = height - this.PADDING - 50
    const gridLeft = this.PADDING
    const gridRight = width - this.PADDING

    // Batch minor vertical lines
    for (let x = gridLeft; x < gridRight; x += this.GRID_SIZE) {
      if ((x - this.PADDING) % (this.GRID_SIZE * 5) !== 0) {
        this.gridGraphics.moveTo(x, gridTop)
        this.gridGraphics.lineTo(x, gridBottom)
      }
    }
    this.gridGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.08, width: 0.5 })

    // Batch major vertical lines
    for (let x = gridLeft; x < gridRight; x += this.GRID_SIZE * 5) {
      this.gridGraphics.moveTo(x, gridTop)
      this.gridGraphics.lineTo(x, gridBottom)
    }
    this.gridGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.2, width: 1 })

    // Batch minor horizontal lines
    for (let y = gridTop; y < gridBottom; y += this.GRID_SIZE) {
      if ((y - this.PADDING) % (this.GRID_SIZE * 5) !== 0) {
        this.gridGraphics.moveTo(gridLeft, y)
        this.gridGraphics.lineTo(gridRight, y)
      }
    }
    this.gridGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.08, width: 0.5 })

    // Batch major horizontal lines
    for (let y = gridTop; y < gridBottom; y += this.GRID_SIZE * 5) {
      this.gridGraphics.moveTo(gridLeft, y)
      this.gridGraphics.lineTo(gridRight, y)
    }
    this.gridGraphics.stroke({ color: this.BLUEPRINT_LINE, alpha: 0.2, width: 1 })
  }

  private drawComponents() {
    const { width, height } = this.options

    this.componentsGraphics.clear()

    // Recycle all texts back to pool before redrawing
    this.recycleTexts()

    if (this.state === 'idle') {
      const style = this.getCachedStyle('idle-text', () => new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 16,
        fill: this.BLUEPRINT_TEXT,
        align: 'center',
      }))
      const text = this.getPooledText('SELECT REQUEST TO VIEW SCHEMATIC', style)
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
    // Title block text is drawn by drawTitleBlockText() in the static frame layer
  }

  private drawComponent(comp: Component) {
    const { errorColor } = this.options
    const REDIRECT_COLOR = 0xf39c12 // Orange for redirects
    const gap = this.DOUBLE_BORDER_GAP

    // Border color based on type
    let borderColor = this.BLUEPRINT_LINE
    if (comp.type === 'redirect') {
      borderColor = REDIRECT_COLOR
    } else if (comp.type === 'response' && this.state === 'error') {
      borderColor = errorColor
    } else if (comp.type === 'response' && this.responseData) {
      borderColor = this.responseData.status >= 400 ? errorColor : 0x27ca40
    }

    // Double-line border (outer)
    this.componentsGraphics.rect(comp.x, comp.y, comp.width, comp.height)
    this.componentsGraphics.fill({ color: this.BLUEPRINT_BG, alpha: 0.95 })
    this.componentsGraphics.stroke({ color: borderColor, alpha: 0.8, width: 2 })

    // Double-line border (inner) - skip for small redirect components
    if (comp.type !== 'redirect') {
      this.componentsGraphics.rect(comp.x + gap, comp.y + gap, comp.width - gap * 2, comp.height - gap * 2)
      this.componentsGraphics.stroke({ color: borderColor, alpha: 0.3, width: 1 })
    }

    // Component header - smaller for redirects
    const headerHeight = comp.type === 'redirect' ? 18 : 24
    this.componentsGraphics.rect(comp.x, comp.y, comp.width, headerHeight)
    this.componentsGraphics.fill({ color: borderColor, alpha: 0.15 })

    // Header label
    const headerColor = comp.type === 'redirect' ? REDIRECT_COLOR : this.BLUEPRINT_ACCENT
    const headerStyleKey = comp.type === 'redirect' ? 'header-redirect' : 'header-normal'
    const headerStyle = this.getCachedStyle(headerStyleKey, () => new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: comp.type === 'redirect' ? 9 : 10,
      fill: headerColor,
      fontWeight: 'bold',
    }))
    const header = this.getPooledText(comp.label, headerStyle)
    header.x = comp.x + 8
    header.y = comp.y + (comp.type === 'redirect' ? 3 : 6)
    this.labelsContainer.addChild(header)

    // Reference designator (e.g., "A1", "B2")
    if (comp.refDesignator) {
      this.drawRefDesignator(comp, borderColor)
    }

    // Component data
    const dataFontSize = comp.type === 'redirect' ? 8 : 9
    const dataLineHeight = comp.type === 'redirect' ? 12 : 14
    const dataStartY = comp.type === 'redirect' ? 22 : 32
    const maxChars = comp.type === 'redirect' ? 16 : 25

    const dataStyleKey = comp.type === 'redirect' ? 'data-redirect' : 'data-normal'
    const dataStyle = this.getCachedStyle(dataStyleKey, () => new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: dataFontSize,
      fill: this.BLUEPRINT_TEXT,
    }))

    comp.data.forEach((line, i) => {
      const truncated = line.length > maxChars ? line.slice(0, maxChars - 2) + '..' : line
      const text = this.getPooledText(truncated, dataStyle)
      text.x = comp.x + 8
      text.y = comp.y + dataStartY + i * dataLineHeight
      this.labelsContainer.addChild(text)
    })

    // Draw ports with technical styling
    const portRadius = comp.type === 'redirect' ? 3 : 4
    const portOuterRadius = comp.type === 'redirect' ? 5 : 7
    const portColor = comp.type === 'redirect' ? REDIRECT_COLOR : this.BLUEPRINT_ACCENT

    for (const port of comp.ports) {
      const px = comp.x + port.x
      const py = comp.y + port.y

      // Port fill
      this.componentsGraphics.circle(px, py, portRadius)
      this.componentsGraphics.fill({ color: portColor, alpha: 1 })

      // Port outer ring
      this.componentsGraphics.circle(px, py, portOuterRadius)
      this.componentsGraphics.stroke({ color: portColor, alpha: 0.5, width: 1 })

      // Port crosshair (for larger ports)
      if (comp.type !== 'redirect') {
        const crossSize = 3
        this.componentsGraphics.moveTo(px - crossSize, py)
        this.componentsGraphics.lineTo(px + crossSize, py)
        this.componentsGraphics.stroke({ color: borderColor, alpha: 0.4, width: 1 })
        this.componentsGraphics.moveTo(px, py - crossSize)
        this.componentsGraphics.lineTo(px, py + crossSize)
        this.componentsGraphics.stroke({ color: borderColor, alpha: 0.4, width: 1 })
      }
    }

    // Center lines through component (blueprint standard)
    if (comp.type !== 'redirect') {
      this.drawCenterLines(comp, borderColor)
    }
  }

  private drawRefDesignator(comp: Component, color: number) {
    const circleRadius = 10
    const x = comp.x + comp.width - 15
    const y = comp.y + 12

    // Circle background
    this.componentsGraphics.circle(x, y, circleRadius)
    this.componentsGraphics.fill({ color: this.BLUEPRINT_BG, alpha: 0.9 })
    this.componentsGraphics.stroke({ color, alpha: 0.6, width: 1 })

    // Designator text
    const styleKey = `ref-designator-${color}`
    const style = this.getCachedStyle(styleKey, () => new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 8,
      fill: color,
      fontWeight: 'bold',
    }))
    const text = this.getPooledText(comp.refDesignator!, style)
    text.anchor.set(0.5)
    text.x = x
    text.y = y
    this.labelsContainer.addChild(text)
  }

  private drawCenterLines(comp: Component, color: number) {
    // Horizontal center line (dashed)
    const centerY = comp.y + comp.height / 2
    const dashLen = 4
    const gapLen = 8

    for (let x = comp.x + 10; x < comp.x + comp.width - 10; x += dashLen + gapLen) {
      this.componentsGraphics.moveTo(x, centerY)
      this.componentsGraphics.lineTo(Math.min(x + dashLen, comp.x + comp.width - 10), centerY)
      this.componentsGraphics.stroke({ color, alpha: 0.15, width: 1 })
    }

    // Vertical center line (dashed)
    const centerX = comp.x + comp.width / 2
    for (let y = comp.y + 28; y < comp.y + comp.height - 10; y += dashLen + gapLen) {
      this.componentsGraphics.moveTo(centerX, y)
      this.componentsGraphics.lineTo(centerX, Math.min(y + dashLen, comp.y + comp.height - 10))
      this.componentsGraphics.stroke({ color, alpha: 0.15, width: 1 })
    }
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
    const style = this.getCachedStyle('dimension-label', () => new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 8,
      fill: this.BLUEPRINT_LINE,
    }))
    const text = this.getPooledText(label, style)
    text.anchor.set(0.5, 0)
    text.x = (x1 + x2) / 2
    text.y = y1 + 3
    this.labelsContainer.addChild(text)
  }

  private drawConnections() {
    // Always clear animated connections layer
    this.connectionsGraphics.clear()
    // Recycle connection-specific texts before redrawing
    this.recycleConnectionTexts()

    // Only redraw static connections if dirty
    const needsStaticRedraw = this.dirtyFlags.connections
    if (needsStaticRedraw) {
      this.staticConnectionsGraphics.clear()
    }

    const REDIRECT_COLOR = 0xf39c12 // Orange for redirects

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

      // Use redirect color for redirect connections
      const lineColor = conn.isRedirect ? REDIRECT_COLOR : this.BLUEPRINT_ACCENT

      // Calculate orthogonal path segments
      const segments = this.calculateOrthogonalPath(
        startX, startY, fromPort.side,
        endX, endY, toPort.side
      )

      // Determine if this connection is static (no animation needed)
      const isStatic = !conn.animated

      // Static connections: draw once to static layer
      if (isStatic) {
        if (needsStaticRedraw) {
          this.drawOrthogonalPathToGraphics(this.staticConnectionsGraphics, segments, conn.progress, false, lineColor)

          // Draw corner markers at 90° turns
          if (conn.progress >= 1) {
            this.drawCornerMarkersToGraphics(this.staticConnectionsGraphics, segments, lineColor)
          }

          // Draw arrowhead if complete
          if (conn.progress >= 1 && segments.length > 0) {
            this.drawArrowheadToGraphics(this.staticConnectionsGraphics, segments, endX, endY, lineColor)
          }
        }
      } else {
        // Animated connections: draw to animated layer every frame
        this.drawOrthogonalPathToGraphics(this.connectionsGraphics, segments, conn.progress, true, lineColor)

        // Draw corner markers at 90° turns
        if (conn.progress >= 1) {
          this.drawCornerMarkersToGraphics(this.connectionsGraphics, segments, lineColor)
        }

        // Draw arrowhead if complete
        if (conn.progress >= 1 && segments.length > 0) {
          this.drawArrowheadToGraphics(this.connectionsGraphics, segments, endX, endY, lineColor)
        }

        // Animated dot at connection head
        if (conn.progress < 1) {
          const pos = this.getPositionAlongPath(segments, conn.progress)
          this.connectionsGraphics.circle(pos.x, pos.y, 4)
          this.connectionsGraphics.fill({ color: lineColor, alpha: 1 })
        }
      }

      // Connection label (at midpoint of path) - always goes to labels container
      if (conn.label && conn.progress > 0.5) {
        const midPoint = this.getPathMidpoint(segments)

        const styleKey = `conn-label-${lineColor}`
        const style = this.getCachedStyle(styleKey, () => new TextStyle({
          fontFamily: 'Fira Code, monospace',
          fontSize: 9,
          fill: lineColor,
        }))
        const text = this.getPooledConnectionText(conn.label, style)
        text.anchor.set(0.5)
        text.x = midPoint.x
        text.y = midPoint.y - 12
        text.alpha = (conn.progress - 0.5) * 2
        this.labelsContainer.addChild(text)
      }
    }
  }

  // Draw arrowhead to a specific graphics object
  private drawArrowheadToGraphics(
    graphics: Graphics,
    segments: { x1: number; y1: number; x2: number; y2: number }[],
    endX: number, endY: number, color: number
  ) {
    const lastSeg = segments[segments.length - 1]
    const angle = Math.atan2(lastSeg.y2 - lastSeg.y1, lastSeg.x2 - lastSeg.x1)
    const arrowSize = 8

    graphics.moveTo(endX, endY)
    graphics.lineTo(
      endX - arrowSize * Math.cos(angle - Math.PI / 6),
      endY - arrowSize * Math.sin(angle - Math.PI / 6)
    )
    graphics.lineTo(
      endX - arrowSize * Math.cos(angle + Math.PI / 6),
      endY - arrowSize * Math.sin(angle + Math.PI / 6)
    )
    graphics.closePath()
    graphics.fill({ color, alpha: 0.9 })
  }

  // Calculate orthogonal (Manhattan) path between two points
  private calculateOrthogonalPath(
    x1: number, y1: number, fromSide: 'left' | 'right' | 'top' | 'bottom',
    x2: number, y2: number, toSide: 'left' | 'right' | 'top' | 'bottom'
  ): { x1: number; y1: number; x2: number; y2: number }[] {
    const segments: { x1: number; y1: number; x2: number; y2: number }[] = []
    const offset = 20 // Offset from ports before turning

    // Simple case: same Y (horizontal line)
    if (Math.abs(y1 - y2) < 2 && (fromSide === 'right' && toSide === 'left')) {
      segments.push({ x1, y1, x2, y2 })
      return segments
    }

    // Simple case: same X (vertical line)
    if (Math.abs(x1 - x2) < 2 && ((fromSide === 'bottom' && toSide === 'top') || (fromSide === 'top' && toSide === 'bottom'))) {
      segments.push({ x1, y1, x2, y2 })
      return segments
    }

    // Complex routing based on port directions
    if (fromSide === 'right' && toSide === 'left') {
      // Right to left: horizontal -> vertical -> horizontal
      const midX = (x1 + x2) / 2
      segments.push({ x1, y1, x2: midX, y2: y1 }) // Horizontal
      segments.push({ x1: midX, y1, x2: midX, y2 }) // Vertical
      segments.push({ x1: midX, y1: y2, x2, y2 }) // Horizontal
    } else if (fromSide === 'top' && toSide === 'bottom') {
      // Top to bottom: vertical up -> horizontal -> vertical down
      const midY = (y1 + y2) / 2
      segments.push({ x1, y1, x2: x1, y2: midY }) // Vertical up
      segments.push({ x1, y1: midY, x2, y2: midY }) // Horizontal
      segments.push({ x1: x2, y1: midY, x2, y2 }) // Vertical down
    } else if (fromSide === 'bottom' && toSide === 'top') {
      // Bottom to top: vertical -> horizontal -> vertical
      const midY = (y1 + y2) / 2
      segments.push({ x1, y1, x2: x1, y2: midY }) // Vertical down
      segments.push({ x1, y1: midY, x2, y2: midY }) // Horizontal
      segments.push({ x1: x2, y1: midY, x2, y2 }) // Vertical down
    } else if (fromSide === 'bottom' && toSide === 'left') {
      // Bottom to left: vertical -> horizontal
      segments.push({ x1, y1, x2: x1, y2: y2 }) // Vertical
      segments.push({ x1, y1: y2, x2, y2 }) // Horizontal
    } else if (fromSide === 'bottom' && toSide === 'bottom') {
      // Bottom to bottom: down -> horizontal -> up
      const bottomY = Math.max(y1, y2) + offset
      segments.push({ x1, y1, x2: x1, y2: bottomY }) // Down
      segments.push({ x1, y1: bottomY, x2, y2: bottomY }) // Horizontal
      segments.push({ x1: x2, y1: bottomY, x2, y2 }) // Up
    } else if (fromSide === 'right' && toSide === 'top') {
      // Right to top: horizontal -> vertical
      segments.push({ x1, y1, x2, y2: y1 }) // Horizontal
      segments.push({ x1: x2, y1, x2, y2 }) // Vertical
    } else if (fromSide === 'right' && toSide === 'bottom') {
      // Right to bottom: horizontal out -> vertical down -> horizontal in
      const rightX = x1 + offset
      segments.push({ x1, y1, x2: rightX, y2: y1 }) // Horizontal out
      segments.push({ x1: rightX, y1, x2: rightX, y2 }) // Vertical
      segments.push({ x1: rightX, y1: y2, x2, y2 }) // Horizontal in
    } else {
      // Fallback: simple L-shape
      segments.push({ x1, y1, x2, y2: y1 }) // Horizontal first
      segments.push({ x1: x2, y1, x2, y2 }) // Then vertical
    }

    return segments
  }

  // Draw orthogonal path with progress animation to a specific graphics object
  private drawOrthogonalPathToGraphics(
    graphics: Graphics,
    segments: { x1: number; y1: number; x2: number; y2: number }[],
    progress: number,
    animated: boolean,
    color: number
  ) {
    // Calculate total path length
    let totalLength = 0
    for (const seg of segments) {
      totalLength += Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1)
    }

    // Draw segments up to current progress
    let drawnLength = 0
    const targetLength = totalLength * progress

    for (const seg of segments) {
      const segLength = Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1)

      if (drawnLength >= targetLength) break

      const remainingToDraw = targetLength - drawnLength
      const segProgress = Math.min(1, remainingToDraw / segLength)

      const endX = seg.x1 + (seg.x2 - seg.x1) * segProgress
      const endY = seg.y1 + (seg.y2 - seg.y1) * segProgress

      // Draw dashed segment
      this.drawDashedLineSegmentToGraphics(graphics, seg.x1, seg.y1, endX, endY, animated, color)

      drawnLength += segLength
    }
  }

  // Draw a single dashed line segment (H or V only) to a specific graphics object
  private drawDashedLineSegmentToGraphics(
    graphics: Graphics,
    x1: number, y1: number, x2: number, y2: number,
    animated: boolean, color: number
  ) {
    const dashLength = 8
    const gapLength = 4
    const totalLength = Math.abs(x2 - x1) + Math.abs(y2 - y1)

    if (totalLength < 1) return

    const isHorizontal = Math.abs(y2 - y1) < 1
    const direction = isHorizontal ? (x2 > x1 ? 1 : -1) : (y2 > y1 ? 1 : -1)

    const offset = animated ? this.dashOffset : 0
    let currentPos = offset % (dashLength + gapLength)

    // Batch all dashes before stroking
    while (currentPos < totalLength) {
      const dashStart = currentPos
      const dashEnd = Math.min(currentPos + dashLength, totalLength)

      if (dashEnd > dashStart) {
        let sx: number, sy: number, ex: number, ey: number

        if (isHorizontal) {
          sx = x1 + dashStart * direction
          sy = y1
          ex = x1 + dashEnd * direction
          ey = y1
        } else {
          sx = x1
          sy = y1 + dashStart * direction
          ex = x1
          ey = y1 + dashEnd * direction
        }

        graphics.moveTo(sx, sy)
        graphics.lineTo(ex, ey)
      }

      currentPos += dashLength + gapLength
    }
    // Single stroke call for all dashes in this segment
    graphics.stroke({ color, alpha: 0.8, width: 2 })
  }

  // Draw corner markers at 90° turns to a specific graphics object
  private drawCornerMarkersToGraphics(
    graphics: Graphics,
    segments: { x1: number; y1: number; x2: number; y2: number }[],
    color: number
  ) {
    // Batch all corner markers before a single stroke
    for (let i = 0; i < segments.length - 1; i++) {
      const seg1 = segments[i]

      // Corner is at end of seg1 / start of seg2
      const cornerX = seg1.x2
      const cornerY = seg1.y2

      // Draw small tick mark at corner
      const tickSize = 3
      graphics.circle(cornerX, cornerY, tickSize)
    }
    // Single stroke for all corners
    if (segments.length > 1) {
      graphics.stroke({ color, alpha: 0.6, width: 1 })
    }
  }

  // Get position along orthogonal path at given progress (0-1)
  private getPositionAlongPath(
    segments: { x1: number; y1: number; x2: number; y2: number }[],
    progress: number
  ): { x: number; y: number } {
    let totalLength = 0
    for (const seg of segments) {
      totalLength += Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1)
    }

    const targetLength = totalLength * progress
    let currentLength = 0

    for (const seg of segments) {
      const segLength = Math.abs(seg.x2 - seg.x1) + Math.abs(seg.y2 - seg.y1)

      if (currentLength + segLength >= targetLength) {
        const segProgress = (targetLength - currentLength) / segLength
        return {
          x: seg.x1 + (seg.x2 - seg.x1) * segProgress,
          y: seg.y1 + (seg.y2 - seg.y1) * segProgress,
        }
      }

      currentLength += segLength
    }

    // Return end point if progress is 1
    const lastSeg = segments[segments.length - 1]
    return { x: lastSeg?.x2 || 0, y: lastSeg?.y2 || 0 }
  }

  // Get midpoint of orthogonal path
  private getPathMidpoint(
    segments: { x1: number; y1: number; x2: number; y2: number }[]
  ): { x: number; y: number } {
    return this.getPositionAlongPath(segments, 0.5)
  }

  private drawAnnotations() {
    this.annotationsGraphics.clear()
    // Annotations are drawn with components
  }

  private update() {
    // Update viewport (for deceleration/animations)
    this.viewport.update(this.ticker.deltaMS)

    // Throttle FPS counter updates to every 10 frames
    if (this.fpsText && ++this.fpsUpdateCounter >= 10) {
      this.fpsText.text = `FPS: ${Math.round(this.ticker.FPS)}`
      this.fpsUpdateCounter = 0
    }

    // Check if any connections are animating
    const hasAnimatingConnections = this.connections.some(c => c.animated && c.progress < 1)
    const hasAnimatedConnections = this.connections.some(c => c.animated)

    // Update connection progress
    if (hasAnimatingConnections) {
      for (const conn of this.connections) {
        if (conn.animated && conn.progress < 1) {
          conn.progress = Math.min(1, conn.progress + this.connectionSpeed)
        }
      }
    }

    // Only redraw if there are animated connections (dash offset animation)
    if (hasAnimatedConnections) {
      this.dashOffset += 0.5
      // Only redraw connections, not entire scene
      this.drawConnections()
    }
  }

  private setupComponents() {
    const { width } = this.options

    this.components = []
    this.connections = []

    if (!this.currentRequest) return

    // Calculate layout based on redirect count
    const redirectCount = this.redirectChain.length
    const showCollapsedRedirects = redirectCount > this.MAX_VISIBLE_REDIRECTS
    const visibleRedirectCount = showCollapsedRedirects ? 1 : redirectCount

    // Grid-based horizontal layout
    // Top row (if redirects): REDIRECTS above main flow
    // Main row: CLIENT - REQUEST - SERVER
    // Bottom row: RESPONSE below server

    const hasRedirects = visibleRedirectCount > 0
    const redirectRowY = this.PADDING + 60
    const mainRowY = hasRedirects
      ? redirectRowY + this.REDIRECT_HEIGHT + this.ROW_SPACING
      : this.PADDING + 80

    // Calculate horizontal positions (centered)
    const mainComponents = 3 // Client, Request, Server
    const totalMainWidth = mainComponents * this.COMPONENT_WIDTH + (mainComponents - 1) * this.COL_SPACING
    const startX = Math.max(this.PADDING, (width - totalMainWidth) / 2)

    const clientX = startX
    const requestX = startX + this.COMPONENT_WIDTH + this.COL_SPACING
    const serverX = startX + 2 * (this.COMPONENT_WIDTH + this.COL_SPACING)

    // Client component [A1]
    this.components.push({
      x: clientX,
      y: mainRowY,
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
      refDesignator: 'A1',
    })

    // Request component [A2]
    this.components.push({
      x: requestX,
      y: mainRowY,
      width: this.COMPONENT_WIDTH,
      height: this.COMPONENT_HEIGHT,
      label: `REQUEST [${this.currentRequest.method}]`,
      type: 'request',
      ports: [
        { x: 0, y: this.COMPONENT_HEIGHT / 2, side: 'left' },
        { x: this.COMPONENT_WIDTH, y: this.COMPONENT_HEIGHT / 2, side: 'right' },
        { x: this.COMPONENT_WIDTH / 2, y: 0, side: 'top' }, // Top port for redirects
      ],
      data: [
        this.truncateUrl(resolveVariables(this.currentRequest.url, this.resolvedVariables), 22),
        `Body: ${this.currentRequest.body ? 'Yes' : 'No'}`,
        `Content-Type: ${this.getContentType()}`,
      ],
      refDesignator: 'A2',
    })

    // Server component [A3]
    this.components.push({
      x: serverX,
      y: mainRowY,
      width: this.COMPONENT_WIDTH,
      height: this.COMPONENT_HEIGHT,
      label: 'SERVER',
      type: 'server',
      ports: [
        { x: 0, y: this.COMPONENT_HEIGHT / 2, side: 'left' },
        { x: this.COMPONENT_WIDTH / 2, y: 0, side: 'top' }, // Top port for redirects
        { x: this.COMPONENT_WIDTH / 2, y: this.COMPONENT_HEIGHT, side: 'bottom' },
      ],
      data: [
        this.getHostname(),
        'Protocol: HTTP/1.1',
        'Connection: Keep-Alive',
      ],
      refDesignator: 'A3',
    })

    // Add redirect components if any (on TOP row, above main flow)
    if (visibleRedirectCount > 0) {
      // Calculate redirect positions (centered between request and server)
      const redirectTotalWidth = visibleRedirectCount * this.REDIRECT_WIDTH + (visibleRedirectCount - 1) * 40

      if (showCollapsedRedirects) {
        const firstHop = this.redirectChain[0]
        const lastHop = this.redirectChain[redirectCount - 1]

        this.components.push({
          x: (requestX + serverX) / 2 - this.REDIRECT_WIDTH / 2,
          y: redirectRowY,
          width: this.REDIRECT_WIDTH + 20,
          height: this.REDIRECT_HEIGHT,
          label: `${redirectCount}x REDIRECT`,
          type: 'redirect',
          ports: [
            { x: 0, y: this.REDIRECT_HEIGHT / 2, side: 'left' },
            { x: this.REDIRECT_WIDTH + 20, y: this.REDIRECT_HEIGHT / 2, side: 'right' },
          ],
          data: [
            `${firstHop.status} → ${lastHop.status}`,
            this.extractHost(lastHop.url),
          ],
          isRedirect: true,
          redirectIndex: -1,
          refDesignator: 'R1',
        })
      } else {
        // Individual redirect nodes in a horizontal row above main flow
        let currentX = Math.max(requestX, (requestX + serverX) / 2 - redirectTotalWidth / 2)

        for (let i = 0; i < redirectCount; i++) {
          const hop = this.redirectChain[i]

          this.components.push({
            x: currentX,
            y: redirectRowY,
            width: this.REDIRECT_WIDTH,
            height: this.REDIRECT_HEIGHT,
            label: `REDIRECT [${hop.status}]`,
            type: 'redirect',
            ports: [
              { x: 0, y: this.REDIRECT_HEIGHT / 2, side: 'left' },
              { x: this.REDIRECT_WIDTH, y: this.REDIRECT_HEIGHT / 2, side: 'right' },
              { x: this.REDIRECT_WIDTH / 2, y: this.REDIRECT_HEIGHT, side: 'bottom' },
            ],
            data: [
              `→ ${this.extractHost(hop.url)}`,
            ],
            isRedirect: true,
            redirectIndex: i,
            refDesignator: `R${i + 1}`,
          })

          currentX += this.REDIRECT_WIDTH + 40
        }
      }
    }

    // Setup connections with orthogonal routing
    this.setupConnections(visibleRedirectCount, showCollapsedRedirects)
  }

  private setupConnections(visibleRedirectCount: number, showCollapsedRedirects: boolean) {
    const serverIndex = 2 // Server is always index 2 in main row
    const firstRedirectIndex = 3 // Redirects start at index 3

    // Client -> Request (straight horizontal)
    this.connections.push({
      from: { component: 0, port: 0 },
      to: { component: 1, port: 0 },
      progress: 1,
      label: 'INIT',
      animated: false,
    })

    if (visibleRedirectCount > 0) {
      if (showCollapsedRedirects) {
        // Request -> Redirect (up to top row)
        this.connections.push({
          from: { component: 1, port: 2 }, // Top port of request
          to: { component: firstRedirectIndex, port: 0 }, // Left port of redirect
          progress: 1,
          label: '',
          animated: false,
          isRedirect: true,
        })

        // Redirect -> Server (down to main row)
        this.connections.push({
          from: { component: firstRedirectIndex, port: 1 }, // Right port of redirect
          to: { component: serverIndex, port: 1 }, // Top port of server
          progress: 1,
          label: '',
          animated: false,
          isRedirect: true,
        })
      } else {
        // Request -> First redirect (up to top row)
        this.connections.push({
          from: { component: 1, port: 2 }, // Top port of request
          to: { component: firstRedirectIndex, port: 2 }, // Bottom port of first redirect
          progress: 1,
          label: '',
          animated: false,
          isRedirect: true,
        })

        // Redirect chain connections (horizontal on top row)
        for (let i = 0; i < visibleRedirectCount - 1; i++) {
          this.connections.push({
            from: { component: firstRedirectIndex + i, port: 1 }, // Right port
            to: { component: firstRedirectIndex + i + 1, port: 0 }, // Left port
            progress: 1,
            label: '',
            animated: false,
            isRedirect: true,
          })
        }

        // Last redirect -> Server (down to main row)
        this.connections.push({
          from: { component: firstRedirectIndex + visibleRedirectCount - 1, port: 2 }, // Bottom port of last redirect
          to: { component: serverIndex, port: 1 }, // Top port of server
          progress: 1,
          label: '',
          animated: false,
          isRedirect: true,
        })
      }
    } else {
      // Direct: Request -> Server (straight horizontal)
      this.connections.push({
        from: { component: 1, port: 1 },
        to: { component: serverIndex, port: 0 },
        progress: 0,
        label: 'HTTP',
        animated: true,
      })
    }
  }

  private extractHost(url: string): string {
    try {
      const parsed = new URL(url)
      const host = parsed.hostname
      return host.length > 14 ? host.slice(0, 12) + '..' : host
    } catch {
      return url.slice(0, 12)
    }
  }

  private setupResponseComponent() {
    const { height } = this.options

    if (!this.responseData && !this.errorMessage) return

    // Find the server component to position response below it
    const serverComp = this.components.find(c => c.type === 'server')
    if (!serverComp) return

    // Response component - positioned directly below server (vertical alignment)
    const status = this.responseData?.status || 0
    const statusText = this.responseData?.statusText || 'ERROR'

    const responseX = serverComp.x
    const responseY = serverComp.y + this.COMPONENT_HEIGHT + this.ROW_SPACING

    // Check if response would go off screen
    const clampedY = Math.min(responseY, height - this.PADDING - this.COMPONENT_HEIGHT - 60)

    this.components.push({
      x: responseX,
      y: clampedY,
      width: this.COMPONENT_WIDTH,
      height: this.COMPONENT_HEIGHT,
      label: `RESPONSE [${status}]`,
      type: 'response',
      ports: [
        { x: this.COMPONENT_WIDTH / 2, y: 0, side: 'top' },
      ],
      data: this.errorMessage
        ? ['ERROR', this.errorMessage.slice(0, 22)]
        : [
            `Status: ${status} ${statusText}`,
            `Size: ${this.formatBytes(this.responseData?.size || 0)}`,
            `Time: ${this.responseData?.duration.toFixed(0)}ms`,
          ],
      refDesignator: 'C1',
    })

    // Connection: Server -> Response (using server's bottom port, vertical line)
    const serverIndex = this.components.findIndex(c => c.type === 'server')
    this.connections.push({
      from: { component: serverIndex, port: 2 }, // Bottom port of server (index 2)
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
    this.redirectChain = []
    this.components = []
    this.connections = []

    if (!request) {
      this.state = 'idle'
    } else {
      this.state = 'selected'
      this.setupComponents()
    }

    this.markAllDirty()
    this.draw()
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    switch (phase) {
      case 'idle':
        this.state = this.currentRequest ? 'selected' : 'idle'
        this.responseData = null
        this.errorMessage = null
        this.setupComponents()
        this.markAllDirty()
        break

      case 'authenticating':
      case 'fetching':
        this.state = 'connecting'
        // Animate the request server connection
        if (this.connections.length > 0) {
          this.connections[this.connections.length - 1].animated = true
          this.connections[this.connections.length - 1].progress = 0
        }
        this.markDirty({ connections: true })
        break

      case 'success':
        this.state = 'complete'
        this.markDirty({ frame: true })
        break

      case 'error':
        this.state = 'error'
        this.markDirty({ frame: true })
        break
    }

    this.draw()
  }

  public setResponse(status: number, statusText: string, size: number, duration: number, extendedData?: ExtendedResponseData) {
    this.responseData = { status, statusText, size, duration }

    // Handle redirect chain from extended data
    if (extendedData?.redirectChain && extendedData.redirectChain.length > 0) {
      this.redirectChain = extendedData.redirectChain
      // Rebuild components to include redirects
      this.setupComponents()
      this.markAllDirty()
    } else {
      this.markDirty({ frame: true, components: true, connections: true })
    }

    this.setupResponseComponent()
    this.draw()
  }

  public setError(message: string) {
    this.errorMessage = message
    this.setupResponseComponent()
    this.markDirty({ frame: true, components: true, connections: true })
    this.draw()
  }

  public setRedirectChain(redirectChain: RedirectHop[]) {
    this.redirectChain = redirectChain

    // Rebuild components to include redirects
    this.setupComponents()
    if (this.responseData || this.errorMessage) {
      this.setupResponseComponent()
    }
    this.markAllDirty()
    this.draw()
  }

  public resize(width: number, height: number) {
    this.options.width = width
    this.options.height = height

    // Frame dimensions for viewport
    const frameInset = 20
    const titleBlockHeight = 45
    const contentWidth = width - frameInset * 2
    const contentHeight = height - frameInset * 2 - titleBlockHeight

    // Update viewport dimensions (screen = content area, world = full canvas)
    this.viewport.resize(contentWidth, contentHeight, width, height)

    // Update viewport mask
    this.viewportMask.clear()
    this.viewportMask.rect(frameInset, frameInset, contentWidth, contentHeight)
    this.viewportMask.fill({ color: 0xffffff })

    // Update FPS counter position
    if (this.fpsText) {
      this.fpsText.x = width - 25
    }

    // Invalidate grid cache on resize
    this.invalidateGridCache()

    this.setupComponents()
    if (this.responseData || this.errorMessage) {
      this.setupResponseComponent()
    }
    this.markAllDirty()
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
    this.invalidateGridCache()
    this.markAllDirty()
    this.draw()
  }

  public updateSettings(settings: Partial<PresentationModeSettings>) {
    this.settings = { ...this.settings, ...settings }
  }

  public setEventCallback(callback: (event: PresentationModeEvent) => void) {
    this.onEvent = callback
  }

  public handleInput(): boolean {
    // Enter key can still execute request
    if (this.state === 'selected') {
      this.onEvent?.('execute-request')
      return true
    }
    return false
  }

  public handleInputClick(): boolean {
    // Clicks are used for viewport pan/zoom, not for opening response
    return false
  }

  public isWaitingForInput(): boolean {
    return this.state === 'selected'
  }

  public onJsonRevealClosed() {
    // No special handling needed
  }

  public destroy() {
    this.ticker.stop()
    this.ticker.destroy()
    this.frameGraphics.destroy()
    this.titleBlockContainer.destroy()
    this.backgroundGraphics.destroy()
    this.gridGraphics.destroy()
    this.componentsGraphics.destroy()
    this.staticConnectionsGraphics.destroy()
    this.connectionsGraphics.destroy()
    this.annotationsGraphics.destroy()
    this.labelsContainer.destroy()
    this.viewport.destroy()

    // Clean up grid cache
    this.invalidateGridCache()

    // Clean up text pool
    for (const text of this.textPool) {
      text.destroy()
    }
    this.textPool = []
    for (const text of this.activeTexts) {
      text.destroy()
    }
    this.activeTexts = []
    for (const text of this.activeConnectionTexts) {
      text.destroy()
    }
    this.activeConnectionTexts = []
    this.styleCache.clear()

    super.destroy()
  }
}
