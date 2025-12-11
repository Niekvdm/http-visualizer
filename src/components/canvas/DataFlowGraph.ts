import { Container, Ticker } from 'pixi.js'
import { TerminalNode } from './TerminalNode'
import { ConnectionLine } from './ConnectionLine'
import { ResponseBodyCard } from './ResponseBodyCard'
import { resolveVariables } from '@/utils/variableResolver'
import type { ExecutionPhase, ParsedRequest, AuthConfig } from '@/types'

export interface DataFlowGraphOptions {
  width: number
  height: number
  primaryColor: number
  secondaryColor: number
  bgColor: number
  textColor: number
  errorColor: number
}

// Timeline states now include 'selected' for when a request is picked but not yet executing
type TimelineState = 'idle' | 'selected' | 'authenticating' | 'fetching' | 'complete' | 'error'

export class DataFlowGraph extends Container {
  private options: DataFlowGraphOptions
  private authNode: TerminalNode | null = null
  private requestNode: TerminalNode | null = null
  private responseNode: TerminalNode | null = null
  private responseBodyCard: ResponseBodyCard | null = null
  private authToRequestLine: ConnectionLine | null = null
  private requestToResponseLine: ConnectionLine | null = null
  private responseToBodyLine: ConnectionLine | null = null
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private hasAuth: boolean = false
  private timelineState: TimelineState = 'idle'
  private hasResponseBody: boolean = false
  private ticker: Ticker | null = null

  // Layout constants
  private readonly nodeWidth = 220
  private readonly nodeHeight = 110
  private readonly bodyCardWidth = 220
  private readonly bodyCardHeight = 120
  private readonly horizontalSpacing = 60
  private readonly verticalSpacing = 40
  private readonly bodySpacing = 20

  constructor(options: DataFlowGraphOptions) {
    super()
    this.options = options
    this.createNodes()
    this.startTicker()
  }

  private startTicker() {
    this.ticker = new Ticker()
    this.ticker.add(() => {
      // Update connection lines to follow animated node positions
      this.updateConnectionLinesFromNodes()
    })
    this.ticker.start()
  }

  private updateConnectionLinesFromNodes() {
    const { nodeWidth, nodeHeight, bodyCardWidth } = this

    // Auth to Request line - follows actual node positions during animation
    if (this.authToRequestLine?.visible && this.authNode && this.requestNode) {
      this.authToRequestLine.updatePositions(
        this.authNode.x + nodeWidth / 2,
        this.authNode.y + nodeHeight,
        this.requestNode.x + nodeWidth / 2,
        this.requestNode.y
      )
    }

    // Request to Response line - follows actual node positions during animation
    if (this.requestToResponseLine?.visible && this.requestNode && this.responseNode) {
      this.requestToResponseLine.updatePositions(
        this.requestNode.x + nodeWidth,
        this.requestNode.y + nodeHeight / 2,
        this.responseNode.x,
        this.responseNode.y + nodeHeight / 2
      )
    }

    // Response to Body line - follows actual node positions during animation
    if (this.responseToBodyLine?.visible && this.responseNode && this.responseBodyCard) {
      this.responseToBodyLine.updatePositions(
        this.responseNode.x + nodeWidth / 2,
        this.responseNode.y + nodeHeight,
        this.responseBodyCard.x + bodyCardWidth / 2,
        this.responseBodyCard.y
      )
    }
  }

