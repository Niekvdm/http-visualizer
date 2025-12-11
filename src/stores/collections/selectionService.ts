import { 
  collections,
  selectedCollectionId, 
  selectedFolderId, 
  selectedRequestId, 
  isEditing,
  getCollectionById
} from './collectionState'

/**
 * Selection state management for collections
 */

export function selectCollection(id: string) {
  selectedCollectionId.value = id
  selectedFolderId.value = null
  selectedRequestId.value = null
}

export function selectFolder(collectionId: string, folderId: string) {
  selectedCollectionId.value = collectionId
  selectedFolderId.value = folderId
  selectedRequestId.value = null
}

export function selectRequest(collectionId: string, requestId: string) {
  selectedCollectionId.value = collectionId
  const collection = getCollectionById(collectionId)
  const request = collection?.requests.find(r => r.id === requestId)
  if (request?.folderId) {
    selectedFolderId.value = request.folderId
  }
  selectedRequestId.value = requestId
}

export function setEditing(editing: boolean) {
  isEditing.value = editing
}

export function clearSelection() {
  selectedCollectionId.value = null
  selectedFolderId.value = null
  selectedRequestId.value = null
}

