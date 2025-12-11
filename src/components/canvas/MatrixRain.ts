import { Container, Text, TextStyle, Ticker } from 'pixi.js'

interface RainDrop {
  x: number
  y: number
  speed: number
  char: string
  alpha: number
  text: Text
}

export class MatrixRain extends Container {
  private drops: RainDrop[] = []
  private columns: number = 0
  private fontSize: number = 14
  private chars: string = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEF'
  private color: number = 0x00ff41
  private ticker: Ticker
  private _width: number = 0
  private _height: number = 0

  constructor(width: number, height: number, color: number = 0x00ff41) {
    super()
    this._width = width
    this._height = height
    this.color = color
    this.ticker = new Ticker()
    this.initialize()
  }

  private initialize() {
    this.columns = Math.floor(this._width / this.fontSize)
    
    // Create initial drops
    for (let i = 0; i < this.columns; i++) {
      if (Math.random() > 0.7) { // Only 30% of columns have drops for performance
        this.createDrop(i)
      }
    }

    // Start animation
    this.ticker.add(this.update.bind(this))
    this.ticker.start()
  }

  private createDrop(column: number) {
    const style = new TextStyle({
      fontFamily: 'Share Tech Mono, monospace',
      fontSize: this.fontSize,
      fill: this.color,
    })

    const char = this.getRandomChar()
    const text = new Text({ text: char, style })
    
    const drop: RainDrop = {
      x: column * this.fontSize,
      y: Math.random() * -this._height,
      speed: 2 + Math.random() * 4,
      char,
      alpha: 0.1 + Math.random() * 0.5,
      text,
    }

    text.x = drop.x
    text.y = drop.y
    text.alpha = drop.alpha

    this.addChild(text)
    this.drops.push(drop)
  }

  private getRandomChar(): string {
    return this.chars[Math.floor(Math.random() * this.chars.length)]
  }

  private update() {
    for (const drop of this.drops) {
      drop.y += drop.speed
      drop.text.y = drop.y

      // Randomly change character
      if (Math.random() > 0.95) {
        drop.char = this.getRandomChar()
        drop.text.text = drop.char
      }

      // Reset when off screen
      if (drop.y > this._height) {
        drop.y = Math.random() * -100
        drop.speed = 2 + Math.random() * 4
        drop.alpha = 0.1 + Math.random() * 0.5
        drop.text.alpha = drop.alpha
      }
    }
  }

  public resize(width: number, height: number) {
    this._width = width
    this._height = height
    
    // Recreate drops for new dimensions
    const newColumns = Math.floor(width / this.fontSize)
    
    if (newColumns > this.columns) {
      // Add more columns
      for (let i = this.columns; i < newColumns; i++) {
        if (Math.random() > 0.7) {
          this.createDrop(i)
        }
      }
    }
    
    this.columns = newColumns
  }

  public setColor(color: number) {
    this.color = color
    for (const drop of this.drops) {
      drop.text.style.fill = color
    }
  }

  public destroy() {
    this.ticker.stop()
    this.ticker.destroy()
    for (const drop of this.drops) {
      drop.text.destroy()
    }
    this.drops = []
    super.destroy()
  }
}

