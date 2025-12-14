import { ref, computed, watch } from 'vue'
import type { Collection } from '@/types'
import { createWorkspaceScopedStorage, createStorageService } from '@/composables/useStoragePersistence'
import { DEFAULT_WORKSPACE_ID } from '@/stores/workspaceStore'

// Track current workspace ID for storage scoping
let currentWorkspaceId: string | null = null

// Function to get current workspace ID (set by workspaceStore)
function getWorkspaceId(): string | null {
  return currentWorkspaceId
}

// Storage service for persistence (workspace-scoped)
const storage = createWorkspaceScopedStorage<{
  collections: Collection[]
  selectedCollectionId: string | null
  selectedFolderId: string | null
  selectedRequestId: string | null
}>('collections', 'collections', getWorkspaceId)

// Legacy storage for migration
const legacyStorage = createStorageService<{
  collections: Collection[]
  selectedCollectionId: string | null
  selectedFolderId: string | null
  selectedRequestId: string | null
}>('collections', 'collections')

// Core state
export const collections = ref<Collection[]>([])
export const selectedCollectionId = ref<string | null>(null)
export const selectedFolderId = ref<string | null>(null)
export const selectedRequestId = ref<string | null>(null)
export const isEditing = ref(false)
export const isInitialized = ref(false)

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

/**
 * Set the current workspace ID for storage operations
 * Called by workspaceStore when workspace changes
 */
export function setCurrentWorkspaceId(workspaceId: string | null) {
  currentWorkspaceId = workspaceId
}

/**
 * Get the current workspace ID
 */
export function getCurrentWorkspaceId(): string | null {
  return currentWorkspaceId
}

// Persistence functions

/**
 * Load collections for a specific workspace
 */
export function loadForWorkspace(workspaceId: string) {
  currentWorkspaceId = workspaceId
  const stored = storage.loadForWorkspace(workspaceId)
  if (stored) {
    collections.value = stored.collections || []
    selectedCollectionId.value = stored.selectedCollectionId || null
    selectedFolderId.value = stored.selectedFolderId || null
    selectedRequestId.value = stored.selectedRequestId || null
  } else {
    // No data for this workspace yet
    collections.value = []
    selectedCollectionId.value = null
    selectedFolderId.value = null
    selectedRequestId.value = null
  }
}

// Sync load for browser (immediate) - uses current workspace
export function loadFromStorageSync() {
  if (!currentWorkspaceId) {
    // No workspace set yet, try default
    currentWorkspaceId = DEFAULT_WORKSPACE_ID
  }
  
  const stored = storage.loadSync()
  if (stored) {
    collections.value = stored.collections || []
    selectedCollectionId.value = stored.selectedCollectionId || null
    selectedFolderId.value = stored.selectedFolderId || null
    selectedRequestId.value = stored.selectedRequestId || null
  }
}

// Async initialization for Wails mode
export async function initialize() {
  if (isInitialized.value) return

  if (!currentWorkspaceId) {
    currentWorkspaceId = DEFAULT_WORKSPACE_ID
  }

  const stored = await storage.load()
  if (stored) {
    collections.value = stored.collections || []
    selectedCollectionId.value = stored.selectedCollectionId || null
    selectedFolderId.value = stored.selectedFolderId || null
    selectedRequestId.value = stored.selectedRequestId || null
  }
  isInitialized.value = true
}

// Save to storage (fire and forget) - saves to current workspace
export function saveToStorage() {
  if (!currentWorkspaceId) return
  
  storage
    .save({
      collections: collections.value,
      selectedCollectionId: selectedCollectionId.value,
      selectedFolderId: selectedFolderId.value,
      selectedRequestId: selectedRequestId.value,
    })
    .catch((e) => {
      console.error('Failed to save collections:', e)
    })
}

/**
 * Save collections to a specific workspace
 */
export async function saveToWorkspace(workspaceId: string) {
  await storage.saveToWorkspace(workspaceId, {
    collections: collections.value,
    selectedCollectionId: selectedCollectionId.value,
    selectedFolderId: selectedFolderId.value,
    selectedRequestId: selectedRequestId.value,
  })
}

// Legacy function for backwards compatibility
export function loadFromStorage() {
  loadFromStorageSync()
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

/**
 * Migration: Load legacy (non-workspace) collections
 */
export function loadLegacyCollections(): Collection[] | null {
  const stored = legacyStorage.loadSync()
  return stored?.collections || null
}

/**
 * Migration: Remove legacy storage after migration
 */
export async function removeLegacyStorage() {
  await storage.removeLegacy()
}

/**
 * Get collection count for current workspace
 */
export function getCollectionCount(): number {
  return collections.value.length
}
