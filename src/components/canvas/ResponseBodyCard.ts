import { Container, Graphics, Text, TextStyle, Ticker, FederatedPointerEvent, FederatedWheelEvent } from 'pixi.js'

export interface ResponseBodyCardOptions {
  x: number
  y: number
  width: number
  height: number
  color: number
  bgColor: number
  textColor: number
  maxLines?: number
}

// Easing function for smooth animations
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export class ResponseBodyCard extends Container {
  private bg: Graphics
  private border: Graphics
  private headerBg: Graphics
  private gutterBg: Graphics
  private gutterSeparator: Graphics
  private titleText: Text
  private lineNumbersText: Text
  private contentText: Text
  private scrollIndicator: Graphics
  private interactionArea: Graphics
  private options: ResponseBodyCardOptions
  private ticker: Ticker | null = null
  
  // Layout constants
  private readonly headerHeight: number = 24
  private readonly gutterWidth: number = 28
  private readonly lineHeight: number = 12
  
  // Content state
  private fullContent: string = ''
  private displayContent: string = ''
  private scrollOffset: number = 0
  private maxScrollOffset: number = 0
  private contentLines: string[] = []
  
  // Scrollbar dragging
  private isDraggingScrollbar: boolean = false
  private dragStartY: number = 0
  private dragStartScrollOffset: number = 0
  
  // Typing animation
  private typingText: string = ''
  private targetText: string = ''
  private typingIndex: number = 0
  private isTyping: boolean = false
  private cursorVisible: boolean = true
  private cursorBlinkTimer: number = 0

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

  // Content type
  private contentType: 'json' | 'text' | 'html' | 'xml' = 'text'

  constructor(options: ResponseBodyCardOptions) {
    super()
    this.options = {
      maxLines: 6,
      ...options,
    }
    this.x = options.x
    this.y = options.y
    this.targetX = options.x
    this.targetY = options.y
    this.startX = options.x
    this.startY = options.y

    // Make container interactive for scroll events
    this.eventMode = 'static'
    this.cursor = 'default'

    // Create interaction area for scroll events
    this.interactionArea = new Graphics()
    this.addChild(this.interactionArea)

    // Create header background
    this.headerBg = new Graphics()
    this.addChild(this.headerBg)

    // Create background
    this.bg = new Graphics()
    this.addChild(this.bg)

    // Create border
    this.border = new Graphics()
    this.addChild(this.border)

    // Create gutter background
    this.gutterBg = new Graphics()
    this.addChild(this.gutterBg)

    // Create gutter separator
    this.gutterSeparator = new Graphics()
    this.addChild(this.gutterSeparator)

    // Create scroll indicator
    this.scrollIndicator = new Graphics()
    this.addChild(this.scrollIndicator)

    // Create title
    const titleStyle = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: 12,
      fill: options.color,
      fontWeight: 'bold',
	  lineHeight: 16,
    })
    this.titleText = new Text({ text: '[ BODY ]', style: titleStyle })
    this.addChild(this.titleText)

    // Create line numbers text
    const lineNumberStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 9,
      fill: options.color,
      lineHeight: this.lineHeight,
      align: 'right',
    })
    this.lineNumbersText = new Text({ text: '', style: lineNumberStyle })
    this.lineNumbersText.alpha = 0.5
    this.addChild(this.lineNumbersText)

    // Create content text
    const contentStyle = new TextStyle({
      fontFamily: 'Fira Code, monospace',
      fontSize: 9,
      fill: options.textColor,
      wordWrap: false,
      lineHeight: this.lineHeight,
    })
    this.contentText = new Text({ text: '', style: contentStyle })
    this.addChild(this.contentText)

    this.draw()
    this.startAnimation()
    this.setupInteraction()
  }

  private setupInteraction() {
    // Mouse wheel scrolling
    this.on('wheel', (event: FederatedWheelEvent) => {
      if (this.maxScrollOffset <= 0) return
      
      const delta = event.deltaY
      if (delta > 0) {
        this.scrollDown()
      } else if (delta < 0) {
        this.scrollUp()
      }
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
    
    // Handle scrollbar drag move
    this.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!this.isDraggingScrollbar) return
      
      const { height } = this.options
      const headerHeight = 18
      const scrollAreaHeight = height - headerHeight - 8
      const scrollBarHeight = Math.max(16, scrollAreaHeight * (this.options.maxLines! / this.contentLines.length))
      const availableTrackHeight = scrollAreaHeight - scrollBarHeight
      
      // Calculate how much the mouse moved in terms of scroll
      const deltaY = event.global.y - this.dragStartY
      const scrollRatio = availableTrackHeight > 0 ? deltaY / availableTrackHeight : 0
      const newScrollOffset = this.dragStartScrollOffset + scrollRatio * this.maxScrollOffset
      
      this.scrollOffset = Math.max(0, Math.min(this.maxScrollOffset, newScrollOffset))
      this.updateContentDisplay()
      this.drawScrollIndicator()
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
    const { headerHeight, gutterWidth } = this

    // Draw invisible interaction area for scroll events
    this.interactionArea.clear()
    this.interactionArea.rect(0, 0, width, height)
    this.interactionArea.fill({ color: 0x000000, alpha: 0.001 }) // Nearly invisible but interactive

    // Draw header background with slight gradient effect
    this.headerBg.clear()
    this.headerBg.roundRect(0, 0, width, headerHeight, 4)
    this.headerBg.fill({ color: bgColor, alpha: 0.95 })

    // Draw main background
    this.bg.clear()
    this.bg.rect(0, headerHeight, width, height - headerHeight)
    this.bg.roundRect(0, height - 4, width, 4, 4)
    this.bg.fill({ color: bgColor, alpha: 0.85 })

    // Draw gutter background (slightly darker)
    this.gutterBg.clear()
    this.gutterBg.rect(0, headerHeight, gutterWidth, height - headerHeight)
    this.gutterBg.fill({ color: bgColor, alpha: 0.3 })

    // Draw border
    this.border.clear()
    this.border.roundRect(0, 0, width, height, 4)
    this.border.stroke({ width: 1.5, color, alpha: 0.6 })

    // Draw header separator
    this.border.moveTo(0, headerHeight)
    this.border.lineTo(width, headerHeight)
    this.border.stroke({ width: 1, color, alpha: 0.3 })

    // Draw gutter separator
    this.gutterSeparator.clear()
    this.gutterSeparator.moveTo(gutterWidth, headerHeight)
    this.gutterSeparator.lineTo(gutterWidth, height)
    this.gutterSeparator.stroke({ width: 1, color, alpha: 0.2 })

    // Position title
    this.titleText.x = 8
    this.titleText.y = 4

    // Position line numbers (right-aligned in gutter)
    this.lineNumbersText.x = 4
    this.lineNumbersText.y = headerHeight + 4

    // Position content (after gutter)
    this.contentText.x = gutterWidth + 6
    this.contentText.y = headerHeight + 4

    // Draw scroll indicator if needed
    this.drawScrollIndicator()
  }

  private drawScrollIndicator() {
    const { width, height, color } = this.options
    const headerHeight = 18
    const scrollAreaHeight = height - headerHeight - 8

    this.scrollIndicator.clear()

    if (this.maxScrollOffset > 0) {
      const scrollBarHeight = Math.max(16, scrollAreaHeight * (this.options.maxLines! / this.contentLines.length))
      const scrollProgress = this.maxScrollOffset > 0 ? this.scrollOffset / this.maxScrollOffset : 0
      const scrollBarY = headerHeight + 4 + scrollProgress * (scrollAreaHeight - scrollBarHeight)

      // Scroll track
      this.scrollIndicator.roundRect(width - 6, headerHeight + 4, 3, scrollAreaHeight, 1.5)
      this.scrollIndicator.fill({ color, alpha: 0.15 })

      // Scroll thumb
      this.scrollIndicator.roundRect(width - 6, scrollBarY, 3, scrollBarHeight, 1.5)
      this.scrollIndicator.fill({ color, alpha: 0.5 })
    }
  }

  private startAnimation() {
    this.ticker = new Ticker()
    this.ticker.add((ticker) => {
      // Typing animation
      if (this.isTyping && this.typingIndex < this.targetText.length) {
        // Type multiple characters per frame for faster reveal
        const charsPerFrame = Math.max(1, Math.floor(this.targetText.length / 60))
        this.typingIndex = Math.min(this.typingIndex + charsPerFrame, this.targetText.length)
        this.typingText = this.targetText.slice(0, this.typingIndex)
        this.updateContentDisplay()
        
        if (this.typingIndex >= this.targetText.length) {
          this.isTyping = false
        }
      }

      // Cursor blink
      this.cursorBlinkTimer += ticker.deltaMS
      if (this.cursorBlinkTimer > 500) {
        this.cursorBlinkTimer = 0
        this.cursorVisible = !this.cursorVisible
        if (this.isTyping) {
          this.updateContentDisplay()
        }
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
    const { visibleText, lineNumbers } = this.getVisibleContentWithLineNumbers(this.typingText)
    this.contentText.text = visibleText + cursor
    this.lineNumbersText.text = lineNumbers
  }

  private getVisibleContentWithLineNumbers(content: string): { visibleText: string; lineNumbers: string } {
    const lines = content.split('\n')
    const maxLines = this.options.maxLines!
    const startLine = Math.floor(this.scrollOffset)
    const endLine = Math.min(startLine + maxLines, lines.length)
    
    // Calculate max chars accounting for gutter width
    const maxChars = Math.floor((this.options.width - this.gutterWidth - 20) / 5.5) // Approximate char width
    
    const visibleLines: string[] = []
    const lineNums: string[] = []
    
    for (let i = startLine; i < endLine; i++) {
      const line = lines[i]
      // Truncate line if too long
      if (line.length > maxChars) {
        visibleLines.push(line.slice(0, maxChars - 3) + '...')
      } else {
        visibleLines.push(line)
      }
      // Line number (1-indexed, right-padded)
      lineNums.push(String(i + 1).padStart(3, ' '))
    }
    
    return {
      visibleText: visibleLines.join('\n'),
      lineNumbers: lineNums.join('\n'),
    }
  }

  public setContent(body: unknown, animate: boolean = true) {
    // Format the content based on type
    let formatted: string
    
    if (body === null || body === undefined) {
      formatted = '(empty)'
      this.contentType = 'text'
    } else if (typeof body === 'object') {
      try {
        formatted = JSON.stringify(body, null, 2)
        this.contentType = 'json'
      } catch {
        formatted = String(body)
        this.contentType = 'text'
      }
    } else if (typeof body === 'string') {
      // Try to detect and format JSON strings
      try {
        const parsed = JSON.parse(body)
        formatted = JSON.stringify(parsed, null, 2)
        this.contentType = 'json'
      } catch {
        // Check if it's HTML/XML
        if (body.trim().startsWith('<')) {
          this.contentType = body.includes('<!DOCTYPE html') || body.includes('<html') ? 'html' : 'xml'
          formatted = body
        } else {
          formatted = body
          this.contentType = 'text'
        }
      }
    } else {
      formatted = String(body)
      this.contentType = 'text'
    }

    this.fullContent = formatted
    this.contentLines = formatted.split('\n')
    this.maxScrollOffset = Math.max(0, this.contentLines.length - this.options.maxLines!)
    this.scrollOffset = 0

    // Update title based on content type
    const typeLabel = this.contentType.toUpperCase()
    const lineCount = this.contentLines.length
    this.titleText.text = `[ BODY: ${typeLabel} ] ${lineCount} lines`

    if (animate) {
      this.targetText = formatted
      this.typingText = ''
      this.typingIndex = 0
      this.isTyping = true
    } else {
      this.targetText = formatted
      this.typingText = formatted
      this.typingIndex = formatted.length
      this.isTyping = false
      const { visibleText, lineNumbers } = this.getVisibleContentWithLineNumbers(formatted)
      this.contentText.text = visibleText
      this.lineNumbersText.text = lineNumbers
    }

    this.drawScrollIndicator()
  }

  public scrollUp() {
    if (this.scrollOffset > 0) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1)
      this.updateContentDisplay()
      this.drawScrollIndicator()
    }
  }

  public scrollDown() {
    if (this.scrollOffset < this.maxScrollOffset) {
      this.scrollOffset = Math.min(this.maxScrollOffset, this.scrollOffset + 1)
      this.updateContentDisplay()
      this.drawScrollIndicator()
    }
  }

  public setColor(color: number) {
    this.options.color = color
    this.titleText.style.fill = color
    this.lineNumbersText.style.fill = color
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
    this.hide(true)
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
    this.removeAllListeners()
    super.destroy()
  }
}

