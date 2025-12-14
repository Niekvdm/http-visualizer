/**
 * Import Converter Utilities
 *
 * Converts ParsedRequest/ParsedFile (from file imports) to Collection/CollectionRequest format.
 */

import type { ParsedRequest, ParsedFile } from '@/types/request'
import type { Collection, CollectionRequest, ImportMetadata } from '@/types/collection'
import { generateId } from '@/utils/formatters'

/**
 * Convert a ParsedRequest to a CollectionRequest
 */
export function parsedRequestToCollectionRequest(
  parsed: ParsedRequest,
  folderId?: string
): CollectionRequest {
  const now = Date.now()

  return {
    id: generateId(),
    name: parsed.name,
    method: parsed.method,
    url: parsed.url,
    headers: parsed.headers,
    body: parsed.body,
    bodyType: parsed.bodyType,
    auth: parsed.auth,
    variables: parsed.variables,
    folderId,
    source: parsed.source,
    raw: parsed.raw,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Convert a ParsedFile to a new Collection
 */
export function parsedFileToCollection(
  parsed: ParsedFile,
  customName?: string
): Collection {
  const now = Date.now()

  const importMetadata: ImportMetadata = {
    originalFileName: parsed.name,
    fileType: parsed.type,
    importedAt: now,
  }

  const requests = parsed.requests.map(req =>
    parsedRequestToCollectionRequest(req)
  )

  return {
    id: generateId(),
    name: customName || parsed.name.replace(/\.(http|rest|bru)$/i, ''),
    description: `Imported from ${parsed.name}`,
    folders: [],
    requests,
    variables: parsed.variables || {},
    collapsed: false,
    importMetadata,
    environments: parsed.environments,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Merge requests from a ParsedFile into an existing Collection
 */
export function mergeIntoCollection(
  collection: Collection,
  parsed: ParsedFile,
  folderId?: string
): Collection {
  const newRequests = parsed.requests.map(req =>
    parsedRequestToCollectionRequest(req, folderId)
  )

  // Merge variables (existing take precedence)
  const mergedVariables = { ...parsed.variables, ...collection.variables }

  // Merge environments if present
  let mergedEnvironments = collection.environments
  if (parsed.environments) {
    mergedEnvironments = { ...parsed.environments, ...collection.environments }
  }

  return {
    ...collection,
    requests: [...collection.requests, ...newRequests],
    variables: mergedVariables,
    environments: mergedEnvironments,
    updatedAt: Date.now(),
  }
}

/**
 * Get a summary of what will be imported
 */
export function getImportSummary(parsed: ParsedFile): {
  requestCount: number
  variableCount: number
  environmentCount: number
  fileName: string
  fileType: 'http' | 'bruno'
} {
  return {
    requestCount: parsed.requests.length,
    variableCount: Object.keys(parsed.variables || {}).length,
    environmentCount: Object.keys(parsed.environments || {}).length,
    fileName: parsed.name,
    fileType: parsed.type,
  }
}
