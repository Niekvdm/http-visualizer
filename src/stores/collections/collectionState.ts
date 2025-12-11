import { ref, computed, watch } from 'vue'
import type { Collection, CollectionFolder, CollectionRequest } from '@/types'
import { createStorageService } from '@/composables/useStoragePersistence'

const STORAGE_KEY = 'http-visualizer-collections'

// Storage service for persistence
const storage = createStorageService<{
  collections: Collection[]
  selectedCollectionId: string | null
  selectedFolderId: string | null
  selectedRequestId: string | null
}>(STORAGE_KEY)

// Core state
export const collections = ref<Collection[]>([])
export const selectedCollectionId = ref<string | null>(null)
export const selectedFolderId = ref<string | null>(null)
export const selectedRequestId = ref<string | null>(null)
export const isEditing = ref(false)

// Computed getters
export const selectedCollection = computed(() => {
  return collections.value.find(c => c.id === selectedCollectionId.value) || null
})

export const selectedFolder = computed(() => {
  if (!selectedCollection.value || !selectedFolderId.value) return null
  return selectedCollection.value.folders.find(f => f.id === selectedFolderId.value) || null
})

export const selectedRequest = computed(() => {
  if (!selectedCollection.value || !selectedRequestId.value) return null
  return selectedCollection.value.requests.find(r => r.id === selectedRequestId.value) || null
})

export const allRequests = computed(() => {
  return collections.value.flatMap(c => 
    c.requests.map(r => ({
      ...r,
      collectionId: c.id,
      collectionName: c.name,
    }))
  )
})

// Persistence functions
export function loadFromStorage() {
  try {
    const stored = storage.load()
    if (stored) {
      collections.value = stored.collections || []
      selectedCollectionId.value = stored.selectedCollectionId || null
      selectedFolderId.value = stored.selectedFolderId || null
      selectedRequestId.value = stored.selectedRequestId || null
    }
  } catch (e) {
    console.error('Failed to load collections from localStorage:', e)
  }
}

export function saveToStorage() {
  try {
    storage.save({
      collections: collections.value,
      selectedCollectionId: selectedCollectionId.value,
      selectedFolderId: selectedFolderId.value,
      selectedRequestId: selectedRequestId.value,
    })
  } catch (e) {
    console.error('Failed to save collections to localStorage:', e)
  }
}

// Auto-save on changes
export function setupAutoSave() {
  watch(
    [collections, selectedCollectionId, selectedFolderId, selectedRequestId],
    () => saveToStorage(),
    { deep: true }
  )
}

// Helper to find collection by ID
export function getCollectionById(id: string): Collection | null {
  return collections.value.find(c => c.id === id) || null
}

// Helper to find collection containing a request
export function findCollectionByRequestId(requestId: string): Collection | null {
  return collections.value.find(c => c.requests.some(r => r.id === requestId)) || null
}

// Clear all state
export function clearAll() {
  collections.value = []
  selectedCollectionId.value = null
  selectedFolderId.value = null
  selectedRequestId.value = null
  isEditing.value = false
}

