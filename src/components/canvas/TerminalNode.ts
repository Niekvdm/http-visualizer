import { Container, Graphics, Text, TextStyle, Ticker, FederatedWheelEvent, FederatedPointerEvent } from 'pixi.js'

export interface TerminalNodeOptions {
  x: number
  y: number
  width: number
  height: number
  title: string
  color: number
  bgColor: number
  textColor: number
}

// Easing function for smooth animations
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export class TerminalNode extends Container {
  private bg: Graphics
  private border: Graphics
  private titleText: Text
  private contentText: Text
  private contentContainer: Container
  private contentMask: Graphics
  private statusIndicator: Graphics
  private scrollIndicator: Graphics
  private options: TerminalNodeOptions
  private ticker: Ticker | null = null
  private typingText: string = ''
  private targetText: string = ''
  private typingIndex: number = 0
  private isTyping: boolean = false
  private cursorVisible: boolean = true
  private cursorBlinkTimer: number = 0

  // Content scrolling
  private scrollOffset: number = 0
  private maxScrollOffset: number = 0
  private readonly headerHeight: number = 24
  private readonly contentPadding: number = 6
  
  // Scrollbar dragging
  private isDraggingScrollbar: boolean = false
  private dragStartY: number = 0
  private dragStartScrollOffset: number = 0

  // Animation state
  private targetX: number
  private targetY: number
  private startX: number
  private startY: number
  private animationProgress: number = 1
  private animationDuration: number = 400 // ms
  private isAnimating: boolean = false

  // Visibility state
  private _isVisible: boolean = true
  private targetAlpha: number = 1
  private alphaAnimationProgress: number = 1

  constructor(options: TerminalNodeOptions) {
    super()
    this.options = options
    this.x = options.x
    this.y = options.y
    this.targetX = options.x
    this.targetY = options.y
    this.startX = options.x
    this.startY = options.y

    // Create background
    this.bg = new Graphics()
    this.addChild(this.bg)

    // Create border
    this.border = new Graphics()
    this.addChild(this.border)

    // Create status indicator
    this.statusIndicator = new Graphics()
    this.addChild(this.statusIndicator)

    // Create scroll indicator
    this.scrollIndicator = new Graphics()
    this.addChild(this.scrollIndicator)

    // Create title
    const titleStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 12,
      fill: options.color,
      fontWeight: 'bold',
    })
    this.titleText = new Text({ text: options.title, style: titleStyle })
    this.addChild(this.titleText)

    // Create content container with mask for clipping
    this.contentContainer = new Container()
    this.addChild(this.contentContainer)

    // Create mask for content area (clips overflow)
    this.contentMask = new Graphics()
    this.addChild(this.contentMask)
    this.contentContainer.mask = this.contentMask

    // Create content text with proper word wrap width
    const contentStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 10,
      fill: options.textColor,
      wordWrap: true,
      wordWrapWidth: options.width - 20, // 10px padding on each side
      lineHeight: 13,
      breakWords: true, // Break long words/URLs
    })
    this.contentText = new Text({ text: '', style: contentStyle })
    this.contentContainer.addChild(this.contentText)

    this.draw()
    this.setupScrolling()
    this.startAnimation()
  }

  private setupScrolling() {
    // Make the node interactive for scroll events
    this.eventMode = 'static'
    this.cursor = 'default'
    
    // Handle mouse wheel scrolling
    this.on('wheel', (event: FederatedWheelEvent) => {
      if (this.maxScrollOffset <= 0) return // No scrolling needed
      
      const delta = event.deltaY
      
      // Update scroll offset
      this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, this.scrollOffset + delta * 0.5))
      this.applyScroll()
      
      // Prevent page scroll when scrolling inside node
      event.stopPropagation()
    })
    
    // Make scroll indicator interactive for dragging
    this.scrollIndicator.eventMode = 'static'
    this.scrollIndicator.cursor = 'pointer'
    
    // Handle scrollbar drag start
    this.scrollIndicator.on('pointerdown', (event: FederatedPointerEvent) => {
      if (this.maxScrollOffset <= 0) return
      
      this.isDraggingScrollbar = true
      this.dragStartY = event.global.y
      this.dragStartScrollOffset = this.scrollOffset
      this.scrollIndicator.cursor = 'grabbing'
      
      event.stopPropagation()
    })
    
    // Handle scrollbar drag move (on stage to capture moves outside the indicator)
    this.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!this.isDraggingScrollbar) return
      
      const { height } = this.options
      const { headerHeight, contentPadding } = this
      const contentAreaHeight = height - headerHeight - contentPadding * 2
      const scrollTrackHeight = contentAreaHeight - 4
      const scrollThumbHeight = Math.max(20, (contentAreaHeight / (contentAreaHeight + this.maxScrollOffset)) * scrollTrackHeight)
      const availableTrackHeight = scrollTrackHeight - scrollThumbHeight
      
      // Calculate how much the mouse moved in terms of scroll
      const deltaY = event.global.y - this.dragStartY
      const scrollRatio = deltaY / availableTrackHeight
      const newScrollOffset = this.dragStartScrollOffset + scrollRatio * this.maxScrollOffset
      
      this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, newScrollOffset))
      this.applyScroll()
    })
    
    // Handle scrollbar drag end
    const endDrag = () => {
      if (this.isDraggingScrollbar) {
        this.isDraggingScrollbar = false
        this.scrollIndicator.cursor = 'pointer'
      }
    }
    
    this.on('pointerup', endDrag)
    this.on('pointerupoutside', endDrag)
    this.scrollIndicator.on('pointerup', endDrag)
    this.scrollIndicator.on('pointerupoutside', endDrag)
  }

  private draw() {
    const { width, height, color, bgColor } = this.options
    const { headerHeight, contentPadding } = this

    // Draw background
    this.bg.clear()
    this.bg.roundRect(0, 0, width, height, 4)
    this.bg.fill({ color: bgColor, alpha: 0.9 })

    // Draw border with glow
    this.border.clear()
    this.border.roundRect(0, 0, width, height, 4)
    this.border.stroke({ width: 2, color, alpha: 0.8 })

    // Draw header line
    this.border.moveTo(0, headerHeight)
    this.border.lineTo(width, headerHeight)
    this.border.stroke({ width: 1, color, alpha: 0.5 })

    // Position title
    this.titleText.x = 10
    this.titleText.y = 6

    // Draw status indicator
    this.statusIndicator.clear()
    this.statusIndicator.circle(width - 14, 12, 4)
    this.statusIndicator.fill({ color, alpha: 1 })

    // Draw content mask (clips content to available area)
    const contentY = headerHeight + contentPadding
    const contentHeight = height - contentY - contentPadding
    this.contentMask.clear()
    this.contentMask.rect(0, contentY, width, contentHeight)
    this.contentMask.fill({ color: 0xffffff })

    // Position content container
    this.contentContainer.x = 0
    this.contentContainer.y = 0

    // Position content text within container
    this.contentText.x = 10
    this.contentText.y = contentY
  }

  private startAnimation() {
    this.ticker = new Ticker()
    this.ticker.add((ticker) => {
      // Typing animation
      if (this.isTyping && this.typingIndex < this.targetText.length) {
        this.typingIndex++
        this.typingText = this.targetText.slice(0, this.typingIndex)
        this.updateContentDisplay()
      }

      // Cursor blink
      this.cursorBlinkTimer += ticker.deltaMS
      if (this.cursorBlinkTimer > 500) {
        this.cursorBlinkTimer = 0
        this.cursorVisible = !this.cursorVisible
        this.updateContentDisplay()
      }

      // Position animation
      if (this.isAnimating) {
        this.animationProgress += ticker.deltaMS / this.animationDuration
        if (this.animationProgress >= 1) {
          this.animationProgress = 1
          this.isAnimating = false
        }
        const eased = easeOutCubic(this.animationProgress)
        this.x = this.startX + (this.targetX - this.startX) * eased
        this.y = this.startY + (this.targetY - this.startY) * eased
      }

      // Alpha animation
      if (this.alphaAnimationProgress < 1) {
        this.alphaAnimationProgress += ticker.deltaMS / this.animationDuration
        if (this.alphaAnimationProgress >= 1) {
          this.alphaAnimationProgress = 1
          // When fade-out completes, set visible to false
          if (!this._isVisible) {
            this.visible = false
          }
        }
        const eased = easeOutCubic(this.alphaAnimationProgress)
        const startAlpha = this._isVisible ? 0 : 1
        const endAlpha = this._isVisible ? 1 : 0
        this.alpha = startAlpha + (endAlpha - startAlpha) * eased
      }
    })
    this.ticker.start()
  }

  private updateContentDisplay() {
    const cursor = this.cursorVisible && this.isTyping ? '█' : ''
    this.contentText.text = this.typingText + cursor
    this.updateScrollBounds()
  }

  private updateScrollBounds() {
    const { height } = this.options
    const { headerHeight, contentPadding } = this
    const contentAreaHeight = height - headerHeight - contentPadding * 2
    const textHeight = this.contentText.height

    // Calculate max scroll (how much the text overflows)
    this.maxScrollOffset = Math.max(0, textHeight - contentAreaHeight)
    
    // Auto-scroll to bottom when content overflows (for typing animation)
    if (this.isTyping && this.maxScrollOffset > 0) {
      this.scrollOffset = this.maxScrollOffset
    }
    
    // Always apply scroll to update indicator
    this.applyScroll()
  }

  private applyScroll() {
    const { headerHeight, contentPadding } = this
    const contentY = headerHeight + contentPadding
    this.contentText.y = contentY - this.scrollOffset
    this.updateScrollIndicator()
  }

  private updateScrollIndicator() {
    const { width, height, color } = this.options
    const { headerHeight, contentPadding } = this
    
    this.scrollIndicator.clear()
    
    // Only show scroll indicator if content overflows
    if (this.maxScrollOffset <= 0) {
      return
    }
    
    const contentAreaHeight = height - headerHeight - contentPadding * 2
    const scrollTrackHeight = contentAreaHeight - 4 // 2px margin top/bottom
    const scrollThumbHeight = Math.max(20, (contentAreaHeight / (contentAreaHeight + this.maxScrollOffset)) * scrollTrackHeight)
    const scrollThumbY = headerHeight + contentPadding + 2 + (this.scrollOffset / this.maxScrollOffset) * (scrollTrackHeight - scrollThumbHeight)
    
    // Draw scroll track (subtle)
    this.scrollIndicator.roundRect(width - 6, headerHeight + contentPadding + 2, 3, scrollTrackHeight, 1.5)
    this.scrollIndicator.fill({ color: color, alpha: 0.1 })
    
    // Draw scroll thumb
    this.scrollIndicator.roundRect(width - 6, scrollThumbY, 3, scrollThumbHeight, 1.5)
    this.scrollIndicator.fill({ color: color, alpha: 0.5 })
  }

  public setContent(text: string, animate: boolean = true) {
    // Reset scroll when setting new content
    this.scrollOffset = 0
    
    if (animate) {
      this.targetText = text
      this.typingText = ''
      this.typingIndex = 0
      this.isTyping = true
    } else {
      this.targetText = text
      this.typingText = text
      this.typingIndex = text.length
      this.isTyping = false
      this.contentText.text = text
      this.updateScrollBounds()
      // For non-animated content, scroll to top
      this.scrollOffset = 0
      this.applyScroll()
    }
  }

  public setTitle(title: string) {
    this.titleText.text = title
  }

  public setStatus(status: 'idle' | 'active' | 'success' | 'error') {
    const colors: Record<string, number> = {
      idle: 0x6b8f6b,
      active: 0x00ff41,
      success: 0x00ff41,
      error: 0xff0040,
    }
    
    this.statusIndicator.clear()
    this.statusIndicator.circle(this.options.width - 14, 12, 4)
    this.statusIndicator.fill({ color: colors[status], alpha: 1 })

    // Add outer glow for active/success/error
    if (status !== 'idle') {
      this.statusIndicator.circle(this.options.width - 14, 12, 6)
      this.statusIndicator.fill({ color: colors[status], alpha: 0.3 })
    }
  }

  public setColor(color: number) {
    this.options.color = color
    this.titleText.style.fill = color
    this.draw()
  }

  public setPosition(x: number, y: number) {
    this.x = x
    this.y = y
    this.targetX = x
    this.targetY = y
    this.startX = x
    this.startY = y
  }

  /**
   * Animate the node to a new position with easing
   */
  public animateTo(x: number, y: number, duration?: number) {
    this.startX = this.x
    this.startY = this.y
    this.targetX = x
    this.targetY = y
    this.animationProgress = 0
    this.isAnimating = true
    if (duration !== undefined) {
      this.animationDuration = duration
    }
  }

  /**
   * Show the node with fade-in animation
   */
  public show(animate: boolean = true) {
    this._isVisible = true
    this.visible = true
    if (animate) {
      this.alpha = 0
      this.alphaAnimationProgress = 0
    } else {
      this.alpha = 1
      this.alphaAnimationProgress = 1
    }
  }

  /**
   * Hide the node with fade-out animation
   */
  public hide(animate: boolean = true) {
    this._isVisible = false
    if (animate) {
      this.alphaAnimationProgress = 0
    } else {
      this.alpha = 0
      this.alphaAnimationProgress = 1
      this.visible = false
    }
  }

  /**
   * Slide in from a direction
   */
  public slideIn(fromDirection: 'left' | 'right' | 'top' | 'bottom', targetX: number, targetY: number, offset: number = 100) {
    let startX = targetX
    let startY = targetY
    
    switch (fromDirection) {
      case 'left':
        startX = targetX - offset
        break
      case 'right':
        startX = targetX + offset
        break
      case 'top':
        startY = targetY - offset
        break
      case 'bottom':
        startY = targetY + offset
        break
    }
    
    this.x = startX
    this.y = startY
    this.startX = startX
    this.startY = startY
    this.show(true)
    this.animateTo(targetX, targetY)
  }

  /**
   * Slide out to a direction with fade
   */
  public slideOut(toDirection: 'left' | 'right' | 'top' | 'bottom', offset: number = 100) {
    let targetX = this.x
    let targetY = this.y
    
    switch (toDirection) {
      case 'left':
        targetX = this.x - offset
        break
      case 'right':
        targetX = this.x + offset
        break
      case 'top':
        targetY = this.y - offset
        break
      case 'bottom':
        targetY = this.y + offset
        break
    }
    
    this.animateTo(targetX, targetY)
    this.hide(true) // Fade out while sliding
  }

  public getWidth(): number {
    return this.options.width
  }

  public getHeight(): number {
    return this.options.height
  }

  public get isShown(): boolean {
    return this._isVisible
  }

  public getTargetX(): number {
    return this.targetX
  }

  public getTargetY(): number {
    return this.targetY
  }

  public destroy() {
    if (this.ticker) {
      this.ticker.stop()
      this.ticker.destroy()
    }
    super.destroy()
  }
}
