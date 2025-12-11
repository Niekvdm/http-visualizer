import type { ParsedRequest, HttpHeader } from '@/types'

// Regex to match {{variableName}} patterns
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g

/**
 * Resolve variables in a string using the provided variables map
 * Variables are in the format {{variableName}}
 */
export function resolveVariables(
  str: string,
  variables: Record<string, string>,
  keepUnresolved = true
): string {
  return str.replace(VARIABLE_PATTERN, (match, varName) => {
    if (varName in variables) {
      return variables[varName]
    }
    // Keep unresolved variables as-is or return empty string
    return keepUnresolved ? match : ''
  })
}

/**
 * Check if a string contains any unresolved variables
 */
export function hasUnresolvedVariables(str: string, variables: Record<string, string>): boolean {
  const matches = str.match(VARIABLE_PATTERN)
  if (!matches) return false
  
  return matches.some(match => {
    const varName = match.slice(2, -2) // Remove {{ and }}
    return !(varName in variables)
  })
}

/**
 * Extract all variable names from a string
 */
export function extractVariableNames(str: string): string[] {
  const matches = str.matchAll(VARIABLE_PATTERN)
  const names: string[] = []
  for (const match of matches) {
    if (!names.includes(match[1])) {
      names.push(match[1])
    }
  }
  return names
}

/**
 * Get all unresolved variable names from a string
 */
export function getUnresolvedVariables(str: string, variables: Record<string, string>): string[] {
  const allVars = extractVariableNames(str)
  return allVars.filter(name => !(name in variables))
}

/**
 * Resolve all variables in a request (URL, headers, body)
 * Returns a new request object with resolved values
 */
export function resolveRequestVariables(
  request: ParsedRequest,
  variables: Record<string, string>
): ParsedRequest {
  return {
    ...request,
    url: resolveVariables(request.url, variables),
    headers: request.headers.map(header => ({
      ...header,
      key: resolveVariables(header.key, variables),
      value: resolveVariables(header.value, variables),
    })),
    body: request.body ? resolveVariables(request.body, variables) : undefined,
  }
}

/**
 * Resolve variables in headers array
 */
export function resolveHeaders(
  headers: HttpHeader[],
  variables: Record<string, string>
): HttpHeader[] {
  return headers.map(header => ({
    ...header,
    key: resolveVariables(header.key, variables),
    value: resolveVariables(header.value, variables),
  }))
}

/**
 * Get a preview of what a string will look like after variable resolution
 * Highlights unresolved variables
 */
export function getResolvedPreview(
  str: string,
  variables: Record<string, string>
): { resolved: string; hasUnresolved: boolean; unresolvedVars: string[] } {
  const unresolvedVars = getUnresolvedVariables(str, variables)
  const resolved = resolveVariables(str, variables)
  
  return {
    resolved,
    hasUnresolved: unresolvedVars.length > 0,
    unresolvedVars,
  }
}

/**
 * Merge multiple variable sources with priority (later sources override earlier)
 */
export function mergeVariables(
  ...sources: (Record<string, string> | undefined)[]
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const source of sources) {
    if (source) {
      Object.assign(result, source)
    }
  }
  return result
}

/**
 * Parse a variable definition line (e.g., "@varName = value")
 * Returns null if the line is not a valid variable definition
 */
export function parseVariableDefinition(line: string): { key: string; value: string } | null {
  const match = line.trim().match(/^@(\w+)\s*=\s*(.+)$/)
  if (match) {
    return {
      key: match[1],
      value: match[2].trim(),
    }
  }
  return null
}

/**
 * Parse an environment-specific variable definition
 * Format: @env:envName @varName = value
 * Returns null if not a valid env-specific definition
 */
export function parseEnvVariableDefinition(
  line: string
): { envName: string; key: string; value: string } | null {
  const match = line.trim().match(/^@env:(\w+)\s+@(\w+)\s*=\s*(.+)$/)
  if (match) {
    return {
      envName: match[1],
      key: match[2],
      value: match[3].trim(),
    }
  }
  return null
}