  private getLayoutPositions(state: TimelineState) {
    const { width, height } = this.options
    const { nodeWidth, nodeHeight, bodyCardWidth, bodyCardHeight, horizontalSpacing, verticalSpacing, bodySpacing } = this

    // Calculate whether body will be visible for this state
    const bodyVisible = this.hasResponseBody && (state === 'complete' || state === 'error')

    // Different layouts based on timeline state and whether auth is present
    switch (state) {
      case 'idle': {
        // No cards visible when idle (no request selected)
        const requestX = (width - nodeWidth) / 2
        const requestY = (height - nodeHeight) / 2
        return {
          auth: { x: requestX, y: requestY - nodeHeight - verticalSpacing, visible: false },
          request: { x: requestX, y: requestY, visible: false },
          response: { x: requestX + nodeWidth + horizontalSpacing, y: requestY, visible: false },
          responseBody: { x: requestX + nodeWidth + horizontalSpacing, y: requestY + nodeHeight + bodySpacing, visible: false },
        }
      }

      case 'selected': {
        if (this.hasAuth) {
          // AUTH above REQUEST in vertical stack, centered
          const stackHeight = nodeHeight * 2 + verticalSpacing
          const stackTop = (height - stackHeight) / 2
          const centerX = (width - nodeWidth) / 2
          return {
            auth: { x: centerX, y: stackTop, visible: true },
            request: { x: centerX, y: stackTop + nodeHeight + verticalSpacing, visible: true },
            response: { x: centerX + nodeWidth + horizontalSpacing, y: stackTop + nodeHeight + verticalSpacing, visible: false },
            responseBody: { x: centerX + nodeWidth + horizontalSpacing, y: stackTop + nodeHeight * 2 + verticalSpacing + bodySpacing, visible: false },
          }
        } else {
          // No auth - just REQUEST centered
          const requestX = (width - nodeWidth) / 2
          const requestY = (height - nodeHeight) / 2
          return {
            auth: { x: requestX, y: requestY - nodeHeight - verticalSpacing, visible: false },
            request: { x: requestX, y: requestY, visible: true },
            response: { x: requestX + nodeWidth + horizontalSpacing, y: requestY, visible: false },
            responseBody: { x: requestX + nodeWidth + horizontalSpacing, y: requestY + nodeHeight + bodySpacing, visible: false },
          }
        }
      }

      case 'authenticating': {
        // AUTH above REQUEST, both visible, centered (same as selected with auth)
        const stackHeight = nodeHeight * 2 + verticalSpacing
        const stackTop = (height - stackHeight) / 2
        const centerX = (width - nodeWidth) / 2
        return {
          auth: { x: centerX, y: stackTop, visible: true },
          request: { x: centerX, y: stackTop + nodeHeight + verticalSpacing, visible: true },
          response: { x: centerX + nodeWidth + horizontalSpacing, y: stackTop + nodeHeight + verticalSpacing, visible: false },
          responseBody: { x: centerX + nodeWidth + horizontalSpacing, y: stackTop + nodeHeight * 2 + verticalSpacing + bodySpacing, visible: false },
        }
      }

      case 'fetching':
      case 'complete':
      case 'error': {
        if (this.hasAuth) {
          // Layout:
          //   AUTH
          //     |
          //   REQUEST ──► RESPONSE
          //                   |
          //                 BODY
          
          // Left column: AUTH above REQUEST
          // Right column: RESPONSE with BODY below
          const leftColumnHeight = nodeHeight * 2 + verticalSpacing
          const rightColumnHeight = bodyVisible 
            ? nodeHeight + bodySpacing + bodyCardHeight 
            : nodeHeight
          
          const totalWidth = nodeWidth * 2 + horizontalSpacing
          const startX = (width - totalWidth) / 2
          
          // Center the entire layout vertically based on max column height
          const totalHeight = Math.max(leftColumnHeight, rightColumnHeight)
          const startY = (height - totalHeight) / 2
          
          // Left column positions (AUTH above REQUEST)
          const authY = startY
          const requestY = startY + nodeHeight + verticalSpacing
          
          // Right column: RESPONSE aligns horizontally with REQUEST
          const responseY = requestY
          
          return {
            auth: { x: startX, y: authY, visible: true },
            request: { x: startX, y: requestY, visible: true },
            response: { x: startX + nodeWidth + horizontalSpacing, y: responseY, visible: true },
            responseBody: { 
              x: startX + nodeWidth + horizontalSpacing, 
              y: responseY + nodeHeight + bodySpacing, 
              visible: bodyVisible
            },
          }
        } else {
          // Layout (no auth):
          //   REQUEST ──► RESPONSE
          //                   |
          //                 BODY
          
          // Total height includes body if visible
          const totalHeight = bodyVisible 
            ? nodeHeight + bodySpacing + bodyCardHeight 
            : nodeHeight
          
          const totalWidth = nodeWidth * 2 + horizontalSpacing
          const startX = (width - totalWidth) / 2
          const startY = (height - totalHeight) / 2
          
          return {
            auth: { x: startX, y: startY - nodeHeight - verticalSpacing, visible: false },
            request: { x: startX, y: startY, visible: true },
            response: { x: startX + nodeWidth + horizontalSpacing, y: startY, visible: true },
            responseBody: { 
              x: startX + nodeWidth + horizontalSpacing, 
              y: startY + nodeHeight + bodySpacing, 
              visible: bodyVisible
            },
          }
        }
      }

      default:
        return this.getLayoutPositions('idle')
    }
  }

