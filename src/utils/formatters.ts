// Format bytes to human readable string
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

// Format milliseconds to human readable string
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

// Format timestamp to readable date
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

// Format HTTP status code with color class
export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-[var(--color-primary)]'
  if (status >= 300 && status < 400) return 'text-[var(--color-secondary)]'
  if (status >= 400 && status < 500) return 'text-[var(--color-warning)]'
  return 'text-[var(--color-error)]'
}

// Format JSON with syntax highlighting (returns HTML)
export function formatJson(json: string | object): string {
  try {
    const obj = typeof json === 'string' ? JSON.parse(json) : json
    return JSON.stringify(obj, null, 2)
  } catch {
    return typeof json === 'string' ? json : JSON.stringify(json)
  }
}

// Try to parse JSON, return null if invalid
export function tryParseJson(str: string): unknown | null {
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}

// Check if a string is valid JSON
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

// Get method color class
export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'text-[var(--color-primary)]',
    POST: 'text-[var(--color-secondary)]',
    PUT: 'text-[var(--color-warning)]',
    PATCH: 'text-yellow-400',
    DELETE: 'text-[var(--color-error)]',
    HEAD: 'text-purple-400',
    OPTIONS: 'text-gray-400',
  }
  return colors[method.toUpperCase()] || 'text-[var(--color-text)]'
}

// Truncate string with ellipsis
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

// Extract domain from URL
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url
  }
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

