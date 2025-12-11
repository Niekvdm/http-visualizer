import { Graphics, Ticker } from 'pixi.js'

export interface DataParticleOptions {
  fromX: number
  fromY: number
  toX: number
  toY: number
  color: number
  size?: number
  speed?: number
  glowSize?: number
}

export class DataParticle extends Graphics {
  private options: Required<DataParticleOptions>
  private progress: number = 0
  private ticker: Ticker | null = null
  private _isComplete: boolean = false
  private fadeOutProgress: number = 0

  constructor(options: DataParticleOptions) {
    super()
    this.options = {
      size: 3,
      speed: 0.015 + Math.random() * 0.01, // Slight randomness for organic feel
      glowSize: 8,
      ...options,
    }

    this.draw()
    this.startAnimation()
  }

  private draw() {
    this.clear()

    const { fromX, fromY, toX, toY, color, size, glowSize } = this.options

    // Calculate current position along the path
    const x = fromX + (toX - fromX) * this.progress
    const y = fromY + (toY - fromY) * this.progress

    // Calculate alpha based on fade out
    const alpha = this.fadeOutProgress > 0 ? 1 - this.fadeOutProgress : 1

    // Outer glow (larger, more transparent)
    this.circle(x, y, glowSize)
    this.fill({ color, alpha: 0.15 * alpha })

    // Middle glow
    this.circle(x, y, glowSize * 0.6)
    this.fill({ color, alpha: 0.3 * alpha })

    // Inner core (bright)
    this.circle(x, y, size)
    this.fill({ color, alpha: 0.9 * alpha })

    // Center highlight (white-ish)
    this.circle(x, y, size * 0.5)
    this.fill({ color: 0xffffff, alpha: 0.7 * alpha })
  }

  private startAnimation() {
    this.ticker = new Ticker()
    this.ticker.add(() => {
      if (this.progress < 1) {
        this.progress += this.options.speed
        if (this.progress >= 1) {
          this.progress = 1
          // Start fade out
          this.fadeOutProgress = 0.01
        }
        this.draw()
      } else if (this.fadeOutProgress < 1) {
        this.fadeOutProgress += 0.05
        if (this.fadeOutProgress >= 1) {
          this._isComplete = true
        }
        this.draw()
      }
    })
    this.ticker.start()
  }

  public get isComplete(): boolean {
    return this._isComplete
  }

  public updatePath(fromX: number, fromY: number, toX: number, toY: number) {
    this.options.fromX = fromX
    this.options.fromY = fromY
    this.options.toX = toX
    this.options.toY = toY
    this.draw()
  }

  public setColor(color: number) {
    this.options.color = color
    this.draw()
  }

  public destroy() {
    if (this.ticker) {
      this.ticker.stop()
      this.ticker.destroy()
    }
    super.destroy()
  }
}

export class ParticleEmitter {
  private particles: DataParticle[] = []
  private container: Graphics
  private options: {
    fromX: number
    fromY: number
    toX: number
    toY: number
    color: number
  }
  private spawnTimer: number = 0
  private spawnInterval: number = 150 // ms between spawns
  private isEmitting: boolean = false
  private ticker: Ticker | null = null

  constructor(
    container: Graphics,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: number
  ) {
    this.container = container
    this.options = { fromX, fromY, toX, toY, color }
    this.startTicker()
  }

  private startTicker() {
    this.ticker = new Ticker()
    this.ticker.add((ticker) => {
      if (this.isEmitting) {
        this.spawnTimer += ticker.deltaMS
        if (this.spawnTimer >= this.spawnInterval) {
          this.spawnTimer = 0
          this.spawnParticle()
        }
      }

      // Clean up completed particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        if (this.particles[i].isComplete) {
          this.particles[i].destroy()
          this.particles.splice(i, 1)
        }
      }
    })
    this.ticker.start()
  }

  private spawnParticle() {
    const particle = new DataParticle({
      fromX: this.options.fromX,
      fromY: this.options.fromY,
      toX: this.options.toX,
      toY: this.options.toY,
      color: this.options.color,
    })
    this.particles.push(particle)
    this.container.addChild(particle)
  }

  public start() {
    this.isEmitting = true
    this.spawnTimer = this.spawnInterval // Spawn immediately
  }

  public stop() {
    this.isEmitting = false
  }

  public updatePath(fromX: number, fromY: number, toX: number, toY: number) {
    this.options.fromX = fromX
    this.options.fromY = fromY
    this.options.toX = toX
    this.options.toY = toY
    // Update existing particles
    for (const particle of this.particles) {
      particle.updatePath(fromX, fromY, toX, toY)
    }
  }

  public setColor(color: number) {
    this.options.color = color
    for (const particle of this.particles) {
      particle.setColor(color)
    }
  }

  public destroy() {
    if (this.ticker) {
      this.ticker.stop()
      this.ticker.destroy()
    }
    for (const particle of this.particles) {
      particle.destroy()
    }
    this.particles = []
  }
}

