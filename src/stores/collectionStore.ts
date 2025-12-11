import { defineStore } from 'pinia'
import {
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
  // State management
  loadFromStorage,
  saveToStorage,
  setupAutoSave,
  findCollectionByRequestId,
  clearAll,
} from './collections/collectionState'

import {
  createCollection,
  updateCollection,
  deleteCollection,
  toggleCollectionCollapse,
  exportCollections,
  importCollections,
} from './collections/collectionCrud'

import {
  createFolder,
  updateFolder,
  deleteFolder,
  toggleFolderCollapse,
  setFolderAuth,
  getFolderAuth,
  hasFolderAuth,
  reorderFolders,
} from './collections/folderService'

import {
  getRequestsInFolder,
  getRootRequests,
  getRequestAuthWithInheritance,
  toExecutableRequest,
  createRequest,
  updateRequest,
  deleteRequest,
  duplicateRequest,
  moveRequest,
  reorderRequests,
  moveRequestToFolder,
  moveRequestToCollection,
} from './collections/requestService'

import {
  selectCollection,
  selectFolder,
  selectRequest,
  setEditing,
  clearSelection,
} from './collections/selectionService'

/**
 * Collection Store
 * 
 * This store has been refactored to use focused service modules:
 * - collectionState.ts - Core state and computed values
 * - collectionCrud.ts - Collection CRUD operations
 * - folderService.ts - Folder CRUD operations
 * - requestService.ts - Request CRUD operations
 * - selectionService.ts - Selection state management
 * 
 * The store maintains backward compatibility by re-exporting all functions.
 */
export const useCollectionStore = defineStore('collections', () => {
  // Initialize on store creation
  loadFromStorage()
  setupAutoSave()

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
    setFolderAuth,
    getFolderAuth,
    hasFolderAuth,
    getRequestAuthWithInheritance,

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
