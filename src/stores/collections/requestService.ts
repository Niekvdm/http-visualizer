import type { CollectionRequest, HttpMethod, HttpHeader, HttpAuth, ParsedRequest } from '@/types'
import { generateId } from '@/utils/formatters'
import { collections, selectedRequestId, getCollectionById } from './collectionState'
import { getFolderAuth } from './folderService'

/**
 * Request CRUD operations for collections
 */

export function getRequestsInFolder(collectionId: string, folderId: string): CollectionRequest[] {
  const collection = getCollectionById(collectionId)
  if (!collection) return []
  return collection.requests.filter(r => r.folderId === folderId)
}

export function getRootRequests(collectionId: string): CollectionRequest[] {
  const collection = getCollectionById(collectionId)
  if (!collection) return []
  return collection.requests.filter(r => !r.folderId)
}

export function getRequestAuthWithInheritance(collectionId: string, requestId: string): HttpAuth | undefined {
  const collection = getCollectionById(collectionId)
  if (!collection) return undefined

  const request = collection.requests.find(r => r.id === requestId)
  if (!request) return undefined

  // If request has its own auth, use it
  if (request.auth && request.auth.type !== 'none') {
    return request.auth
  }

  // If request is in a folder, check folder auth
  if (request.folderId) {
    const folderAuth = getFolderAuth(collectionId, request.folderId)
    if (folderAuth && folderAuth.type !== 'none') {
      return folderAuth
    }
  }

  return undefined
}

export function toExecutableRequest(request: CollectionRequest, collectionId: string): ParsedRequest {
  const resolvedAuth = getRequestAuthWithInheritance(collectionId, request.id)
  
  return {
    id: request.id,
    name: request.name,
    method: request.method,
    url: request.url,
    headers: request.headers,
    body: request.body,
    bodyType: request.bodyType,
    auth: resolvedAuth,
    variables: request.variables,
    source: 'manual',
    raw: '',
  }
}

export function createRequest(
  collectionId: string,
  data: {
    name: string
    method: HttpMethod
    url: string
    headers?: HttpHeader[]
    body?: string
    bodyType?: CollectionRequest['bodyType']
    folderId?: string
  }
): CollectionRequest | null {
  const collection = getCollectionById(collectionId)
  if (!collection) return null

  const now = Date.now()
  const request: CollectionRequest = {
    id: generateId(),
    name: data.name,
    method: data.method,
    url: data.url,
    headers: data.headers || [],
    body: data.body,
    bodyType: data.bodyType,
    folderId: data.folderId,
    createdAt: now,
    updatedAt: now,
  }
  collection.requests.push(request)
  collection.updatedAt = now
  selectedRequestId.value = request.id
  return request
}

export function updateRequest(
  collectionId: string,
  requestId: string,
  updates: Partial<Omit<CollectionRequest, 'id' | 'createdAt' | 'updatedAt'>>
) {
  const collection = getCollectionById(collectionId)
  if (!collection) return

  const request = collection.requests.find(r => r.id === requestId)
  if (request) {
    Object.assign(request, updates, { updatedAt: Date.now() })
    collection.updatedAt = Date.now()
  }
}

export function deleteRequest(collectionId: string, requestId: string) {
  const collection = getCollectionById(collectionId)
  if (!collection) return

  const index = collection.requests.findIndex(r => r.id === requestId)
  if (index >= 0) {
    collection.requests.splice(index, 1)
    collection.updatedAt = Date.now()
    
    if (selectedRequestId.value === requestId) {
      selectedRequestId.value = null
    }
  }
}

export function duplicateRequest(collectionId: string, requestId: string): CollectionRequest | null {
  const collection = getCollectionById(collectionId)
  if (!collection) return null

  const original = collection.requests.find(r => r.id === requestId)
  if (!original) return null

  const now = Date.now()
  const duplicate: CollectionRequest = {
    ...JSON.parse(JSON.stringify(original)),
    id: generateId(),
    name: `${original.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  }
  collection.requests.push(duplicate)
  collection.updatedAt = now
  return duplicate
}

export function moveRequest(collectionId: string, requestId: string, targetFolderId: string | undefined) {
  const collection = getCollectionById(collectionId)
  if (!collection) return

  const request = collection.requests.find(r => r.id === requestId)
  if (request) {
    request.folderId = targetFolderId
    request.updatedAt = Date.now()
    collection.updatedAt = Date.now()
  }
}

export function reorderRequests(collectionId: string, reorderedRequests: CollectionRequest[]) {
  const collection = getCollectionById(collectionId)
  if (!collection) return

  collection.requests = reorderedRequests
  collection.updatedAt = Date.now()
}

export function moveRequestToFolder(collectionId: string, requestId: string, targetFolderId: string | undefined) {
  moveRequest(collectionId, requestId, targetFolderId)
}

export function moveRequestToCollection(
  requestId: string, 
  sourceCollectionId: string, 
  targetCollectionId: string, 
  targetFolderId?: string
) {
  const sourceCollection = getCollectionById(sourceCollectionId)
  const targetCollection = getCollectionById(targetCollectionId)
  if (!sourceCollection || !targetCollection) return

  const requestIndex = sourceCollection.requests.findIndex(r => r.id === requestId)
  if (requestIndex < 0) return

  // Remove from source
  const [request] = sourceCollection.requests.splice(requestIndex, 1)
  sourceCollection.updatedAt = Date.now()

  // Add to target
  request.folderId = targetFolderId
  request.updatedAt = Date.now()
  targetCollection.requests.push(request)
  targetCollection.updatedAt = Date.now()
}

