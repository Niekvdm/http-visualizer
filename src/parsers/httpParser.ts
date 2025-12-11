import type { ParsedRequest, ParsedFile, HttpMethod, HttpHeader, HttpAuth } from './types'
import { generateId } from '@/utils/formatters'

// Parse .http file format (used by REST Client VS Code extension and others)
export function parseHttpFile(fileName: string, content: string): ParsedFile {
  const lines = content.split('\n')
  const requests: ParsedRequest[] = []
  const globalVariables: Record<string, string> = {}
  const environments: Record<string, Record<string, string>> = {}
  
  let currentRequest: Partial<ParsedRequest> | null = null
  let currentSection: 'headers' | 'body' | null = null
  let bodyLines: string[] = []
  let rawLines: string[] = []
  
  const flushRequest = () => {
    if (currentRequest && currentRequest.method && currentRequest.url) {
      if (bodyLines.length > 0) {
        currentRequest.body = bodyLines.join('\n').trim()
        currentRequest.bodyType = detectBodyType(currentRequest.body, currentRequest.headers || [])
      }
      currentRequest.raw = rawLines.join('\n')
      requests.push(currentRequest as ParsedRequest)
    }
    currentRequest = null
    currentSection = null
    bodyLines = []
    rawLines = []
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()
    
    // Request separator
    if (trimmedLine.startsWith('###')) {
      flushRequest()
      continue
    }
    
    // Comments and request names
    if (trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
      const nameMatch = trimmedLine.match(/@name\s+(.+)/)
      if (nameMatch && currentRequest) {
        currentRequest.name = nameMatch[1].trim()
      }
      rawLines.push(line)
      continue
    }
    
    // Environment-specific variable definition: @env:envName @varName = value
    const envVarMatch = trimmedLine.match(/^@env:(\w+)\s+@(\w+)\s*=\s*(.+)$/)
    if (envVarMatch) {
      const [, envName, varName, varValue] = envVarMatch
      if (!environments[envName]) {
        environments[envName] = {}
      }
      environments[envName][varName] = varValue.trim()
      continue
    }
    
    // Global variable definition: @varName = value
    if (trimmedLine.startsWith('@') && trimmedLine.includes('=')) {
      const match = trimmedLine.match(/^@(\w+)\s*=\s*(.+)$/)
      if (match) {
        globalVariables[match[1]] = match[2].trim()
      }
      continue
    }
    
    // Empty line - switch to body section if we have a request
    if (trimmedLine === '') {
      if (currentRequest && currentSection === 'headers') {
        currentSection = 'body'
      }
      if (currentSection === 'body') {
        bodyLines.push(line)
      }
      rawLines.push(line)
      continue
    }
    
    // Request line (METHOD URL)
    const requestMatch = trimmedLine.match(/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(.+?)(?:\s+HTTP\/[\d.]+)?$/i)
    if (requestMatch) {
      flushRequest()
      currentRequest = {
        id: generateId(),
        name: `Request ${requests.length + 1}`,
        method: requestMatch[1].toUpperCase() as HttpMethod,
        // Store the raw URL with variables - resolution happens at execution time
        url: requestMatch[2],
        headers: [],
        auth: { type: 'none' },
        variables: { ...globalVariables },
        source: 'http',
        raw: '',
      }
      currentSection = 'headers'
      rawLines.push(line)
      continue
    }
    
    // Header line
    if (currentSection === 'headers' && trimmedLine.includes(':')) {
      const colonIndex = trimmedLine.indexOf(':')
      const key = trimmedLine.slice(0, colonIndex).trim()
      // Store the raw value with variables - resolution happens at execution time
      const value = trimmedLine.slice(colonIndex + 1).trim()
      
      if (currentRequest) {
        currentRequest.headers = currentRequest.headers || []
        currentRequest.headers.push({ key, value, enabled: true })
        
        // Detect auth from headers (for display purposes, actual value may have variables)
        if (key.toLowerCase() === 'authorization') {
          currentRequest.auth = parseAuthHeader(value)
        }
      }
      rawLines.push(line)
      continue
    }
    
    // Body line
    if (currentSection === 'body') {
      bodyLines.push(line)
      rawLines.push(line)
    }
  }
  
  // Flush last request
  flushRequest()
  
  return {
    id: generateId(),
    name: fileName,
    path: fileName,
    type: 'http',
    requests,
    variables: globalVariables,
    environments: Object.keys(environments).length > 0 ? environments : undefined,
  }
}

function parseAuthHeader(value: string): HttpAuth {
  const lowerValue = value.toLowerCase()
  
  if (lowerValue.startsWith('bearer ')) {
    return {
      type: 'bearer',
      bearer: { token: value.slice(7).trim() }
    }
  }
  
  if (lowerValue.startsWith('basic ')) {
    try {
      const decoded = atob(value.slice(6).trim())
      const [username, password] = decoded.split(':')
      return {
        type: 'basic',
        basic: { username, password: password || '' }
      }
    } catch {
      return { type: 'basic', basic: { username: '', password: '' } }
    }
  }
  
  return { type: 'none' }
}

function detectBodyType(body: string, headers: HttpHeader[]): 'json' | 'text' | 'form' | 'multipart' | 'graphql' {
  const contentType = headers.find(h => h.key.toLowerCase() === 'content-type')?.value.toLowerCase() || ''
  
  if (contentType.includes('application/json') || body.trim().startsWith('{') || body.trim().startsWith('[')) {
    return 'json'
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return 'form'
  }
  if (contentType.includes('multipart/form-data')) {
    return 'multipart'
  }
  if (contentType.includes('application/graphql') || body.includes('query') || body.includes('mutation')) {
    return 'graphql'
  }
  
  return 'text'
}