  private createNodes() {
    const { primaryColor, bgColor, textColor } = this.options
    const { nodeWidth, nodeHeight, bodyCardWidth, bodyCardHeight } = this
    const positions = this.getLayoutPositions('idle')

    // Auth node (initially hidden)
    this.authNode = new TerminalNode({
      x: positions.auth.x,
      y: positions.auth.y,
      width: nodeWidth,
      height: nodeHeight,
      title: '[ AUTH ]',
      color: primaryColor,
      bgColor,
      textColor,
    })
    this.authNode.setContent('Awaiting request...', false)
    this.authNode.setStatus('idle')
    this.authNode.hide(false) // Start hidden
    this.addChild(this.authNode)

    // Request node (initially hidden until a request is selected)
    this.requestNode = new TerminalNode({
      x: positions.request.x,
      y: positions.request.y,
      width: nodeWidth,
      height: nodeHeight,
      title: '[ REQUEST ]',
      color: primaryColor,
      bgColor,
      textColor,
    })
    this.requestNode.setContent('No request selected', false)
    this.requestNode.setStatus('idle')
    this.requestNode.hide(false) // Start hidden
    this.addChild(this.requestNode)

    // Response node (initially hidden)
    this.responseNode = new TerminalNode({
      x: positions.response.x,
      y: positions.response.y,
      width: nodeWidth,
      height: nodeHeight,
      title: '[ RESPONSE ]',
      color: primaryColor,
      bgColor,
      textColor,
    })
    this.responseNode.setContent('Waiting for response...', false)
    this.responseNode.setStatus('idle')
    this.responseNode.hide(false) // Start hidden
    this.addChild(this.responseNode)

    // Response body card (initially hidden)
    this.responseBodyCard = new ResponseBodyCard({
      x: positions.responseBody.x,
      y: positions.responseBody.y,
      width: bodyCardWidth,
      height: bodyCardHeight,
      color: primaryColor,
      bgColor,
      textColor,
      maxLines: 8,
    })
    this.responseBodyCard.hide(false) // Start hidden
    this.addChild(this.responseBodyCard)

    // Connection lines (initially hidden via progress 0)
    // Auth to Request line - vertical when auth is present
    this.authToRequestLine = new ConnectionLine({
      fromX: positions.auth.x + nodeWidth / 2,
      fromY: positions.auth.y + nodeHeight,
      toX: positions.request.x + nodeWidth / 2,
      toY: positions.request.y,
      color: primaryColor,
      animated: true,
      enableParticles: true,
    })
    this.authToRequestLine.setProgress(0)
    this.authToRequestLine.visible = false
    this.addChild(this.authToRequestLine)

    // Request to Response line - horizontal
    this.requestToResponseLine = new ConnectionLine({
      fromX: positions.request.x + nodeWidth,
      fromY: positions.request.y + nodeHeight / 2,
      toX: positions.response.x,
      toY: positions.response.y + nodeHeight / 2,
      color: primaryColor,
      animated: true,
      enableParticles: true,
    })
    this.requestToResponseLine.setProgress(0)
    this.requestToResponseLine.visible = false
    this.addChild(this.requestToResponseLine)

    // Response to Body line - vertical
    this.responseToBodyLine = new ConnectionLine({
      fromX: positions.response.x + nodeWidth / 2,
      fromY: positions.response.y + nodeHeight,
      toX: positions.responseBody.x + bodyCardWidth / 2,
      toY: positions.responseBody.y,
      color: primaryColor,
      animated: true,
      enableParticles: false, // No particles for this shorter line
    })
    this.responseToBodyLine.setProgress(0)
    this.responseToBodyLine.visible = false
    this.addChild(this.responseToBodyLine)
  }

