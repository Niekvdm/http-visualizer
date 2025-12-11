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
 * Network Topology Mode - Visualizes client/server/proxy relationships
 * 
 * Shows:
 * - Client node (computer icon) on the left
 * - Optional Auth/Proxy node in the middle
 * - Server node on the right
 * - Animated packet flow between nodes
 * - Status indicators and labels
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
  private labelsContainer: Container

  // Nodes
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
  private responseData: { status: number; statusText: string; size: number; duration: number } | null = null
  private errorMessage: string | null = null

  // Animation
  private ticker: Ticker
  private packetSpeed: number = 0.015
  private time: number = 0

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  // Layout constants
  private readonly NODE_RADIUS = 50
  private readonly NODE_SPACING = 200
  private readonly PADDING = 60

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
  }

  private drawBackground() {
    const { width, height, bgColor, primaryColor } = this.options
    
    this.backgroundGraphics.clear()
    this.backgroundGraphics.rect(0, 0, width, height)
    this.backgroundGraphics.fill({ color: bgColor, alpha: 0.95 })

    // Draw radial gradient effect from center
    const centerX = width / 2
    const centerY = height / 2
    const maxRadius = Math.max(width, height)
    
    for (let r = maxRadius; r > 0; r -= 50) {
      const alpha = 0.01 * (1 - r / maxRadius)
      this.backgroundGraphics.circle(centerX, centerY, r)
      this.backgroundGraphics.stroke({ color: primaryColor, alpha, width: 1 })
    }
  }

  private setupNodes() {
    const { width, height, primaryColor, secondaryColor } = this.options
    const centerY = height / 2

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
      return parsed.hostname.length > 20 ? parsed.hostname.slice(0, 17) + '...' : parsed.hostname
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

      // Draw connection line with gradient effect
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
      const startX = from.x + Math.cos(angle) * this.NODE_RADIUS
      const startY = from.y + Math.sin(angle) * this.NODE_RADIUS

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
    const { primaryColor, secondaryColor, bgColor, errorColor, textColor } = this.options
    
    this.nodesGraphics.clear()

    const nodes = [this.clientNode, this.authNode, this.serverNode].filter(Boolean) as NetworkNode[]

    for (const node of nodes) {
      // Get status color
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

      // Draw icon based on node type
      this.drawNodeIcon(node, statusColor)
    }
  }

  private drawNodeIcon(node: NetworkNode, color: number) {
    const { x, y } = node
    const iconSize = 24

    switch (node.type) {
      case 'client':
        // Draw computer/monitor icon
        this.nodesGraphics.roundRect(x - iconSize / 2, y - iconSize / 2 - 4, iconSize, iconSize * 0.7, 2)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        // Stand
        this.nodesGraphics.moveTo(x, y + iconSize * 0.2)
        this.nodesGraphics.lineTo(x, y + iconSize * 0.4)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        this.nodesGraphics.moveTo(x - iconSize * 0.3, y + iconSize * 0.4)
        this.nodesGraphics.lineTo(x + iconSize * 0.3, y + iconSize * 0.4)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        break

      case 'auth':
        // Draw lock/shield icon
        this.nodesGraphics.roundRect(x - iconSize * 0.35, y - iconSize * 0.1, iconSize * 0.7, iconSize * 0.6, 3)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        // Lock top
        this.nodesGraphics.arc(x, y - iconSize * 0.1, iconSize * 0.25, Math.PI, 0)
        this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
        break

      case 'server':
        // Draw server/database icon
        const serverHeight = iconSize * 0.8
        const serverWidth = iconSize * 0.7
        for (let i = 0; i < 3; i++) {
          const segY = y - serverHeight / 2 + i * (serverHeight / 3)
          this.nodesGraphics.roundRect(x - serverWidth / 2, segY, serverWidth, serverHeight / 3 - 2, 2)
          this.nodesGraphics.stroke({ color, width: 2, alpha: 0.8 })
          // LED indicator
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

      // Calculate packet position
      const x = packet.fromNode.x + (packet.toNode.x - packet.fromNode.x) * packet.progress
      const y = packet.fromNode.y + (packet.toNode.y - packet.fromNode.y) * packet.progress

      // Draw packet as glowing circle
      this.packetsGraphics.circle(x, y, packet.size * 2)
      this.packetsGraphics.fill({ color: packet.color, alpha: 0.3 })
      this.packetsGraphics.circle(x, y, packet.size)
      this.packetsGraphics.fill({ color: packet.color, alpha: 1 })

      // Draw packet trail
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
      // Show placeholder message
      const style = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 16,
        fill: textColor,
        align: 'center',
      })
      const text = new Text({ text: 'Select a request to view network topology', style })
      text.anchor.set(0.5)
      text.x = this.options.width / 2
      text.y = this.options.height / 2
      this.labelsContainer.addChild(text)
      return
    }

    const nodes = [this.clientNode, this.authNode, this.serverNode].filter(Boolean) as NetworkNode[]

    for (const node of nodes) {
      // Main label
      const labelStyle = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 14,
        fill: node.color,
        fontWeight: 'bold',
      })
      const label = new Text({ text: node.label, style: labelStyle })
      label.anchor.set(0.5)
      label.x = node.x
      label.y = node.y + this.NODE_RADIUS + 15
      this.labelsContainer.addChild(label)

      // Sublabel
      const sublabelStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 10,
        fill: textColor,
      })
      const sublabel = new Text({ text: node.sublabel, style: sublabelStyle })
      sublabel.anchor.set(0.5)
      sublabel.x = node.x
      sublabel.y = node.y + this.NODE_RADIUS + 32
      sublabel.alpha = 0.7
      this.labelsContainer.addChild(sublabel)
    }

    // Draw status info at bottom
    if (this.responseData || this.errorMessage) {
      const statusStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 12,
        fill: this.state === 'error' ? this.options.errorColor : 0x27ca40,
      })
      let statusText = ''
      if (this.responseData) {
        statusText = `${this.responseData.status} ${this.responseData.statusText} • ${this.responseData.duration.toFixed(0)}ms`
      } else if (this.errorMessage) {
        statusText = `ERROR: ${this.errorMessage.slice(0, 50)}`
      }
      const status = new Text({ text: statusText, style: statusStyle })
      status.anchor.set(0.5)
      status.x = this.options.width / 2
      status.y = this.options.height - 40
      this.labelsContainer.addChild(status)
    }

    // Draw request info at top
    if (this.currentRequest && this.state !== 'idle') {
      const method = this.currentRequest.method
      const url = this.truncateUrl(resolveVariables(this.currentRequest.url, this.resolvedVariables), 60)
      
      const requestStyle = new TextStyle({
        fontFamily: 'Fira Code, monospace',
        fontSize: 11,
        fill: textColor,
      })
      const requestText = new Text({ text: `${method} ${url}`, style: requestStyle })
      requestText.anchor.set(0.5)
      requestText.x = this.options.width / 2
      requestText.y = 30
      requestText.alpha = 0.8
      this.labelsContainer.addChild(requestText)
    }
  }

  private update(deltaMS: number) {
    this.time += deltaMS

    // Update packet positions
    let needsRedraw = false
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const packet = this.packets[i]
      if (packet.progress < 1) {
        packet.progress += this.packetSpeed
        needsRedraw = true
        
        if (packet.progress >= 1) {
          // Remove completed packet after a short delay
          setTimeout(() => {
            const index = this.packets.indexOf(packet)
            if (index > -1) this.packets.splice(index, 1)
          }, 100)
        }
      }
    }

    // Redraw for pulse animation and packets
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
        // Send auth response packet if we were authenticating
        if (this.hasAuth && this.authNode && this.clientNode) {
          setTimeout(() => {
            if (this.authNode && this.clientNode) {
              this.createPacket(this.authNode, this.clientNode, 'TOKEN', this.options.secondaryColor)
            }
          }, 300)
        }
        // Send request packet to server
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
    
    // Send response packet back
    if (this.serverNode && this.clientNode) {
      const color = status >= 400 ? this.options.errorColor : 0x27ca40
      this.createPacket(this.serverNode, this.clientNode, 'RESPONSE', color)
    }

    this.draw()
  }

  public setError(message: string) {
    this.errorMessage = message
    
    // Send error packet back
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
    this.labelsContainer.destroy()
    super.destroy()
  }
}

