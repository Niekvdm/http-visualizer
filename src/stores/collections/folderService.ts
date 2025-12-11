import type { CollectionFolder, HttpAuth } from '@/types'
import { generateId } from '@/utils/formatters'
import { collections, selectedFolderId, getCollectionById } from './collectionState'

/**
 * Folder CRUD operations for collections
 */

export function createFolder(collectionId: string, name: string): CollectionFolder | null {
  const collection = getCollectionById(collectionId)
  if (!collection) return null

  const now = Date.now()
  const folder: CollectionFolder = {
    id: generateId(),
    name,
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  }
  collection.folders.push(folder)
  collection.updatedAt = now
  return folder
}

export function updateFolder(
  collectionId: string, 
  folderId: string, 
  updates: Partial<Pick<CollectionFolder, 'name' | 'collapsed'>>
) {
  const collection = getCollectionById(collectionId)
  if (!collection) return

  const folder = collection.folders.find(f => f.id === folderId)
  if (folder) {
    Object.assign(folder, updates, { updatedAt: Date.now() })
    collection.updatedAt = Date.now()
  }
}

export function deleteFolder(collectionId: string, folderId: string) {
  const collection = getCollectionById(collectionId)
  if (!collection) return

  const index = collection.folders.findIndex(f => f.id === folderId)
  if (index >= 0) {
    collection.folders.splice(index, 1)
    
    // Move requests in this folder to root level
    collection.requests.forEach(r => {
      if (r.folderId === folderId) {
        r.folderId = undefined
      }
    })
    
    collection.updatedAt = Date.now()
    
    if (selectedFolderId.value === folderId) {
      selectedFolderId.value = null
    }
  }
}

export function toggleFolderCollapse(collectionId: string, folderId: string) {
  const collection = getCollectionById(collectionId)
  if (!collection) return

  const folder = collection.folders.find(f => f.id === folderId)
  if (folder) {
    folder.collapsed = !folder.collapsed
  }
}

export function setFolderAuth(collectionId: string, folderId: string, auth: HttpAuth | undefined) {
  const collection = getCollectionById(collectionId)
  if (!collection) return

  const folder = collection.folders.find(f => f.id === folderId)
  if (folder) {
    folder.auth = auth
    folder.updatedAt = Date.now()
    collection.updatedAt = Date.now()
  }
}

export function getFolderAuth(collectionId: string, folderId: string): HttpAuth | undefined {
  const collection = getCollectionById(collectionId)
  if (!collection) return undefined

  const folder = collection.folders.find(f => f.id === folderId)
  return folder?.auth
}

export function hasFolderAuth(collectionId: string, folderId: string): boolean {
  const auth = getFolderAuth(collectionId, folderId)
  return auth !== undefined && auth.type !== 'none'
}

export function reorderFolders(collectionId: string, reorderedFolders: CollectionFolder[]) {
  const collection = getCollectionById(collectionId)
  if (!collection) return

  collection.folders = reorderedFolders
  collection.updatedAt = Date.now()
}