  private transitionTo(newState: TimelineState, forceUpdate: boolean = false) {
    console.log('[DataFlowGraph] transitionTo:', { 
      newState, 
      forceUpdate, 
      currentState: this.timelineState,
      hasAuth: this.hasAuth,
      hasResponseBody: this.hasResponseBody
    })
    
    if (this.timelineState === newState && !forceUpdate) return
    
    this.timelineState = newState
    const positions = this.getLayoutPositions(newState)

    // Animate nodes to new positions
    // If request has auth, never hide the auth node
    const shouldShowAuth = positions.auth.visible || this.hasAuth
    console.log('[DataFlowGraph] auth decision:', { 
      shouldShowAuth, 
      positionsAuthVisible: positions.auth.visible,
      hasAuth: this.hasAuth,
      authNodeIsShown: this.authNode?.isShown 
    })
    
    if (shouldShowAuth) {
      if (!this.authNode?.isShown) {
        // Slide in from top
        console.log('[DataFlowGraph] slideIn auth')
        this.authNode?.slideIn('top', positions.auth.x, positions.auth.y, 100)
      } else {
        console.log('[DataFlowGraph] animateTo auth')
        this.authNode?.animateTo(positions.auth.x, positions.auth.y)
      }
    } else {
      // Slide out to top
      console.log('[DataFlowGraph] slideOut auth')
      this.authNode?.slideOut('top', 100)
    }

    if (positions.request.visible) {
      if (!this.requestNode?.isShown) {
        // Slide in from bottom
        this.requestNode?.slideIn('bottom', positions.request.x, positions.request.y, 100)
      } else {
        this.requestNode?.animateTo(positions.request.x, positions.request.y)
      }
    } else {
      this.requestNode?.hide(true)
    }

    if (positions.response.visible) {
      if (!this.responseNode?.isShown) {
        // Slide in from right
        this.responseNode?.slideIn('right', positions.response.x, positions.response.y, 150)
      } else {
        this.responseNode?.animateTo(positions.response.x, positions.response.y)
      }
    } else {
      this.responseNode?.hide(true)
    }

    // Handle response body card
    if (positions.responseBody.visible) {
      if (!this.responseBodyCard?.isShown) {
        // Slide in from bottom with delay
        this.responseBodyCard?.slideIn('bottom', positions.responseBody.x, positions.responseBody.y, 80)
      } else {
        this.responseBodyCard?.animateTo(positions.responseBody.x, positions.responseBody.y)
      }
    } else {
      this.responseBodyCard?.hide(true)
    }

    // Update connection line positions and visibility
    this.updateConnectionLines(positions)
  }

