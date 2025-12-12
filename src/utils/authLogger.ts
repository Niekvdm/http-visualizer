/**
 * Auth Flow Logger
 * 
 * Provides structured logging for OAuth2 authentication flows.
 * Enable via: localStorage.setItem('auth-debug', 'true')
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerOptions {
  namespace: string
  storageKey?: string
}

const STORAGE_KEY = 'auth-debug'

// Styling for different log levels
const styles = {
  namespace: 'color: #8b5cf6; font-weight: bold',
  debug: 'color: #6b7280',
  info: 'color: #3b82f6',
  warn: 'color: #f59e0b',
  error: 'color: #ef4444; font-weight: bold',
  group: 'color: #8b5cf6; font-weight: bold; font-size: 11px',
  data: 'color: #10b981',
}

function isEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function createLogger(options: LoggerOptions) {
  const { namespace } = options
  const prefix = `[${namespace}]`

  function formatMessage(level: LogLevel, message: string): string[] {
    return [`%c${prefix}%c ${message}`, styles.namespace, styles[level]]
  }

  function log(level: LogLevel, message: string, data?: unknown): void {
    if (!isEnabled()) return

    const [formatted, ...styleArgs] = formatMessage(level, message)
    
    if (data !== undefined) {
      console[level](formatted, ...styleArgs, data)
    } else {
      console[level](formatted, ...styleArgs)
    }
  }

  return {
    debug: (message: string, data?: unknown) => log('debug', message, data),
    info: (message: string, data?: unknown) => log('info', message, data),
    warn: (message: string, data?: unknown) => log('warn', message, data),
    error: (message: string, data?: unknown) => log('error', message, data),

    group: (label: string) => {
      if (!isEnabled()) return
      console.groupCollapsed(`%c${prefix} ${label}`, styles.group)
    },

    groupEnd: () => {
      if (!isEnabled()) return
      console.groupEnd()
    },

    /**
     * Log a key-value table (useful for token/config details)
     */
    table: (data: Record<string, unknown>) => {
      if (!isEnabled()) return
      console.table(data)
    },

    /**
     * Time an async operation
     */
    time: (label: string) => {
      if (!isEnabled()) return
      console.time(`${prefix} ${label}`)
    },

    timeEnd: (label: string) => {
      if (!isEnabled()) return
      console.timeEnd(`${prefix} ${label}`)
    },
  }
}

// Pre-configured loggers for different auth components
export const authLogger = createLogger({ namespace: 'Auth' })
export const tokenLogger = createLogger({ namespace: 'Token' })
export const requestLogger = createLogger({ namespace: 'Request' })

// Helper to enable/disable logging programmatically
export function setAuthDebug(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.setItem(STORAGE_KEY, 'true')
      console.log('%c[Auth Debug] Logging enabled', 'color: #10b981; font-weight: bold')
    } else {
      localStorage.removeItem(STORAGE_KEY)
      console.log('%c[Auth Debug] Logging disabled', 'color: #6b7280')
    }
  } catch {
    // localStorage not available
  }
}

// Expose to window for easy toggling in console
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).setAuthDebug = setAuthDebug
}

