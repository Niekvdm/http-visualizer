/**
 * Secret Detection Utilities
 * 
 * Scans collections for hardcoded secrets vs variable references.
 * Used to warn users before exporting sensitive data.
 */

import type { 
  Collection, 
  CollectionRequest, 
  CollectionFolder,
  SecretScanResult, 
  SecretFinding,
  SecretFieldType 
} from '@/types'
import type { HttpAuth } from '@/types/auth'

/**
 * Checks if a value uses variable reference syntax like {{variable}}
 */
export function isVariableReference(value: string | undefined): boolean {
  if (!value) return false
  // Match {{variableName}} pattern - the entire value should be a variable or contain variables
  return /\{\{[^}]+\}\}/.test(value)
}

/**
 * Creates a preview of a secret value (first few characters + ellipsis)
 * Only shows preview for hardcoded values to help user identify them
 */
function createValuePreview(value: string): string {
  if (value.length <= 4) return '****'
  return value.substring(0, 3) + '...'
}

/**
 * Gets human-readable field name for a secret field type
 */
function getFieldName(fieldType: SecretFieldType): string {
  const names: Record<SecretFieldType, string> = {
    'basic-password': 'Basic Auth Password',
    'bearer-token': 'Bearer Token',
    'api-key-value': 'API Key Value',
    'oauth2-client-secret': 'OAuth2 Client Secret',
    'oauth2-password': 'OAuth2 Password',
  }
  return names[fieldType]
}

/**
 * Scans an HttpAuth config for secret fields
 */
function scanAuthConfig(
  auth: HttpAuth | undefined,
  locationPath: string
): SecretFinding[] {
  if (!auth || auth.type === 'none') return []
  
  const findings: SecretFinding[] = []
  
  // Basic Auth - check password
  if (auth.type === 'basic' && auth.basic?.password) {
    const isVar = isVariableReference(auth.basic.password)
    findings.push({
      location: locationPath,
      fieldName: getFieldName('basic-password'),
      fieldType: 'basic-password',
      isVariable: isVar,
      valuePreview: isVar ? undefined : createValuePreview(auth.basic.password),
    })
  }
  
  // Bearer Token - check token
  if (auth.type === 'bearer' && auth.bearer?.token) {
    const isVar = isVariableReference(auth.bearer.token)
    findings.push({
      location: locationPath,
      fieldName: getFieldName('bearer-token'),
      fieldType: 'bearer-token',
      isVariable: isVar,
      valuePreview: isVar ? undefined : createValuePreview(auth.bearer.token),
    })
  }
  
  // API Key - check value
  if (auth.type === 'api-key' && auth.apiKey?.value) {
    const isVar = isVariableReference(auth.apiKey.value)
    findings.push({
      location: locationPath,
      fieldName: getFieldName('api-key-value'),
      fieldType: 'api-key-value',
      isVariable: isVar,
      valuePreview: isVar ? undefined : createValuePreview(auth.apiKey.value),
    })
  }
  
  // OAuth2 - check client secret and password
  if (auth.type === 'oauth2' && auth.oauth2) {
    if (auth.oauth2.clientSecret) {
      const isVar = isVariableReference(auth.oauth2.clientSecret)
      findings.push({
        location: locationPath,
        fieldName: getFieldName('oauth2-client-secret'),
        fieldType: 'oauth2-client-secret',
        isVariable: isVar,
        valuePreview: isVar ? undefined : createValuePreview(auth.oauth2.clientSecret),
      })
    }
    
    if (auth.oauth2.password) {
      const isVar = isVariableReference(auth.oauth2.password)
      findings.push({
        location: locationPath,
        fieldName: getFieldName('oauth2-password'),
        fieldType: 'oauth2-password',
        isVariable: isVar,
        valuePreview: isVar ? undefined : createValuePreview(auth.oauth2.password),
      })
    }
  }
  
  return findings
}

/**
 * Scans a single request for secrets
 */