  private updateConnectionLines(positions: ReturnType<typeof this.getLayoutPositions>) {
    // This method handles visibility of connection lines
    // Position updates are handled by the ticker in updateConnectionLinesFromNodes()

    // Auth to Request line - show if auth is visible and request is visible
    const shouldShowAuthLine = (positions.auth.visible || this.hasAuth) && positions.request.visible
    if (shouldShowAuthLine) {
      this.authToRequestLine!.visible = true
    } else {
      if (this.authToRequestLine) {
        this.authToRequestLine.visible = false
        this.authToRequestLine.setProgress(0)
      }
    }

    // Request to Response line - show if both are visible
    if (positions.request.visible && positions.response.visible) {
      this.requestToResponseLine!.visible = true
    } else {
      if (this.requestToResponseLine) {
        this.requestToResponseLine.visible = false
        this.requestToResponseLine.setProgress(0)
      }
    }

    // Response to Body line - show if both are visible
    if (positions.response.visible && positions.responseBody.visible) {
      this.responseToBodyLine!.visible = true
      this.responseToBodyLine!.setProgress(1) // Always full progress when visible
    } else {
      if (this.responseToBodyLine) {
        this.responseToBodyLine.visible = false
        this.responseToBodyLine.setProgress(0)
      }
    }
  }

  private resolvedAuthConfig: AuthConfig | null = null

  public setRequest(request: ParsedRequest | null, authConfig?: AuthConfig | null, variables?: Record<string, string>) {
    this.currentRequest = request
    this.resolvedAuthConfig = authConfig ?? null
    this.resolvedVariables = variables ?? {}
    // Use resolved auth config to determine if auth is needed
    this.hasAuth = authConfig != null && authConfig.type !== 'none'
    
    console.log('[DataFlowGraph] setRequest:', { 
      hasAuth: this.hasAuth, 
      resolvedAuthType: authConfig?.type,
      rawAuthType: request?.auth?.type,
      currentState: this.timelineState,
      authNodeIsShown: this.authNode?.isShown
    })

    if (!request) {
      this.transitionTo('idle')
      this.requestNode?.setContent('No request selected', false)
      this.requestNode?.setStatus('idle')
      this.authNode?.setContent('Awaiting request...', false)
      this.authNode?.setStatus('idle')
      return
    }

    // Transition to 'selected' state - shows AUTH if request has auth
    // Force update to re-evaluate auth visibility even if already in 'selected' state
    this.transitionTo('selected', true)

    // Resolve URL with variables for display
    const resolvedUrl = resolveVariables(request.url, this.resolvedVariables)
    const urlDisplay = this.truncateUrl(resolvedUrl)
    
    // Build request info with resolved URL
    let requestInfo = `${request.method} ${urlDisplay}\n`
    
    // Extract and show unresolved variables if any remain
    const urlVars = this.extractVariables(resolvedUrl)
    if (urlVars.length > 0) {
      requestInfo += `Vars: ${urlVars.join(', ')}\n`
    }
    
    requestInfo += `\nHeaders: ${request.headers.length}`
    
    // Check for variables in headers (after resolution)
    const resolvedHeaders = request.headers.map(h => ({
      ...h,
      key: resolveVariables(h.key, this.resolvedVariables),
      value: resolveVariables(h.value, this.resolvedVariables),
    }))
    const headerVars = this.extractVariablesFromHeaders(resolvedHeaders)
    if (headerVars.length > 0) {
      requestInfo += ` (${headerVars.length} vars)`
    }
    
    requestInfo += `\nBody: ${request.body ? 'Yes' : 'No'}`
    
    // Check for variables in body (after resolution)
    if (request.body) {
      const resolvedBody = resolveVariables(request.body, this.resolvedVariables)
      const bodyVars = this.extractVariables(resolvedBody)
      if (bodyVars.length > 0) {
        requestInfo += ` (${bodyVars.length} vars)`
      }
    }
    
    this.requestNode?.setContent(requestInfo, false)

    // Update auth node content using resolved auth config
    if (this.hasAuth && this.resolvedAuthConfig) {
      const authInfo = `Type: ${this.resolvedAuthConfig.type.toUpperCase()}\nStatus: Ready`
      this.authNode?.setContent(authInfo, false)
      this.authNode?.setStatus('idle')
    } else {
      this.authNode?.setContent('No auth required', false)
      this.authNode?.setStatus('idle')
    }

    // Reset response
    this.responseNode?.setContent('Waiting for response...', false)
    this.responseNode?.setStatus('idle')

    // Reset lines (but auth line may be visible now)
    this.authToRequestLine?.setProgress(0)
    this.authToRequestLine?.stopParticles()
    this.requestToResponseLine?.setProgress(0)
    this.requestToResponseLine?.stopParticles()
  }

