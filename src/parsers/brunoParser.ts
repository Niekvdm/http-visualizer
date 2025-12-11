import type { ParsedRequest, ParsedFile, HttpMethod, HttpHeader, HttpAuth } from './types'
import { generateId } from '@/utils/formatters'

// Parse .bru (Bruno) file format
export function parseBrunoFile(fileName: string, content: string): ParsedFile {
  const requests: ParsedRequest[] = []
  const globalVariables: Record<string, string> = {}
  const environments: Record<string, Record<string, string>> = {}
  
  // Bruno files contain a single request per file
  const { request, variables, envVars } = parseBrunoRequest(fileName, content)
  if (request) {
    requests.push(request)
  }
  
  // Merge variables
  Object.assign(globalVariables, variables)
  
  // Merge environment variables
  for (const [envName, vars] of Object.entries(envVars)) {
    if (!environments[envName]) {
      environments[envName] = {}
    }
    Object.assign(environments[envName], vars)
  }
  
  return {
    id: generateId(),
    name: fileName,
    path: fileName,
    type: 'bruno',
    requests,
    variables: globalVariables,
    environments: Object.keys(environments).length > 0 ? environments : undefined,
  }
}

function parseBrunoRequest(fileName: string, content: string): {
  request: ParsedRequest | null
  variables: Record<string, string>
  envVars: Record<string, Record<string, string>>
} {
  const sections = parseBrunoSections(content)
  const variables: Record<string, string> = {}
  const envVars: Record<string, Record<string, string>> = {}
  
  // Get meta section
  const meta = sections.get('meta') || {}
  const name = (typeof meta === 'object' && 'name' in meta ? meta.name : null) || fileName.replace('.bru', '')
  
  // Get HTTP section
  const http = sections.get('get') || sections.get('post') || sections.get('put') || 
               sections.get('patch') || sections.get('delete') || sections.get('head') || 
               sections.get('options')
  
  if (!http) {
    return { request: null, variables, envVars }
  }
  
  // Determine method from section name
  let method: HttpMethod = 'GET'
  for (const m of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']) {
    if (sections.has(m)) {
      method = m.toUpperCase() as HttpMethod
      break
    }
  }
  
  const url = (typeof http === 'object' && 'url' in http ? http.url : '') || ''
  
  // Parse headers
  const headers: HttpHeader[] = []
  const headersSection = sections.get('headers')
  if (headersSection) {
    for (const [key, value] of Object.entries(headersSection)) {
      if (typeof value === 'string') {
        headers.push({ key, value, enabled: true })
      }
    }
  }
  
  // Parse body
  let body: string | undefined
  let bodyType: 'json' | 'text' | 'form' | 'multipart' | 'graphql' | undefined
  
  const bodyJson = sections.get('body:json')
  const bodyText = sections.get('body:text')
  const bodyForm = sections.get('body:form-urlencoded')
  const bodyMultipart = sections.get('body:multipart-form')
  const bodyGraphql = sections.get('body:graphql')
  
  if (bodyJson) {
    body = typeof bodyJson === 'string' ? bodyJson : JSON.stringify(bodyJson, null, 2)
    bodyType = 'json'
  } else if (bodyText) {
    body = String(bodyText)
    bodyType = 'text'
  } else if (bodyForm) {
    body = typeof bodyForm === 'object' ? new URLSearchParams(bodyForm as Record<string, string>).toString() : String(bodyForm)
    bodyType = 'form'
  } else if (bodyMultipart) {
    body = JSON.stringify(bodyMultipart, null, 2)
    bodyType = 'multipart'
  } else if (bodyGraphql) {
    body = typeof bodyGraphql === 'string' ? bodyGraphql : JSON.stringify(bodyGraphql, null, 2)
    bodyType = 'graphql'
  }
  
  // Parse auth
  const auth = parseAuth(sections)
  
  // Parse variables from vars section
  const varsSection = sections.get('vars') || sections.get('vars:pre-request') || sections.get('vars:post-response')
  if (varsSection && typeof varsSection === 'object') {
    for (const [key, value] of Object.entries(varsSection)) {
      variables[key] = String(value)
    }
  }
  
  // Parse environment-specific variables (vars:env:envName)
  for (const [sectionName, sectionValue] of sections.entries()) {
    const envMatch = sectionName.match(/^vars:env:(\w+)$/)
    if (envMatch && typeof sectionValue === 'object') {
      const envName = envMatch[1]
      if (!envVars[envName]) {
        envVars[envName] = {}
      }
      for (const [key, value] of Object.entries(sectionValue)) {
        envVars[envName][key] = String(value)
      }
    }
  }
  
  const request: ParsedRequest = {
    id: generateId(),
    name,
    method,
    url,
    headers,
    body,
    bodyType,
    auth,
    variables,
    source: 'bruno',
    raw: content,
  }
  
  return { request, variables, envVars }
}

