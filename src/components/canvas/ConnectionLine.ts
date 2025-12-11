import { Container, Graphics, Ticker } from 'pixi.js'
import { ParticleEmitter } from './DataParticle'

export interface ConnectionLineOptions {
  fromX: number
  fromY: number
  toX: number
  toY: number
  color: number
  dashLength?: number
  gapLength?: number
  lineWidth?: number
  animated?: boolean
  animationSpeed?: number
  enableParticles?: boolean
}

export class ConnectionLine extends Container {
  private options: Required<ConnectionLineOptions>
  private lineGraphics: Graphics
  private dashOffset: number = 0
  private ticker: Ticker | null = null
  private _progress: number = 1
  private particleEmitter: ParticleEmitter | null = null
  private particleContainer: Graphics

  constructor(options: ConnectionLineOptions) {
    super()
    this.options = {
      dashLength: 10,
      gapLength: 5,
      lineWidth: 2,
      animated: true,
      animationSpeed: 0.5,
      enableParticles: true,
      ...options,
    }

    // Create graphics for line
    this.lineGraphics = new Graphics()
    this.addChild(this.lineGraphics)

    // Create container for particles
    this.particleContainer = new Graphics()
    this.addChild(this.particleContainer)

    // Create particle emitter
    if (this.options.enableParticles) {
      this.particleEmitter = new ParticleEmitter(
        this.particleContainer,
        this.options.fromX,
        this.options.fromY,
        this.options.toX,
        this.options.toY,
        this.options.color
      )
    }

    this.draw()

    if (this.options.animated) {
      this.startAnimation()
    }
  }

  private draw() {
    this.lineGraphics.clear()

    const { fromX, fromY, toX, toY, color, dashLength, gapLength, lineWidth } = this.options
    
    // Calculate line properties
    const dx = toX - fromX
    const dy = toY - fromY
    const distance = Math.sqrt(dx * dx + dy * dy) * this._progress
    const angle = Math.atan2(dy, dx)

    // Draw dashed line
    let currentDistance = this.dashOffset % (dashLength + gapLength)
    
    this.lineGraphics.moveTo(fromX, fromY)

    while (currentDistance < distance) {
      const dashEnd = Math.min(currentDistance + dashLength, distance)
      
      const startX = fromX + Math.cos(angle) * currentDistance
      const startY = fromY + Math.sin(angle) * currentDistance
      const endX = fromX + Math.cos(angle) * dashEnd
      const endY = fromY + Math.sin(angle) * dashEnd

      this.lineGraphics.moveTo(startX, startY)
      this.lineGraphics.lineTo(endX, endY)
      this.lineGraphics.stroke({ width: lineWidth, color, alpha: 0.8 })

      currentDistance += dashLength + gapLength
    }

    // Draw glow effect at the end if animating
    if (this._progress < 1 && this._progress > 0) {
      const endX = fromX + Math.cos(angle) * distance
      const endY = fromY + Math.sin(angle) * distance
      
      this.lineGraphics.circle(endX, endY, 4)
      this.lineGraphics.fill({ color, alpha: 1 })
      
      // Outer glow
      this.lineGraphics.circle(endX, endY, 8)
      this.lineGraphics.fill({ color, alpha: 0.3 })
    }
  }

  private startAnimation() {
    this.ticker = new Ticker()
    this.ticker.add(() => {
      this.dashOffset += this.options.animationSpeed
      this.draw()
    })
    this.ticker.start()
  }

  public setProgress(progress: number) {
    const wasZero = this._progress === 0
    this._progress = Math.max(0, Math.min(1, progress))
    this.draw()

    // Start particles when progress starts
    if (wasZero && this._progress > 0 && this.particleEmitter) {
      this.particleEmitter.start()
    }
    // Stop particles when progress completes or resets
    if ((this._progress === 1 || this._progress === 0) && this.particleEmitter) {
      this.particleEmitter.stop()
    }
  }

  public startParticles() {
    this.particleEmitter?.start()
  }

  public stopParticles() {
    this.particleEmitter?.stop()
  }

  public get progress(): number {
    return this._progress
  }

  public setColor(color: number) {
    this.options.color = color
    this.particleEmitter?.setColor(color)
    this.draw()
  }

  public updatePositions(fromX: number, fromY: number, toX: number, toY: number) {
    this.options.fromX = fromX
    this.options.fromY = fromY
    this.options.toX = toX
    this.options.toY = toY
    this.particleEmitter?.updatePath(fromX, fromY, toX, toY)
    this.draw()
  }

  public destroy() {
    if (this.ticker) {
      this.ticker.stop()
      this.ticker.destroy()
    }
    this.particleEmitter?.destroy()
    this.lineGraphics.destroy()
    this.particleContainer.destroy()
    super.destroy()
  }
}
