import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Collection, CollectionFolder, CollectionRequest, HttpMethod, HttpHeader, ParsedRequest } from '@/types'
import { generateId } from '@/utils/formatters'

const STORAGE_KEY = 'http-visualizer-collections'

export const useCollectionStore = defineStore('collections', () => {
  // State
  const collections = ref<Collection[]>([])
  const selectedCollectionId = ref<string | null>(null)
  const selectedFolderId = ref<string | null>(null)
  const selectedRequestId = ref<string | null>(null)
  const isEditing = ref(false)

  // Load from localStorage on init
  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        collections.value = parsed.collections || []
        selectedCollectionId.value = parsed.selectedCollectionId || null
        selectedFolderId.value = parsed.selectedFolderId || null
        selectedRequestId.value = parsed.selectedRequestId || null
      }
    } catch (e) {
      console.error('Failed to load collections from localStorage:', e)
    }
  }

  // Save to localStorage
  function saveToStorage() {
    try {
      const data = {
        collections: collections.value,
        selectedCollectionId: selectedCollectionId.value,
        selectedFolderId: selectedFolderId.value,
        selectedRequestId: selectedRequestId.value,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('Failed to save collections to localStorage:', e)
    }
  }

  // Auto-save on changes
  watch(
    [collections, selectedCollectionId, selectedFolderId, selectedRequestId],
    () => saveToStorage(),
    { deep: true }
  )

  // Computed
  const selectedCollection = computed(() => {
    return collections.value.find(c => c.id === selectedCollectionId.value) || null
  })

  const selectedFolder = computed(() => {
    if (!selectedCollection.value || !selectedFolderId.value) return null
    return selectedCollection.value.folders.find(f => f.id === selectedFolderId.value) || null
  })

  const selectedRequest = computed(() => {
    if (!selectedCollection.value || !selectedRequestId.value) return null
    return selectedCollection.value.requests.find(r => r.id === selectedRequestId.value) || null
  })

  // Get all requests across all collections (flat list)
  const allRequests = computed(() => {
    return collections.value.flatMap(c => 
      c.requests.map(r => ({
        ...r,
        collectionId: c.id,
        collectionName: c.name,
      }))
    )
  })

  // Convert CollectionRequest to ParsedRequest for execution
  function toExecutableRequest(request: CollectionRequest, collectionId: string): ParsedRequest {
    return {
      id: request.id,
      name: request.name,
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
      bodyType: request.bodyType,
      auth: request.auth,
      variables: request.variables,
      source: 'manual',
      raw: '', // Manual requests don't have raw source
    }
  }

  // Get requests for a specific folder
  function getRequestsInFolder(collectionId: string, folderId: string): CollectionRequest[] {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return []
    return collection.requests.filter(r => r.folderId === folderId)
  }

  // Get requests not in any folder (root level)
  function getRootRequests(collectionId: string): CollectionRequest[] {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return []
    return collection.requests.filter(r => !r.folderId)
  }

  // Collection CRUD
  function createCollection(name: string, description?: string): Collection {
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

  function updateCollection(id: string, updates: Partial<Pick<Collection, 'name' | 'description' | 'variables' | 'collapsed'>>) {
    const collection = collections.value.find(c => c.id === id)
    if (collection) {
      Object.assign(collection, updates, { updatedAt: Date.now() })
    }
  }

  function deleteCollection(id: string) {
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

  function toggleCollectionCollapse(id: string) {
    const collection = collections.value.find(c => c.id === id)
    if (collection) {
      collection.collapsed = !collection.collapsed
    }
  }

  // Folder CRUD
  function createFolder(collectionId: string, name: string): CollectionFolder | null {
    const collection = collections.value.find(c => c.id === collectionId)
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

  function updateFolder(collectionId: string, folderId: string, updates: Partial<Pick<CollectionFolder, 'name' | 'collapsed'>>) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return

    const folder = collection.folders.find(f => f.id === folderId)
    if (folder) {
      Object.assign(folder, updates, { updatedAt: Date.now() })
      collection.updatedAt = Date.now()
    }
  }

  function deleteFolder(collectionId: string, folderId: string) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return

    // Remove folder
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

  function toggleFolderCollapse(collectionId: string, folderId: string) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return

    const folder = collection.folders.find(f => f.id === folderId)
    if (folder) {
      folder.collapsed = !folder.collapsed
    }
  }

  // Request CRUD
  function createRequest(
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
    const collection = collections.value.find(c => c.id === collectionId)
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

  function updateRequest(
    collectionId: string,
    requestId: string,
    updates: Partial<Omit<CollectionRequest, 'id' | 'createdAt' | 'updatedAt'>>
  ) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return

    const request = collection.requests.find(r => r.id === requestId)
    if (request) {
      Object.assign(request, updates, { updatedAt: Date.now() })
      collection.updatedAt = Date.now()
    }
  }

  function deleteRequest(collectionId: string, requestId: string) {
    const collection = collections.value.find(c => c.id === collectionId)
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

  function duplicateRequest(collectionId: string, requestId: string): CollectionRequest | null {
    const collection = collections.value.find(c => c.id === collectionId)
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

  function moveRequest(collectionId: string, requestId: string, targetFolderId: string | undefined) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return

    const request = collection.requests.find(r => r.id === requestId)
    if (request) {
      request.folderId = targetFolderId
      request.updatedAt = Date.now()
      collection.updatedAt = Date.now()
    }
  }

  // Reorder requests within a collection (updates the entire requests array order)
  function reorderRequests(collectionId: string, reorderedRequests: CollectionRequest[]) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return

    collection.requests = reorderedRequests
    collection.updatedAt = Date.now()
  }

  // Reorder folders within a collection
  function reorderFolders(collectionId: string, reorderedFolders: CollectionFolder[]) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return

    collection.folders = reorderedFolders
    collection.updatedAt = Date.now()
  }

  // Move request to a different folder within the same collection
  function moveRequestToFolder(collectionId: string, requestId: string, targetFolderId: string | undefined) {
    const collection = collections.value.find(c => c.id === collectionId)
    if (!collection) return

    const request = collection.requests.find(r => r.id === requestId)
    if (request) {
      request.folderId = targetFolderId
      request.updatedAt = Date.now()
      collection.updatedAt = Date.now()
    }
  }

  // Move request to a different collection
  function moveRequestToCollection(
    requestId: string, 
    sourceCollectionId: string, 
    targetCollectionId: string, 
    targetFolderId?: string
  ) {
    const sourceCollection = collections.value.find(c => c.id === sourceCollectionId)
    const targetCollection = collections.value.find(c => c.id === targetCollectionId)
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

    // Update selection if needed
    if (selectedRequestId.value === requestId) {
      selectedCollectionId.value = targetCollectionId
      selectedFolderId.value = targetFolderId || null
    }
  }

  // Selection
  function selectCollection(id: string) {
    selectedCollectionId.value = id
    selectedFolderId.value = null
    selectedRequestId.value = null
  }

  function selectFolder(collectionId: string, folderId: string) {
    selectedCollectionId.value = collectionId
    selectedFolderId.value = folderId
    selectedRequestId.value = null
  }

  function selectRequest(collectionId: string, requestId: string) {
    selectedCollectionId.value = collectionId
    const collection = collections.value.find(c => c.id === collectionId)
    const request = collection?.requests.find(r => r.id === requestId)
    if (request?.folderId) {
      selectedFolderId.value = request.folderId
    }
    selectedRequestId.value = requestId
  }

  function setEditing(editing: boolean) {
    isEditing.value = editing
  }

  // Find collection containing a request
  function findCollectionByRequestId(requestId: string): Collection | null {
    return collections.value.find(c => c.requests.some(r => r.id === requestId)) || null
  }

  // Export/Import
  function exportCollections(): Collection[] {
    return JSON.parse(JSON.stringify(collections.value))
  }

  function importCollections(imported: Collection[], merge = false) {
    if (merge) {
      // Merge: add new collections, skip existing by ID
      const existingIds = new Set(collections.value.map(c => c.id))
      for (const collection of imported) {
        if (!existingIds.has(collection.id)) {
          collections.value.push(collection)
        }
      }
    } else {
      // Replace all
      collections.value = imported
    }
  }

  function clearSelection() {
    selectedCollectionId.value = null
    selectedFolderId.value = null
    selectedRequestId.value = null
  }

  function clearAll() {
    collections.value = []
    selectedCollectionId.value = null
    selectedFolderId.value = null
    selectedRequestId.value = null
    isEditing.value = false
  }

  // Initialize
  loadFromStorage()

  return {
    // State
    collections,
    selectedCollectionId,
    selectedFolderId,
    selectedRequestId,
    isEditing,

    // Computed
    selectedCollection,
    selectedFolder,
    selectedRequest,
    allRequests,

    // Utilities
    toExecutableRequest,
    getRequestsInFolder,
    getRootRequests,
    findCollectionByRequestId,

    // Collection CRUD
    createCollection,
    updateCollection,
    deleteCollection,
    toggleCollectionCollapse,

    // Folder CRUD
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolderCollapse,

    // Request CRUD
    createRequest,
    updateRequest,
    deleteRequest,
    duplicateRequest,
    moveRequest,
    reorderRequests,
    reorderFolders,
    moveRequestToFolder,
    moveRequestToCollection,

    // Selection
    selectCollection,
    selectFolder,
    selectRequest,
    setEditing,

    // Export/Import
    exportCollections,
    importCollections,
    clearSelection,
    clearAll,

    // Storage
    loadFromStorage,
    saveToStorage,
  }
})

