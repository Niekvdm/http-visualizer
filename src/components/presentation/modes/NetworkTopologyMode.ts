import { Container, Graphics, Text, TextStyle, Ticker } from 'pixi.js'
import type { ExecutionPhase, ParsedRequest, ResponseTiming, RedirectHop, SizeBreakdown, TlsInfo } from '@/types'
import type { 
  IPresentationMode, 
  PresentationModeOptions, 
  PresentationModeSettings,
  PresentationModeEvent 
} from './IPresentationMode'
import { resolveVariables } from '@/utils/variableResolver'

/**
 * Network Topology Mode - Visualizes client/server/proxy relationships
 * with detailed timing waterfall, redirect chain, and size breakdown.
 * 
 * Shows:
 * - Client node (computer icon) on the left
 * - Optional Auth/Proxy node in the middle
 * - Server node on the right
 * - Animated packet flow between nodes
 * - Timing waterfall panel
 * - Redirect chain visualization
 * - TLS and size info
 */

interface NetworkNode {
  x: number
  y: number
  label: string
  sublabel: string
  type: 'client' | 'auth' | 'server'
  status: 'idle' | 'active' | 'success' | 'error'
  color: number
  pulsePhase: number
}

interface Packet {
  fromNode: NetworkNode
  toNode: NetworkNode
  progress: number
  color: number
  size: number
  label: string
}

interface FullResponseData {
  status: number
  statusText: string
  size: number
  duration: number
  timing?: ResponseTiming
  redirectChain?: RedirectHop[]
  tls?: TlsInfo
  sizeBreakdown?: SizeBreakdown
}

type NetworkState = 'idle' | 'selected' | 'authenticating' | 'fetching' | 'complete' | 'error'