function scanRequest(
  request: CollectionRequest,
  collectionName: string,
  folderName?: string
): SecretFinding[] {
  const locationParts = [collectionName]
  if (folderName) locationParts.push(folderName)
  locationParts.push(request.name)
  const location = locationParts.join(' > ')
  
  return scanAuthConfig(request.auth, location)
}

/**
 * Scans a folder for secrets (folder-level auth)
 */
function scanFolder(
  folder: CollectionFolder,
  collectionName: string
): SecretFinding[] {
  const location = `${collectionName} > ${folder.name} (folder)`
  return scanAuthConfig(folder.auth, location)
}

/**
 * Scans all collections for secret fields
 * Returns detailed findings about hardcoded vs variable-referenced secrets
 */
export function detectSecrets(collections: Collection[]): SecretScanResult {
  const findings: SecretFinding[] = []
  
  for (const collection of collections) {
    // Scan folder-level auth
    for (const folder of collection.folders) {
      findings.push(...scanFolder(folder, collection.name))
    }
    
    // Scan requests
    for (const request of collection.requests) {
      const folderName = request.folderId 
        ? collection.folders.find(f => f.id === request.folderId)?.name
        : undefined
      findings.push(...scanRequest(request, collection.name, folderName))
    }
  }
  
  const variableRefCount = findings.filter(f => f.isVariable).length
  const hardcodedCount = findings.filter(f => !f.isVariable).length
  
  return {
    hasHardcodedSecrets: hardcodedCount > 0,
    totalScanned: findings.length,
    variableRefCount,
    hardcodedCount,
    findings,
  }
}

/**
 * Creates a deep clone of collections with secrets redacted
 * Replaces hardcoded secret values with placeholder text
 */
export function redactSecrets(collections: Collection[]): Collection[] {
  const REDACTED = '{{REDACTED}}'
  
  // Deep clone to avoid mutating original
  const cloned: Collection[] = JSON.parse(JSON.stringify(collections))
  
  for (const collection of cloned) {
    // Redact folder-level auth
    for (const folder of collection.folders) {
      if (folder.auth) {
        redactAuthConfig(folder.auth, REDACTED)
      }
    }
    
    // Redact request auth
    for (const request of collection.requests) {
      if (request.auth) {
        redactAuthConfig(request.auth, REDACTED)
      }
    }
  }
  
  return cloned
}

/**
 * Redacts secrets in an auth config (mutates the object)
 */
function redactAuthConfig(auth: HttpAuth, placeholder: string): void {
  if (auth.type === 'none') return
  
  // Basic Auth - redact password if hardcoded
  if (auth.basic?.password && !isVariableReference(auth.basic.password)) {
    auth.basic.password = placeholder
  }
  
  // Bearer Token - redact token if hardcoded
  if (auth.bearer?.token && !isVariableReference(auth.bearer.token)) {
    auth.bearer.token = placeholder
  }
  
  // API Key - redact value if hardcoded
  if (auth.apiKey?.value && !isVariableReference(auth.apiKey.value)) {
    auth.apiKey.value = placeholder
  }
  
  // OAuth2 - redact client secret and password if hardcoded
  if (auth.oauth2) {
    if (auth.oauth2.clientSecret && !isVariableReference(auth.oauth2.clientSecret)) {
      auth.oauth2.clientSecret = placeholder
    }
    if (auth.oauth2.password && !isVariableReference(auth.oauth2.password)) {
      auth.oauth2.password = placeholder
    }
  }
}

/**
 * Gets only the hardcoded (non-variable) findings for display
 */
export function getHardcodedFindings(result: SecretScanResult): SecretFinding[] {
  return result.findings.filter(f => !f.isVariable)
}

/**
 * Formats findings for display in a warning message
 */
export function formatFindingsForDisplay(findings: SecretFinding[], maxItems = 5): string[] {
  const hardcoded = findings.filter(f => !f.isVariable)
  const displayed = hardcoded.slice(0, maxItems)
  const remaining = hardcoded.length - displayed.length
  
  const lines = displayed.map(f => `• ${f.location}: ${f.fieldName}`)
  
  if (remaining > 0) {
    lines.push(`• ...and ${remaining} more`)
  }
  
  return lines
}