  private extractVariables(str: string): string[] {
    const matches = str.matchAll(/\{\{(\w+)\}\}/g)
    const vars: string[] = []
    for (const match of matches) {
      const varName = match[1]
      if (varName && !vars.includes(varName)) {
        vars.push(varName)
      }
    }
    return vars
  }

  private extractVariablesFromHeaders(headers: Array<{ key: string; value: string; enabled: boolean }>): string[] {
    const vars: string[] = []
    for (const header of headers) {
      if (header.enabled) {
        const keyVars = this.extractVariables(header.key)
        const valueVars = this.extractVariables(header.value)
        for (const v of [...keyVars, ...valueVars]) {
          if (!vars.includes(v)) {
            vars.push(v)
          }
        }
      }
    }
    return vars
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    const { primaryColor, errorColor } = this.options

    switch (phase) {
      case 'idle':
        this.resetAllNodes()
        // Go back to selected if we have a request, otherwise idle
        if (this.currentRequest) {
          this.transitionTo('selected')
        } else {
          this.transitionTo('idle')
        }
        break

      case 'authenticating':
        // Transition to authenticating (auth should already be visible from 'selected')
        this.transitionTo('authenticating')
        
        // Reset colors at start of new request
        this.authNode?.setColor(primaryColor)
        this.requestNode?.setColor(primaryColor)
        this.responseNode?.setColor(primaryColor)
        this.authToRequestLine?.setColor(primaryColor)
        this.requestToResponseLine?.setColor(primaryColor)
        
        this.authNode?.setStatus('active')
        this.authNode?.setContent(funnyText, true)
        
        // Start particles flowing auth -> request
        this.authToRequestLine?.setProgress(0.5)
        this.authToRequestLine?.startParticles()
        break

      case 'fetching':
        // Transition to show response node
        this.transitionTo('fetching')
        
        // Reset colors if starting fresh (no auth phase)
        if (!this.hasAuth) {
          this.authNode?.setColor(primaryColor)
          this.requestNode?.setColor(primaryColor)
          this.responseNode?.setColor(primaryColor)
          this.authToRequestLine?.setColor(primaryColor)
          this.requestToResponseLine?.setColor(primaryColor)
        }
        
        if (this.hasAuth) {
          this.authNode?.setStatus('success')
          this.authNode?.setContent('Auth complete ✓', false)
          this.authToRequestLine?.setProgress(1)
          this.authToRequestLine?.stopParticles()
        }
        
        this.requestNode?.setStatus('active')
        this.requestNode?.setContent(funnyText, true)
        
        // Start particles flowing request -> response
        this.requestToResponseLine?.setProgress(0.5)
        this.requestToResponseLine?.startParticles()
        break

      case 'success':
        this.transitionTo('complete')
        
        this.authNode?.setStatus(this.hasAuth ? 'success' : 'idle')
        this.requestNode?.setStatus('success')
        this.responseNode?.setStatus('success')
        
        // Reset colors to primary
        this.responseNode?.setColor(primaryColor)
        this.requestNode?.setColor(primaryColor)
        
        this.authToRequestLine?.setProgress(1)
        this.authToRequestLine?.stopParticles()
        this.requestToResponseLine?.setProgress(1)
        this.requestToResponseLine?.stopParticles()
        
        this.authToRequestLine?.setColor(primaryColor)
        this.requestToResponseLine?.setColor(primaryColor)
        break

      case 'error':
        this.transitionTo('error')
        
        this.requestNode?.setStatus('error')
        this.responseNode?.setStatus('error')
        this.responseNode?.setColor(errorColor)
        this.requestToResponseLine?.setColor(errorColor)
        this.requestToResponseLine?.stopParticles()
        break
    }
  }

