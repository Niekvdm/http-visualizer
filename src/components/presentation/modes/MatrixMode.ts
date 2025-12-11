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
 * Matrix Mode - Falling character rain effect
 * 
 * Shows:
 * - Green falling characters (katakana/ASCII mix)
 * - Request data revealed through the rain
 * - Speed varies by execution phase
 * - Response data "materializes" from characters
 * - Dramatic pause before reveal
 */

interface RainDrop {
  x: number
  y: number
  speed: number
  chars: string[]
  charIndex: number
  brightness: number
  length: number
}

interface RevealedText {
  text: string
  x: number
  y: number
  alpha: number
  targetAlpha: number
  color: number
  size: number
  delay: number
}

type MatrixState = 'idle' | 'selected' | 'raining' | 'revealing' | 'complete' | 'error'

export class MatrixMode extends Container implements IPresentationMode {
  private options: PresentationModeOptions
  private settings: PresentationModeSettings = {
    autoAdvance: false,
    autoAdvanceDelay: 2000,
    typingSpeed: 50,
  }

  // Graphics layers
  private backgroundGraphics: Graphics
  private rainContainer: Container
  private textContainer: Container
  private glowGraphics: Graphics

  // State
  private currentRequest: ParsedRequest | null = null
  private resolvedVariables: Record<string, string> = {}
  private state: MatrixState = 'idle'
  private responseData: { status: number; statusText: string; size: number; duration: number } | null = null
  private errorMessage: string | null = null

  // Rain effect
  private rainDrops: RainDrop[] = []
  private rainTexts: Text[] = []
  private readonly COLUMN_WIDTH = 18
  private readonly CHAR_HEIGHT = 20
  private rainSpeed: number = 1
  private rainDensity: number = 0.3

  // Revealed text
  private revealedTexts: RevealedText[] = []
  private revealProgress: number = 0

  // Animation
  private ticker: Ticker
  private frameCount: number = 0

  // Character sets
  private readonly KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
  private readonly ASCII = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*(){}[]|;:<>?'
  private readonly MATRIX_CHARS = this.KATAKANA + this.ASCII

  // Colors
  private readonly MATRIX_GREEN = 0x00ff41
  private readonly MATRIX_BRIGHT = 0x80
  private readonly MATRIX_DIM = 0x003300

  // Event callback
  private onEvent: ((event: PresentationModeEvent) => void) | null = null

  constructor(options: PresentationModeOptions) {
    super()
    this.options = options

    // Create graphics layers
    this.backgroundGraphics = new Graphics()
    this.addChild(this.backgroundGraphics)

    this.rainContainer = new Container()
    this.addChild(this.rainContainer)

    this.glowGraphics = new Graphics()
    this.addChild(this.glowGraphics)

    this.textContainer = new Container()
    this.addChild(this.textContainer)

    // Initialize rain
    this.initializeRain()

    // Start animation ticker
    this.ticker = new Ticker()
    this.ticker.add(() => this.update())
    this.ticker.start()

    this.draw()
  }

  private initializeRain() {
    const { width, height } = this.options
    const columns = Math.ceil(width / this.COLUMN_WIDTH)

    this.rainDrops = []
    this.rainTexts = []

    for (let i = 0; i < columns; i++) {
      if (Math.random() > this.rainDensity) continue

      const drop = this.createRainDrop(i * this.COLUMN_WIDTH)
      this.rainDrops.push(drop)

      // Create text objects for this drop
      for (let j = 0; j < drop.length; j++) {
        const style = new TextStyle({
          fontFamily: 'MS Gothic, Fira Code, monospace',
          fontSize: 16,
          fill: this.MATRIX_GREEN,
        })
        const text = new Text({ text: drop.chars[j], style })
        text.x = drop.x
        text.y = drop.y - j * this.CHAR_HEIGHT
        text.visible = false
        this.rainContainer.addChild(text)
        this.rainTexts.push(text)
      }
    }
  }

