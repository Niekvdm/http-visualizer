import type { Container, EventSystem } from 'pixi.js'
import type { ExecutionPhase, ParsedRequest, ResponseTiming, SizeBreakdown, TlsInfo, RedirectHop } from '@/types'

/**
 * Common options for all presentation modes
 */
export interface PresentationModeOptions {
  width: number
  height: number
  primaryColor: number
  secondaryColor: number
  bgColor: number
  textColor: number
  errorColor: number
  events?: EventSystem // For viewport interactions
}

/**
 * Settings that can be updated at runtime
 */
export interface PresentationModeSettings {
  autoAdvance: boolean
  autoAdvanceDelay: number
  typingSpeed: number
}

/**
 * Events that presentation modes can emit
 */
export type PresentationModeEvent = 'execute-request' | 'open-response'

/**
 * Extended response data with detailed timing, TLS info, etc.
 */
export interface ExtendedResponseData {
  timing?: ResponseTiming
  sizeBreakdown?: SizeBreakdown
  tls?: TlsInfo
  redirectChain?: RedirectHop[]
  protocol?: string
  serverIP?: string
  fromCache?: boolean
}

/**
 * Interface that all presentation modes must implement.
 * This standardizes the API for different visualization styles.
 */
export interface IPresentationMode extends Container {
  /**
   * Set the current request to display
   * @param request The parsed request or null to clear
   * @param variables Resolved variables for display
   */
  setRequest(request: ParsedRequest | null, variables?: Record<string, string>): void

  /**
   * Update the execution phase
   * @param phase Current execution phase
   * @param funnyText Optional funny/descriptive text for the phase
   */
  setPhase(phase: ExecutionPhase, funnyText: string): void

  /**
   * Set response data after successful execution
   * @param status HTTP status code
   * @param statusText HTTP status text
   * @param size Response size in bytes
   * @param duration Request duration in milliseconds
   * @param extendedData Optional extended response data (timing, TLS, etc.)
   */
  setResponse(status: number, statusText: string, size: number, duration: number, extendedData?: ExtendedResponseData): void

  /**
   * Set error message after failed execution
   * @param message Error message to display
   */
  setError(message: string): void

  /**
   * Handle window/container resize
   * @param width New width
   * @param height New height
   */
  resize(width: number, height: number): void

  /**
   * Update theme colors
   */
  setColors(
    primaryColor: number,
    secondaryColor: number,
    bgColor: number,
    textColor: number,
    errorColor: number
  ): void

  /**
   * Update runtime settings
   */
  updateSettings(settings: Partial<PresentationModeSettings>): void

  /**
   * Set callback for mode events
   */
  setEventCallback(callback: (event: PresentationModeEvent) => void): void

  /**
   * Handle user input (e.g., Enter key press)
   * @returns true if input was handled
   */
  handleInput(): boolean

  /**
   * Handle click input
   * @returns true if click was handled
   */
  handleInputClick(): boolean

  /**
   * Check if mode is waiting for user input
   */
  isWaitingForInput(): boolean

  /**
   * Called when JSON reveal modal is closed
   */
  onJsonRevealClosed(): void

  /**
   * Set redirect chain for visualization (optional)
   * @param redirectChain Array of redirect hops
   */
  setRedirectChain?(redirectChain: RedirectHop[]): void

  /**
   * Clean up resources
   */
  destroy(): void
}

/**
 * Factory function type for creating presentation modes
 */
export type PresentationModeFactory = (options: PresentationModeOptions) => IPresentationMode

