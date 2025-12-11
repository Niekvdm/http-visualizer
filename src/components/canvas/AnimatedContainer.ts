import { Container, Ticker } from 'pixi.js'

/**
 * Easing function for smooth animations
 */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export interface AnimatedContainerOptions {
  x: number
  y: number
  width: number
  height: number
  animationDuration?: number
}

/**
 * Base class for animated PixiJS containers with common animation behaviors:
 * - Position animation with easing
 * - Show/hide with fade animation
 * - Slide in/out from directions
 */
export abstract class AnimatedContainer extends Container {
  protected _width: number
  protected _height: number
  
  // Animation state
  protected targetX: number
  protected targetY: number
  protected startX: number
  protected startY: number
  protected animationProgress: number = 1
  protected animationDuration: number = 400 // ms
  protected isAnimating: boolean = false

  // Visibility state
  protected _isVisible: boolean = true
  protected targetAlpha: number = 1
  protected alphaAnimationProgress: number = 1

  // Animation ticker
  protected ticker: Ticker | null = null

  constructor(options: AnimatedContainerOptions) {
    super()
    this.x = options.x
    this.y = options.y
    this._width = options.width
    this._height = options.height
    this.targetX = options.x
    this.targetY = options.y
    this.startX = options.x
    this.startY = options.y
    
    if (options.animationDuration !== undefined) {
      this.animationDuration = options.animationDuration
    }
  }

  /**
   * Start the animation ticker. Call this in subclass constructor after setup.
   */
  protected startAnimationTicker() {
    this.ticker = new Ticker()
    this.ticker.add((ticker) => {
      this.updateAnimations(ticker.deltaMS)
    })
    this.ticker.start()
  }

  /**
   * Override in subclass to add custom animation updates
   */
  protected updateAnimations(deltaMS: number) {
    // Position animation
    if (this.isAnimating) {
      this.animationProgress += deltaMS / this.animationDuration
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
      this.alphaAnimationProgress += deltaMS / this.animationDuration
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
  }

  /**
   * Set position immediately without animation
   */
  public setPosition(x: number, y: number) {
    this.x = x
    this.y = y
    this.targetX = x
    this.targetY = y
    this.startX = x
    this.startY = y
  }

  /**
   * Animate the container to a new position with easing
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
   * Show the container with fade-in animation
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
   * Hide the container with fade-out animation
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
  public slideIn(
    fromDirection: 'left' | 'right' | 'top' | 'bottom',
    targetX: number,
    targetY: number,
    offset: number = 100
  ) {
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
    return this._width
  }

  public getHeight(): number {
    return this._height
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