  public setResponse(status: number, statusText: string, size: string, duration: string) {
    const responseInfo = `Status: ${status} ${statusText}\nSize: ${size}\nTime: ${duration}`
    this.responseNode?.setContent(responseInfo, true)
  }

  public setResponseBody(body: unknown) {
    // Check if body has meaningful content
    const hasContent = body !== null && body !== undefined && body !== '' && 
      (typeof body !== 'string' || body.trim().length > 0)
    
    this.hasResponseBody = hasContent
    
    if (hasContent) {
      this.responseBodyCard?.setContent(body, true)
      // Force layout update to show the body card
      if (this.timelineState === 'complete' || this.timelineState === 'error') {
        this.transitionTo(this.timelineState, true)
      }
    } else {
      this.responseBodyCard?.hide(true)
    }
  }

  public setError(message: string) {
    this.responseNode?.setContent(`ERROR:\n${message}`, true)
  }

  private resetAllNodes() {
    this.authNode?.setStatus('idle')
    this.requestNode?.setStatus('idle')
    this.responseNode?.setStatus('idle')
    this.authToRequestLine?.setProgress(0)
    this.authToRequestLine?.stopParticles()
    this.requestToResponseLine?.setProgress(0)
    this.requestToResponseLine?.stopParticles()
    this.responseToBodyLine?.setProgress(0)
    this.hasResponseBody = false
    this.responseBodyCard?.hide(true)
    
    // Reset colors
    const { primaryColor } = this.options
    this.authNode?.setColor(primaryColor)
    this.requestNode?.setColor(primaryColor)
    this.responseNode?.setColor(primaryColor)
    this.responseBodyCard?.setColor(primaryColor)
    this.authToRequestLine?.setColor(primaryColor)
    this.requestToResponseLine?.setColor(primaryColor)
    this.responseToBodyLine?.setColor(primaryColor)
  }

  private truncateUrl(url: string): string {
    if (url.length <= 30) return url
    try {
      const parsed = new URL(url)
      return parsed.hostname + (parsed.pathname.length > 15 ? parsed.pathname.slice(0, 15) + '...' : parsed.pathname)
    } catch {
      return url.slice(0, 30) + '...'
    }
  }

  public resize(width: number, height: number) {
    this.options.width = width
    this.options.height = height

    // Recalculate positions based on current state
    const positions = this.getLayoutPositions(this.timelineState)

    // Update node positions (immediate, no animation for resize)
    this.authNode?.setPosition(positions.auth.x, positions.auth.y)
    this.requestNode?.setPosition(positions.request.x, positions.request.y)
    this.responseNode?.setPosition(positions.response.x, positions.response.y)
    this.responseBodyCard?.setPosition(positions.responseBody.x, positions.responseBody.y)

    // Update connection lines
    this.updateConnectionLines(positions)
  }

  public setColors(primaryColor: number, secondaryColor: number, bgColor: number, textColor: number, errorColor: number) {
    this.options.primaryColor = primaryColor
    this.options.secondaryColor = secondaryColor
    this.options.bgColor = bgColor
    this.options.textColor = textColor
    this.options.errorColor = errorColor

    // Update node colors
    this.authNode?.setColor(primaryColor)
    this.requestNode?.setColor(primaryColor)
    this.responseNode?.setColor(primaryColor)
    this.responseBodyCard?.setColor(primaryColor)
    this.authToRequestLine?.setColor(primaryColor)
    this.requestToResponseLine?.setColor(primaryColor)
    this.responseToBodyLine?.setColor(primaryColor)
  }

  public destroy() {
    if (this.ticker) {
      this.ticker.stop()
      this.ticker.destroy()
    }
    this.authNode?.destroy()
    this.requestNode?.destroy()
    this.responseNode?.destroy()
    this.responseBodyCard?.destroy()
    this.authToRequestLine?.destroy()
    this.requestToResponseLine?.destroy()
    this.responseToBodyLine?.destroy()
    super.destroy()
  }
}