function parseBrunoSections(content: string): Map<string, Record<string, string> | string> {
  const sections = new Map<string, Record<string, string> | string>()
  const lines = content.split('\n')
  
  let currentSection: string | null = null
  let currentContent: string[] = []
  let braceDepth = 0
  let inBlock = false
  
  const flushSection = () => {
    if (currentSection && currentContent.length > 0) {
      const contentStr = currentContent.join('\n').trim()
      
      // Try to parse as key-value pairs
      const parsed = parseKeyValuePairs(contentStr)
      if (Object.keys(parsed).length > 0) {
        sections.set(currentSection, parsed)
      } else {
        sections.set(currentSection, contentStr)
      }
    }
    currentContent = []
  }
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Track brace depth
    const openBraces = (trimmed.match(/\{/g) || []).length
    const closeBraces = (trimmed.match(/\}/g) || []).length
    braceDepth += openBraces - closeBraces
    
    // Section header (e.g., "meta {", "get {", "headers {", "vars:env:dev {")
    const sectionMatch = trimmed.match(/^([\w:-]+)\s*\{$/)
    if (sectionMatch && !inBlock) {
      flushSection()
      currentSection = sectionMatch[1].toLowerCase()
      inBlock = true
      braceDepth = 1
      continue
    }
    
    // End of section
    if (trimmed === '}' && braceDepth === 0 && inBlock) {
      flushSection()
      currentSection = null
      inBlock = false
      continue
    }
    
    // Content line
    if (inBlock && currentSection) {
      currentContent.push(line)
    }
  }
  
  // Flush any remaining section
  flushSection()
  
  return sections
}

function parseKeyValuePairs(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) {
      continue
    }
    
    // Match key: value or key = value
    const match = trimmed.match(/^([\w-]+)\s*[:=]\s*(.+)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      
      result[key] = value
    }
  }
  
  return result
}

function parseAuth(sections: Map<string, Record<string, string> | string>): HttpAuth {
  // Check for bearer auth
  const bearerAuth = sections.get('auth:bearer')
  if (bearerAuth && typeof bearerAuth === 'object') {
    return {
      type: 'bearer',
      bearer: { token: bearerAuth.token || '' }
    }
  }
  
  // Check for basic auth
  const basicAuth = sections.get('auth:basic')
  if (basicAuth && typeof basicAuth === 'object') {
    return {
      type: 'basic',
      basic: {
        username: basicAuth.username || '',
        password: basicAuth.password || ''
      }
    }
  }
  
  // Check for API key auth
  const apiKeyAuth = sections.get('auth:api-key')
  if (apiKeyAuth && typeof apiKeyAuth === 'object') {
    return {
      type: 'api-key',
      apiKey: {
        key: apiKeyAuth.key || '',
        value: apiKeyAuth.value || '',
        in: (apiKeyAuth.in as 'header' | 'query') || 'header'
      }
    }
  }
  
  // Check for OAuth2
  const oauth2Auth = sections.get('auth:oauth2')
  if (oauth2Auth && typeof oauth2Auth === 'object') {
    return {
      type: 'oauth2',
      oauth2: {
        grantType: oauth2Auth.grant_type || 'client_credentials',
        accessTokenUrl: oauth2Auth.access_token_url || '',
        clientId: oauth2Auth.client_id || '',
        clientSecret: oauth2Auth.client_secret || '',
        scope: oauth2Auth.scope
      }
    }
  }
  
  return { type: 'none' }
}