export class NetworkTopologyMode extends Container implements IPresentationMode {
  private options: PresentationModeOptions
  private settings: PresentationModeSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }

  // Graphics layers
  private backgroundGraphics: Graphics
  private connectionsGraphics: Graphics
  private nodesGraphics: Graphics
  private packetsGraphics: Graphics
  private detailsGraphics: Graphics
  private labelsContainer: Container
  private clientNode: NetworkNode | null = null
  private authNode: NetworkNode | null = null
  private serverNode: NetworkNode | null = null

  // Packets
  private packets: Packet[] = []

  // State
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private hasAuth: boolean = false
  private state: NetworkState = 'idle'
  private responseData: FullResponseData | null = null
  private errorMessage: string | null = null

  // Animation
  private ticker: Ticker
  private packetSpeed: number = 0.015
  private time: number = 0

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  // Layout constants
  private readonly NODE_RADIUS = 45
  private readonly NODE_SPACING = 180
  private readonly PADDING = 40
  private readonly DETAILS_PANEL_HEIGHT = 140

  constructor(options: PresentationModeOptions) {
    super()
    this.options = options

    // Create graphics layers
    this.backgroundGraphics = new Graphics()
    this.addChild(this.backgroundGraphics)

    this.connectionsGraphics = new Graphics()
    this.addChild(this.connectionsGraphics)

    this.nodesGraphics = new Graphics()
    this.addChild(this.nodesGraphics)

    this.packetsGraphics = new Graphics()
    this.addChild(this.packetsGraphics)

    this.detailsGraphics = new Graphics()
    this.addChild(this.detailsGraphics)

    this.labelsContainer = new Container()
    this.addChild(this.labelsContainer)

    // Start animation ticker
    this.ticker = new Ticker()
    this.ticker.add((ticker) => this.update(ticker.deltaMS))
    this.ticker.start()

    this.draw()
  }

  private draw() {
    this.drawBackground()
    this.setupNodes()
    this.drawConnections()
    this.drawNodes()
    this.drawPackets()
    this.drawLabels()
    this.drawDetailsPanel()
  }

  private drawBackground() {
    const { width, height, bgColor, primaryColor } = this.options
    
    this.backgroundGraphics.clear()
    this.backgroundGraphics.rect(0, 0, width, height)
    this.backgroundGraphics.fill({ color: bgColor, alpha: 0.95 })

    // Draw radial gradient effect from center
    const centerX = width / 2
    const centerY = (height - this.DETAILS_PANEL_HEIGHT) / 2
    const maxRadius = Math.max(width, height)
    
    for (let r = maxRadius; r > 0; r -= 50) {
      const alpha = 0.01 * (1 - r / maxRadius)
      this.backgroundGraphics.circle(centerX, centerY, r)
      this.backgroundGraphics.stroke({ color: primaryColor, alpha, width: 1 })
    }
  }

  private setupNodes() {
    const { width, height, primaryColor, secondaryColor } = this.options
    const centerY = (height - this.DETAILS_PANEL_HEIGHT) / 2

    // Calculate node positions based on whether auth is present
    const nodeCount = this.hasAuth ? 3 : 2
    const totalWidth = (nodeCount - 1) * this.NODE_SPACING
    const startX = (width - totalWidth) / 2

    // Client node
    this.clientNode = {
      x: startX,
      y: centerY,
      label: 'CLIENT',
      sublabel: 'Your App',
      type: 'client',
      status: this.state === 'idle' ? 'idle' : 'active',
      color: primaryColor,
      pulsePhase: 0,
    }

    // Auth node (if present)
    if (this.hasAuth) {
      this.authNode = {
        x: startX + this.NODE_SPACING,
        y: centerY,
        label: 'AUTH',
        sublabel: this.currentRequest?.auth?.type?.toUpperCase() || 'OAuth',
        type: 'auth',
        status: this.state === 'authenticating' ? 'active' : 'idle',
        color: secondaryColor,
        pulsePhase: Math.PI / 2,
      }
    } else {
      this.authNode = null
    }

    // Server node
    this.serverNode = {
      x: this.hasAuth ? startX + this.NODE_SPACING * 2 : startX + this.NODE_SPACING,
      y: centerY,
      label: 'SERVER',
      sublabel: this.getServerHost(),
      type: 'server',
      status: this.getServerStatus(),
      color: primaryColor,
      pulsePhase: Math.PI,
    }
  }

  private getServerHost(): string {
    if (!this.currentRequest) return 'API Server'
    try {
      const url = resolveVariables(this.currentRequest.url, this.resolvedVariables)
      const parsed = new URL(url)
      return parsed.hostname.length > 18 ? parsed.hostname.slice(0, 15) + '...' : parsed.hostname
    } catch {
      return 'API Server'
    }
  }

  private getServerStatus(): NetworkNode['status'] {
    switch (this.state) {
      case 'complete':
        return 'success'
      case 'error':
        return 'error'
      case 'fetching':
        return 'active'
      default:
        return 'idle'
    }
  }

  private drawConnections() {
    const { primaryColor, secondaryColor } = this.options
    
    this.connectionsGraphics.clear()

    const nodes = [this.clientNode, this.authNode, this.serverNode].filter(Boolean) as NetworkNode[]

    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i]
      const to = nodes[i + 1]

      const isActive = this.state !== 'idle' && this.state !== 'selected'
      const lineColor = from.type === 'auth' || to.type === 'auth' ? secondaryColor : primaryColor
      const alpha = isActive ? 0.6 : 0.3

      // Draw dashed line
      const dashLength = 10
      const gapLength = 5
      const dx = to.x - from.x
      const dy = to.y - from.y
      const distance = Math.sqrt(dx * dx + dy * dy) - this.NODE_RADIUS * 2
      const angle = Math.atan2(dy, dx)

      let currentDist = this.NODE_RADIUS

      while (currentDist < distance + this.NODE_RADIUS) {
        const dashEnd = Math.min(currentDist + dashLength, distance + this.NODE_RADIUS)
        const x1 = from.x + Math.cos(angle) * currentDist
        const y1 = from.y + Math.sin(angle) * currentDist
        const x2 = from.x + Math.cos(angle) * dashEnd
        const y2 = from.y + Math.sin(angle) * dashEnd

        this.connectionsGraphics.moveTo(x1, y1)
        this.connectionsGraphics.lineTo(x2, y2)
        this.connectionsGraphics.stroke({ color: lineColor, alpha, width: 2 })

        currentDist += dashLength + gapLength
      }
    }
  }

  private drawNodes() {
    const { bgColor, errorColor } = this.options
    
    this.nodesGraphics.clear()

    const nodes = [this.clientNode, this.authNode, this.serverNode].filter(Boolean) as NetworkNode[]

    for (const node of nodes) {
      let statusColor = node.color
      if (node.status === 'success') statusColor = 0x27ca40
      if (node.status === 'error') statusColor = errorColor

      // Draw outer glow for active/success/error
      if (node.status !== 'idle') {
        const pulseScale = 1 + Math.sin(this.time * 0.003 + node.pulsePhase) * 0.1
        const glowRadius = this.NODE_RADIUS * 1.3 * pulseScale
        this.nodesGraphics.circle(node.x, node.y, glowRadius)
        this.nodesGraphics.fill({ color: statusColor, alpha: 0.15 })
      }

      // Draw node circle
      this.nodesGraphics.circle(node.x, node.y, this.NODE_RADIUS)
      this.nodesGraphics.fill({ color: bgColor, alpha: 0.95 })
      this.nodesGraphics.stroke({ color: statusColor, width: 3, alpha: 0.9 })

      // Draw icon
      this.drawNodeIcon(node, statusColor)
    }
  }

  private drawNodeIcon(node: NetworkNode, color: number) {
    const { x, y } = node
    const iconSize = 22

    switch (node.type) {
      case 'client':
        this.nodesGraphics.roundRect(x - iconSize / 2, y - iconSize / 2 - 4, iconSize, iconSize * 0.7, 2)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        this.nodesGraphics.moveTo(x, y + iconSize * 0.2)
        this.nodesGraphics.lineTo(x, y + iconSize * 0.4)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        this.nodesGraphics.moveTo(x - iconSize * 0.3, y + iconSize * 0.4)
        this.nodesGraphics.lineTo(x + iconSize * 0.3, y + iconSize * 0.4)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        break

      case 'auth':
        this.nodesGraphics.roundRect(x - iconSize * 0.35, y - iconSize * 0.1, iconSize * 0.7, iconSize * 0.6, 3)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        this.nodesGraphics.arc(x, y - iconSize * 0.1, iconSize * 0.25, Math.PI, 0)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        break

      case 'server':
        const serverHeight = iconSize * 0.8
        const serverWidth = iconSize * 0.7
        for (let i = 0; i < 3; i++) {
          const segY = y - serverHeight / 2 + i * (serverHeight / 3)
          this.nodesGraphics.roundRect(x - serverWidth / 2, segY, serverWidth, serverHeight / 3 - 2, 2)
          this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
          this.nodesGraphics.circle(x + serverWidth / 2 - 6, segY + serverHeight / 6, 2)
          this.nodesGraphics.fill({ color, alpha: 0.8 })
        }
        break
    }
  }

  private drawPackets() {
    this.packetsGraphics.clear()

    for (const packet of this.packets) {
      if (packet.progress <= 0 || packet.progress >= 1) continue

      const x = packet.fromNode.x + (packet.toNode.x - packet.fromNode.x) * packet.progress
      const y = packet.fromNode.y + (packet.toNode.y - packet.fromNode.y) * packet.progress

      this.packetsGraphics.circle(x, y, packet.size * 2)
      this.packetsGraphics.fill({ color: packet.color, alpha: 0.3 })
      this.packetsGraphics.circle(x, y, packet.size)
      this.packetsGraphics.fill({ color: packet.color, alpha: 1 })

      // Packet trail
      const trailLength = 5
      for (let i = 1; i <= trailLength; i++) {
        const trailProgress = packet.progress - i * 0.02
        if (trailProgress > 0) {
          const trailX = packet.fromNode.x + (packet.toNode.x - packet.fromNode.x) * trailProgress
          const trailY = packet.fromNode.y + (packet.toNode.y - packet.fromNode.y) * trailProgress
          const trailAlpha = 0.5 * (1 - i / trailLength)
          const trailSize = packet.size * (1 - i / trailLength * 0.5)
          this.packetsGraphics.circle(trailX, trailY, trailSize)
          this.packetsGraphics.fill({ color: packet.color, alpha: trailAlpha })
        }
      }
    }
  }

  private drawLabels() {
    const { textColor } = this.options
    
    this.labelsContainer.removeChildren()

    if (this.state === 'idle') {
      const style = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 16,
        fill: textColor,
        align: 'center',
      })
      const text = new Text({ text: 'Select a request to view network topology', style })
      text.anchor.set(0.5)
      text.x = this.options.width / 2
      text.y = (this.options.height - this.DETAILS_PANEL_HEIGHT) / 2
      this.labelsContainer.addChild(text)
      return
    }

    const nodes = [this.clientNode, this.authNode, this.serverNode].filter(Boolean) as NetworkNode[]

    for (const node of nodes) {
      const labelStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 12,
        fill: node.color,
        fontWeight: 'bold',
      })
      const label = new Text({ text: node.label, style: labelStyle })
      label.anchor.set(0.5)
      label.x = node.x
      label.y = node.y + this.NODE_RADIUS + 12
      this.labelsContainer.addChild(label)

      const sublabelStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 9,
        fill: textColor,
      })
      const sublabel = new Text({ text: node.sublabel, style: sublabelStyle })
      sublabel.anchor.set(0.5)
      sublabel.x = node.x
      sublabel.y = node.y + this.NODE_RADIUS + 26
      sublabel.alpha = 0.7
      this.labelsContainer.addChild(sublabel)
    }

    // Request info at top
    if (this.currentRequest && this.state !== 'idle') {
      const method = this.currentRequest.method
      const url = this.truncateUrl(resolveVariables(this.currentRequest.url, this.resolvedVariables), 55)
      
      const requestStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 10,
        fill: textColor,
      })
      const requestText = new Text({ text: `${method} ${url}`, style: requestStyle })
      requestText.anchor.set(0.5)
      requestText.x = this.options.width / 2
      requestText.y = 20
      requestText.alpha = 0.8
      this.labelsContainer.addChild(requestText)
    }
  }

  private drawDetailsPanel() {
    const { width, height, primaryColor, bgColor, textColor, errorColor } = this.options
    
    this.detailsGraphics.clear()

    // Only show details panel when we have response data
    if (!this.responseData && !this.errorMessage) return

    const panelY = height - this.DETAILS_PANEL_HEIGHT
    const panelPadding = 15

    // Panel background
    this.detailsGraphics.rect(0, panelY, width, this.DETAILS_PANEL_HEIGHT)
    this.detailsGraphics.fill({ color: bgColor, alpha: 0.98 })

    // Top border
    this.detailsGraphics.moveTo(0, panelY)
    this.detailsGraphics.lineTo(width, panelY)
    this.detailsGraphics.stroke({ color: primaryColor, alpha: 0.3, width: 1 })

    if (this.errorMessage) {
      // Error display
      const errorStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 12,
        fill: errorColor,
      })
      const errorText = new Text({ text: `ERROR: ${this.errorMessage}`, style: errorStyle })
      errorText.x = panelPadding
      errorText.y = panelY + panelPadding
      this.labelsContainer.addChild(errorText)
      return
    }

    if (!this.responseData) return

    // Layout: [Timing Waterfall] [Redirects/TLS] [Size]
    const sectionWidth = (width - panelPadding * 4) / 3

    // Section 1: Timing Waterfall
    this.drawTimingWaterfall(panelPadding, panelY + panelPadding, sectionWidth)

    // Section 2: Redirects & TLS
    this.drawRedirectsAndTls(panelPadding * 2 + sectionWidth, panelY + panelPadding, sectionWidth)

    // Section  Breakdown
    this.drawSizeBreakdown(panelPadding * 3 + sectionWidth * 2, panelY + panelPadding, sectionWidth)
  }

  private drawTimingWaterfall(x: number, y: number, width: number) {
    const { primaryColor, secondaryColor, textColor } = this.options
    const timing = this.responseData?.timing

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 10,
      fill: primaryColor,
      fontWeight: 'bold',
    })
    const title = new Text({ text: 'TIMING', style: titleStyle })
    title.x = x
    title.y = y
    this.labelsContainer.addChild(title)

    if (!timing) {
      const noData = new Text({ 
        text: `Total: ${this.responseData?.duration?.toFixed(0) || 0}ms`, 
        style: new TextStyle({ fontFamily: 'Fira Code, monospace', fontSize: 9, fill: textColor }) 
      })
      noData.x = x
      noData.y = y + 18
      noData.alpha = 0.7
      this.labelsContainer.addChild(noData)
      return
    }

    // Timing bars
    const barHeight = 12
    const barSpacing = 16
    let barY = y + 18
    const maxTime = timing.total || 1

    const timingItems: Array<{ label: string; value: number | undefined; color: number }> = [
      { label: 'DNS', value: timing.dns, color: 0x4CAF50 },
      { label: 'TCP', value: timing.tcp, color: 0x2196F3 },
      { label: 'TLS', value: timing.tls, color: 0x9C27B0 },
      { label: 'TTFB', value: timing.ttfb, color: 0xFF9800 },
      { label: 'Download', value: timing.download, color: 0x00BCD4 },
    ]

    for (const item of timingItems) {
      if (item.value === undefined || item.value === 0) continue

      const barWidth = Math.max(2, (item.value / maxTime) * (width - 60))

      // Label
      const labelStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 8,
        fill: textColor,
      })
      const label = new Text({ text: item.label, style: labelStyle })
      label.x = x
      label.y = barY
      label.alpha = 0.7
      this.labelsContainer.addChild(label)

      // Bar
      this.detailsGraphics.roundRect(x + 45, barY, barWidth, barHeight - 2, 2)
      this.detailsGraphics.fill({ color: item.color, alpha: 0.8 })

      // Value
      const valueStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 8,
        fill: textColor,
      })
      const value = new Text({ text: `${item.value.toFixed(0)}ms`, style: valueStyle })
      value.x = x + 50 + barWidth
      value.y = barY
      value.alpha = 0.6
      this.labelsContainer.addChild(value)

      barY += barSpacing
    }

    // Total
    const totalStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 9,
      fill: primaryColor,
      fontWeight: 'bold',
    })
    const total = new Text({ text: `Total: ${timing.total.toFixed(0)}ms`, style: totalStyle })
    total.x = x
    total.y = barY + 4
    this.labelsContainer.addChild(total)
  }

  private drawRedirectsAndTls(x: number, y: number, width: number) {
    const { primaryColor, secondaryColor, textColor, errorColor } = this.options
    const redirectChain = this.responseData?.redirectChain
    const tls = this.responseData?.tls

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 10,
      fill: primaryColor,
      fontWeight: 'bold',
    })
    const title = new Text({ text: 'REDIRECTS & TLS', style: titleStyle })
    title.x = x
    title.y = y
    this.labelsContainer.addChild(title)

    let infoY = y + 18

    // Redirect chain
    if (redirectChain && redirectChain.length > 0) {
      const chainStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 9,
        fill: textColor,
      })

      // Show redirect chain as: 301 → 302 → 200
      const chainParts = redirectChain.map(hop => hop.status.toString())
      chainParts.push(this.responseData?.status?.toString() || '200')
      const chainText = chainParts.join(' → ')

      const chain = new Text({ text: `Chain: ${chainText}`, style: chainStyle })
      chain.x = x
      chain.y = infoY
      chain.alpha = 0.8
      this.labelsContainer.addChild(chain)
      infoY += 14

      // Show each hop URL (truncated)
      for (const hop of redirectChain.slice(0, 2)) {
        const hopStyle = new TextStyle({
          fontFamily: 'Fira Code, monospace',
          fontSize: 8,
          fill: secondaryColor,
        })
        const hopUrl = this.truncateUrl(hop.url, 35)
        const hopText = new Text({ text: `${hop.status}: ${hopUrl}`, style: hopStyle })
        hopText.x = x + 8
        hopText.y = infoY
        hopText.alpha = 0.6
        this.labelsContainer.addChild(hopText)
        infoY += 12
      }
      if (redirectChain.length > 2) {
        const moreStyle = new TextStyle({
          fontFamily: 'Fira Code, monospace',
          fontSize: 8,
          fill: textColor,
        })
        const more = new Text({ text: `... +${redirectChain.length - 2} more`, style: moreStyle })
        more.x = x + 8
        more.y = infoY
        more.alpha = 0.5
        this.labelsContainer.addChild(more)
        infoY += 12
      }
    } else {
      const noRedirect = new Text({ 
        text: 'No redirects', 
        style: new TextStyle({ fontFamily: 'Fira Code, monospace', fontSize: 9, fill: textColor }) 
      })
      noRedirect.x = x
      noRedirect.y = infoY
      noRedirect.alpha = 0.5
      this.labelsContainer.addChild(noRedirect)
      infoY += 14
    }

    // TLS info
    infoY += 6
    if (tls) {
      // Draw lock icon
      this.detailsGraphics.roundRect(x, infoY, 10, 8, 2)
      this.detailsGraphics.stroke({ color: 0x27ca40, width: 1, alpha: 0.8 })
      this.detailsGraphics.arc(x + 5, infoY, 4, Math.PI, 0)
      this.detailsGraphics.stroke({ color: 0x27ca40, width: 1, alpha: 0.8 })

      const tlsStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 9,
        fill: 0x27ca40,
      })
      const tlsText = new Text({ text: tls.protocol || 'HTTPS', style: tlsStyle })
      tlsText.x = x + 14
      tlsText.y = infoY
      this.labelsContainer.addChild(tlsText)
    } else {
      const noTls = new Text({ 
        text: 'HTTP (no TLS)', 
        style: new TextStyle({ fontFamily: 'Fira Code, monospace', fontSize: 9, fill: textColor }) 
      })
      noTls.x = x
      noTls.y = infoY
      noTls.alpha = 0.5
      this.labelsContainer.addChild(noTls)
    }
  }

  private drawSizeBreakdown(x: number, y: number, width: number) {
    const { primaryColor, textColor } = this.options
    const breakdown = this.responseData?.sizeBreakdown

    // Title
    const titleStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 10,
      fill: primaryColor,
      fontWeight: 'bold',
    })
    const title = new Text({ text: 'SIZE', style: titleStyle })
    title.x = x
    title.y = y
    this.labelsContainer.addChild(title)

    let infoY = y + 18

    if (!breakdown) {
      const size = new Text({ 
        text: `Total: ${this.formatBytes(this.responseData?.size || 0)}`, 
        style: new TextStyle({ fontFamily: 'Fira Code, monospace', fontSize: 9, fill: textColor }) 
      })
      size.x = x
      size.y = infoY
      size.alpha = 0.7
      this.labelsContainer.addChild(size)
      return
    }

    const infoStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 9,
      fill: textColor,
    })

    // Headers
    const headers = new Text({ text: `Headers: ${this.formatBytes(breakdown.headers)}`, style: infoStyle })
    headers.x = x
    headers.y = infoY
    headers.alpha = 0.7
    this.labelsContainer.addChild(headers)
    infoY += 14

    // Body
    const body = new Text({ text: `Body: ${this.formatBytes(breakdown.body)}`, style: infoStyle })
    body.x = x
    body.y = infoY
    body.alpha = 0.7
    this.labelsContainer.addChild(body)
    infoY += 14

    // Compression
    if (breakdown.encoding && breakdown.encoding !== 'identity') {
      const compressionColor = 0x4CAF50
      const compStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 9,
        fill: compressionColor,
      })
      const ratio = breakdown.compressionRatio 
        ? `(${((1 - breakdown.compressionRatio) * 100).toFixed(0)}% saved)`
        : ''
      const compression = new Text({ text: `${breakdown.encoding.toUpperCase()} ${ratio}`, style: compStyle })
      compression.x = x
      compression.y = infoY
      this.labelsContainer.addChild(compression)
      infoY += 14
    }

    // Total
    const totalStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 9,
      fill: primaryColor,
      fontWeight: 'bold',
    })
    const total = new Text({ text: `Total: ${this.formatBytes(breakdown.total)}`, style: totalStyle })
    total.x = x
    total.y = infoY + 4
    this.labelsContainer.addChild(total)
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  private update(deltaMS: number) {
    this.time += deltaMS

    let needsRedraw = false
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const packet = this.packets[i]
      if (packet.progress < 1) {
        packet.progress += this.packetSpeed
        needsRedraw = true
        
        if (packet.progress >= 1) {
          setTimeout(() => {
            const index = this.packets.indexOf(packet)
            if (index > -1) this.packets.splice(index, 1)
          }, 100)
        }
      }
    }

    if (this.state !== 'idle') {
      this.drawNodes()
      this.drawPackets()
    }
  }

  private createPacket(from: NetworkNode, to: NetworkNode, label: string, color?: number) {
    const packet: Packet = {
      fromNode: from,
      toNode: to,
      progress: 0,
      color: color || this.options.primaryColor,
      size: 6,
      label,
    }
    this.packets.push(packet)
  }

  // IPresentationMode implementation

  public setRequest(request: ParsedRequest | null, variables: Record<string, string> = {}) {
    this.currentRequest = request
    this.resolvedVariables = variables
    this.hasAuth = request?.auth?.type !== undefined && request.auth.type !== 'none'
    this.responseData = null
    this.errorMessage = null
    this.packets = []

    if (!request) {
      this.state = 'idle'
    } else {
      this.state = 'selected'
    }

    this.draw()
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    switch (phase) {
      case 'idle':
        this.state = this.currentRequest ? 'selected' : 'idle'
        this.packets = []
        this.responseData = null
        this.errorMessage = null
        break

      case 'authenticating':
        this.state = 'authenticating'
        if (this.clientNode && this.authNode) {
          this.createPacket(this.clientNode, this.authNode, 'AUTH', this.options.secondaryColor)
        }
        break

      case 'fetching':
        this.state = 'fetching'
        if (this.hasAuth && this.authNode && this.clientNode) {
          setTimeout(() => {
            if (this.authNode && this.clientNode) {
              this.createPacket(this.authNode, this.clientNode, 'TOKEN', this.options.secondaryColor)
            }
          }, 300)
        }
        const delay = this.hasAuth ? 600 : 0
        setTimeout(() => {
          if (this.clientNode && this.serverNode) {
            this.createPacket(this.clientNode, this.serverNode, 'REQUEST', this.options.primaryColor)
          }
        }, delay)
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
    
    if (this.serverNode && this.clientNode) {
      const color = status >= 400 ? this.options.errorColor : 0x27ca40
      this.createPacket(this.serverNode, this.clientNode, 'RESPONSE', color)
    }

    this.draw()
  }

  /**
   * Set full response data with timing, redirects, TLS, and size breakdown
   */
  public setFullResponse(data: FullResponseData) {
    this.responseData = data
    
    if (this.serverNode && this.clientNode) {
      const color = data.status >= 400 ? this.options.errorColor : 0x27ca40
      this.createPacket(this.serverNode, this.clientNode, 'RESPONSE', color)
    }

    this.draw()
  }

  public setError(message: string) {
    this.errorMessage = message
    
    if (this.serverNode && this.clientNode) {
      this.createPacket(this.serverNode, this.clientNode, 'ERROR', this.options.errorColor)
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
    return url.slice(0, maxLength - 3) + '...'
  }

  public destroy() {
    this.ticker.stop()
    this.ticker.destroy()
    this.backgroundGraphics.destroy()
    this.connectionsGraphics.destroy()
    this.nodesGraphics.destroy()
    this.packetsGraphics.destroy()
    this.detailsGraphics.destroy()
    this.labelsContainer.destroy()
    super.destroy()
  }
}
