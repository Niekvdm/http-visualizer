import type { Collection } from '@/types'
import { generateId } from '@/utils/formatters'
import { 
  collections, 
  selectedCollectionId, 
  selectedFolderId, 
  selectedRequestId 
} from './collectionState'

/**
 * Collection CRUD operations
 */

export function createCollection(name: string, description?: string): Collection {
  const now = Date.now()
  const collection: Collection = {
    id: generateId(),
    name,
    description,
    folders: [],
    requests: [],
    variables: {},
    collapsed: false,
    createdAt: now,
    updatedAt: now,
  }
  collections.value.push(collection)
  selectedCollectionId.value = collection.id
  return collection
}

export function updateCollection(
  id: string,
  updates: Partial<Omit<Collection, 'id' | 'createdAt'>>
) {
  const collection = collections.value.find(c => c.id === id)
  if (collection) {
    Object.assign(collection, updates, { updatedAt: Date.now() })
  }
}

export function deleteCollection(id: string) {
  const index = collections.value.findIndex(c => c.id === id)
  if (index >= 0) {
    collections.value.splice(index, 1)
    if (selectedCollectionId.value === id) {
      selectedCollectionId.value = collections.value.length > 0 ? collections.value[0].id : null
      selectedFolderId.value = null
      selectedRequestId.value = null
    }
  }
}

export function toggleCollectionCollapse(id: string) {
  const collection = collections.value.find(c => c.id === id)
  if (collection) {
    collection.collapsed = !collection.collapsed
  }
}

export function exportCollections(): Collection[] {
  return JSON.parse(JSON.stringify(collections.value))
}

export function importCollections(imported: Collection[], merge = false) {
  if (merge) {
    const existingIds = new Set(collections.value.map(c => c.id))
    for (const collection of imported) {
      if (!existingIds.has(collection.id)) {
        collections.value.push(collection)
      }
    }
  } else {
    collections.value = imported
  }
}

/**
 * Import a single collection directly (from Import Wizard)
 * Unlike importCollections, this always adds to existing collections
 */
export function importCollection(collection: Collection): void {
  collections.value.push(collection)
  selectedCollectionId.value = collection.id
}