  private createRainDrop(x: number): RainDrop {
    const { height } = this.options
    const length = Math.floor(Math.random() * 15) + 5
    const chars: string[] = []

    for (let i = 0; i < length; i++) {
      chars.push(this.getRandomChar())
    }

    return {
      x,
      y: -Math.random() * height,
      speed: Math.random() * 3 + 2,
      chars,
      charIndex: 0,
      brightness: 1,
      length,
    }
  }

  private getRandomChar(): string {
    return this.MATRIX_CHARS[Math.floor(Math.random() * this.MATRIX_CHARS.length)]
  }

  private draw() {
    this.drawBackground()
    this.drawRevealedText()
  }

  private drawBackground() {
    const { width, height } = this.options
    
    this.backgroundGraphics.clear()
    
    // Pure black background
    this.backgroundGraphics.rect(0, 0, width, height)
    this.backgroundGraphics.fill({ color: 0x000000, alpha: 1 })

    // Subtle vignette effect
    const gradient = [
      { pos: 0, alpha: 0 },
      { pos: 0.7, alpha: 0 },
      { pos: 1, alpha: 0.3 },
    ]

    // Corner shadows
    this.backgroundGraphics.rect(0, 0, width * 0.3, height * 0.3)
    this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.2 })
    this.backgroundGraphics.rect(width * 0.7, 0, width * 0.3, height * 0.3)
    this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.2 })
    this.backgroundGraphics.rect(0, height * 0.7, width * 0.3, height * 0.3)
    this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.2 })
    this.backgroundGraphics.rect(width * 0.7, height * 0.7, width * 0.3, height * 0.3)
    this.backgroundGraphics.fill({ color: 0x000000, alpha: 0.2 })
  }

  private drawRevealedText() {
    const { width, height, errorColor } = this.options

    this.textContainer.removeChildren()
    this.glowGraphics.clear()

    if (this.state === 'idle') {
      // Show placeholder with matrix styling
      const style = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: 18,
        fill: this.MATRIX_GREEN,
        align: 'center',
      })
      const text = new Text({ text: 'SELECT A REQUEST TO ENTER THE MATRIX', style })
      text.anchor.set(0.5)
      text.x = width / 2
      text.y = height / 2
      text.alpha = 0.7 + Math.sin(this.frameCount * 0.05) * 0.3
      this.textContainer.addChild(text)
      return
    }

    // Draw revealed texts with glow
    for (const revealed of this.revealedTexts) {
      if (revealed.alpha <= 0) continue

      // Glow effect
      if (revealed.alpha > 0.5) {
        this.glowGraphics.circle(revealed.x, revealed.y, revealed.size * 2)
        this.glowGraphics.fill({ color: revealed.color, alpha: revealed.alpha * 0.1 })
      }

      const style = new TextStyle({
        fontFamily: 'Share Tech Mono, monospace',
        fontSize: revealed.size,
        fill: revealed.color,
        fontWeight: 'bold',
        dropShadow: {
          color: revealed.color,
          blur: 10,
          alpha: 0.5,
          distance: 0,
        },
      })
      const text = new Text({ text: revealed.text, style })
      text.anchor.set(0.5)
      text.x = revealed.x
      text.y = revealed.y
      text.alpha = revealed.alpha
      this.textContainer.addChild(text)
    }
  }

  private updateRain() {
    const { width, height } = this.options
    let textIndex = 0

    for (const drop of this.rainDrops) {
      // Update position
      drop.y += drop.speed * this.rainSpeed

      // Reset if off screen
      if (drop.y - drop.length * this.CHAR_HEIGHT > height) {
        drop.y = -drop.length * this.CHAR_HEIGHT
        drop.x = Math.floor(Math.random() * (width / this.COLUMN_WIDTH)) * this.COLUMN_WIDTH
        
        // Randomize characters
        for (let i = 0; i < drop.length; i++) {
          drop.chars[i] = this.getRandomChar()
        }
      }

      // Occasionally change a character
      if (Math.random() < 0.02) {
        const idx = Math.floor(Math.random() * drop.length)
        drop.chars[idx] = this.getRandomChar()
      }

      // Update text objects
      for (let j = 0; j < drop.length && textIndex < this.rainTexts.length; j++) {
        const text = this.rainTexts[textIndex]
        const charY = drop.y - j * this.CHAR_HEIGHT

        if (charY >= 0 && charY < height) {
          text.visible = true
          text.x = drop.x
          text.y = charY
          text.text = drop.chars[j]

          // Brightness gradient - head is brightest
          const brightness = j === 0 ? 1 : Math.max(0.1, 1 - j / drop.length)
          
          if (j === 0) {
            text.style.fill = this.MATRIX_BRIGHT
          } else {
            const green = Math.floor(0x41 + (0xff - 0x41) * brightness * 0.5)
            text.style.fill = (green << 8)
          }
          
          text.alpha = brightness
        } else {
          text.visible = false
        }

        textIndex++
      }
    }
  }

  private update() {
    this.frameCount++

    // Always update rain
    this.updateRain()

    // Update revealed texts
    let needsRedraw = false
    for (const revealed of this.revealedTexts) {
      if (revealed.delay > 0) {
        revealed.delay--
        continue
      }
      
      if (revealed.alpha < revealed.targetAlpha) {
        revealed.alpha = Math.min(revealed.targetAlpha, revealed.alpha + 0.05)
        needsRedraw = true
      }
    }

    // State-specific updates
    switch (this.state) {
      case 'selected':
        this.rainSpeed = 0.5
        break
      case 'raining':
        this.rainSpeed = 2 + Math.sin(this.frameCount * 0.1) * 0.5
        break
      case 'revealing':
        this.rainSpeed = 0.3
        this.revealProgress = Math.min(1, this.revealProgress + 0.02)
        needsRedraw = true
        break
      case 'complete':
      
        this.rainSpeed = 0.2
        break
    }

    if (needsRedraw || this.frameCount % 3 === 0) {
      this.drawRevealedText()
    }
  }

  private setupRevealedTexts() {
    const { width, height, errorColor } = this.options
    this.revealedTexts = []

    if (!this.currentRequest) return

    const centerX = width / 2
    const centerY = height / 2

    // Request info
    const method = this.currentRequest.method
    const url = resolveVariables(this.currentRequest.url, this.resolvedVariables)
    const truncatedUrl = url.length > 50 ? url.slice(0, 47) + '...' : url

    // Method
    this.revealedTexts.push({
      text: method,
      x: centerX,
      y: centerY - 80,
      alpha: 0,
      targetAlpha: 1,
      color: this.getMethodColor(method),
      size: 24,
      delay: 0,
    })

    // URL
    this.revealedTexts.push({
      text: truncatedUrl,
      x: centerX,
      y: centerY - 40,
      alpha: 0,
      targetAlpha: 0.9,
      color: this.MATRIX_GREEN,
      size: 14,
      delay: 10,
    })

    // Headers count
    const headerCount = this.currentRequest.headers?.filter(h => h.enabled).length || 0
    if (headerCount > 0) {
      this.revealedTexts.push({
        text: `${headerCount} HEADERS`,
        x: centerX,
        y: centerY,
        alpha: 0,
        targetAlpha: 0.7,
        color: this.MATRIX_GREEN,
        size: 12,
        delay: 20,
      })
    }

    // Body indicator
    if (this.currentRequest.body) {
      this.revealedTexts.push({
        text: 'BODY ATTACHED',
        x: centerX,
        y: centerY + 30,
        alpha: 0,
        targetAlpha: 0.7,
        color: this.MATRIX_GREEN,
        size: 12,
        delay: 30,
      })
    }
  }

  private setupResponseReveal() {
    const { width, height, errorColor } = this.options

    if (this.state === 'error' && this.errorMessage) {
      this.revealedTexts.push({
        text: 'ERROR',
        x: width / 2,
        y: height / 2 + 60,
        alpha: 0,
        targetAlpha: 1,
        color: errorColor,
        size: 28,
        delay: 0,
      })

      this.revealedTexts.push({
        text: this.errorMessage.slice(0, 50),
        x: width / 2,
        y: height / 2 + 100,
        alpha: 0,
        targetAlpha: 0.8,
        color: errorColor,
        size: 14,
        delay: 15,
      })
      return
    }

    if (!this.responseData) return

    const centerX = width / 2
    const centerY = height / 2

    // Status code - big and dramatic
    const statusColor = this.responseData.status >= 400 ? errorColor : this.MATRIX_GREEN
    this.revealedTexts.push({
      text: `${this.responseData.status}`,
      x: centerX,
      y: centerY + 60,
      alpha: 0,
      targetAlpha: 1,
      color: statusColor,
      size: 48,
      delay: 0,
    })

    // Status text
    this.revealedTexts.push({
      text: this.responseData.statusText.toUpperCase(),
      x: centerX,
      y: centerY + 110,
      alpha: 0,
      targetAlpha: 0.9,
      color: statusColor,
      size: 18,
      delay: 10,
    })

    // Duration
    this.revealedTexts.push({
      text: `${this.responseData.duration.toFixed(0)}ms`,
      x: centerX - 80,
      y: centerY + 150,
      alpha: 0,
      targetAlpha: 0.7,
      color: this.MATRIX_GREEN,
      size: 14,
      delay: 20,
    })

    // Size
    this.revealedTexts.push({
      text: this.formatBytes(this.responseData.size),
      x: centerX + 80,
      y: centerY + 150,
      alpha: 0,
      targetAlpha: 0.7,
      color: this.MATRIX_GREEN,
      size: 14,
      delay: 25,
    })
  }

  private getMethodColor(method: string): number {
    const colors: Record<string, number> = {
      GET: 0x61affe,
      POST: 0x49cc90,
      PUT: 0xfca130,
      DELETE: 0xf93e3e,
      PATCH: 0x50e3c2,
      HEAD: 0x9012fe,
      OPTIONS: 0x0d5aa7,
    }
    return colors[method] || this.MATRIX_GREEN
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
    this.revealedTexts = []
    this.revealProgress = 0

    if (!request) {
      this.state = 'idle'
    } else {
      this.state = 'selected'
      this.setupRevealedTexts()
    }

    this.draw()
  }

  public setPhase(phase: ExecutionPhase, funnyText: string) {
    switch (phase) {
      case 'idle':
        this.state = this.currentRequest ? 'selected' : 'idle'
        this.revealedTexts = []
        this.responseData = null
        this.errorMessage = null
        if (this.currentRequest) {
          this.setupRevealedTexts()
        }
        break

      case 'authenticating':
      case 'fetching':
        this.state = 'raining'
        // Clear previous reveals, keep request info
        this.revealedTexts = this.revealedTexts.slice(0, 4)
        break

      case 'success':
        this.state = 'revealing'
        this.revealProgress = 0
        break

      case 'error':
        this.state = 'error'
        break
    }

    this.draw()
  }

  public setResponse(status: number, statusText: string, size: number, duration: number) {
    this.responseData = { status, statusText, size, duration }
    this.state = 'complete'
    this.setupResponseReveal()
    this.draw()
  }

  public setError(message: string) {
    this.errorMessage = message
    this.setupResponseReveal()
    this.draw()
  }

  public resize(width: number, height: number) {
    this.options.width = width
    this.options.height = height
    
    // Reinitialize rain for new size
    this.rainContainer.removeChildren()
    this.rainTexts = []
    this.initializeRain()
    
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
    this.rainContainer.destroy()
    this.glowGraphics.destroy()
    this.textContainer.destroy()
    super.destroy()
  }
}

