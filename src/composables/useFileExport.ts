import { useRequestStore } from '@/stores/requestStore'
import { useThemeStore } from '@/stores/themeStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useCollectionStore } from '@/stores/collectionStore'
import type { ExportedSession, CollectionExport, Collection } from '@/types'

const VERSION = '1.2.0'
const COLLECTION_VERSION = '1.0.0'

export function useFileExport() {
  const requestStore = useRequestStore()
  const themeStore = useThemeStore()
  const envStore = useEnvironmentStore()
  const collectionStore = useCollectionStore()

  function exportSession(): void {
    // Get environment state for export
    const envState = envStore.exportState()
    
    const session: ExportedSession = {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      files: requestStore.files,
      history: requestStore.history,
      theme: themeStore.currentThemeId,
      variables: requestStore.globalVariables,
      // Include environment data
      environments: envState.environments,
      activeEnvironmentId: envState.activeEnvironmentId,
      fileOverrides: envState.fileOverrides,
    }

    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `http-visualizer-session-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function importSession(file: File): Promise<{ success: boolean; error?: string }> {
    try {
      const content = await file.text()
      const session = JSON.parse(content) as ExportedSession

      // Validate version
      if (!session.version) {
        return { success: false, error: 'Invalid session file: missing version' }
      }

      // Clear current state
      requestStore.clearAll()
      envStore.reset()

      // Import files
      for (const parsedFile of session.files) {
        requestStore.addFile(parsedFile)
        
        // Import environments from parsed files if present
        if (parsedFile.environments) {
          envStore.importFromFile(parsedFile.environments)
        }
      }

      // Import history
      for (const historyItem of session.history) {
        requestStore.history.push(historyItem)
      }

      // Import variables (legacy support)
      for (const [key, value] of Object.entries(session.variables || {})) {
        requestStore.setVariable(key, value)
      }

      // Import theme
      if (session.theme) {
        themeStore.setTheme(session.theme)
      }

      // Import environment state (v1.1.0+)
      if (session.environments || session.activeEnvironmentId !== undefined || session.fileOverrides) {
        envStore.importState({
          environments: session.environments,
          activeEnvironmentId: session.activeEnvironmentId,
          fileOverrides: session.fileOverrides,
        })
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to import session' 
      }
    }
  }

  function exportRequest(requestId: string): void {
    const request = requestStore.allRequests.find(r => r.id === requestId)
    if (!request) return

    const historyItem = requestStore.history.find(h => h.requestId === requestId)
    
    const exportData = {
      request,
      response: historyItem?.state.response,
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${request.name.replace(/\s+/g, '-')}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function exportResponse(): void {
    const response = requestStore.executionState.response
    if (!response) return

    const request = requestStore.selectedRequest
    const fileName = request ? request.name.replace(/\s+/g, '-') : 'response'

    const exportData = {
      request: request ? {
        name: request.name,
        method: request.method,
        url: request.url,
      } : null,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        body: response.bodyParsed || response.body,
        size: response.size,
        timing: response.timing,
      },
      exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName}-response-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Export all collections to a JSON file
  function exportCollections(): void {
    const collections = collectionStore.exportCollections()
    
    if (collections.length === 0) {
      console.warn('No collections to export')
      return
    }

    const exportData: CollectionExport = {
      version: COLLECTION_VERSION,
      exportedAt: new Date().toISOString(),
      collections,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `http-visualizer-collections-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Export a single collection
  function exportCollection(collectionId: string): void {
    const collection = collectionStore.collections.find(c => c.id === collectionId)
    if (!collection) {
      console.warn('Collection not found:', collectionId)
      return
    }

    const exportData: CollectionExport = {
      version: COLLECTION_VERSION,
      exportedAt: new Date().toISOString(),
      collections: [collection],
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `${collection.name.replace(/\s+/g, '-')}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Import collections from a JSON file
  async function importCollections(file: File, merge = true): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
      const content = await file.text()
      const data = JSON.parse(content)

      // Check if this is a collection export
      if (data.collections && Array.isArray(data.collections)) {
        const collections = data.collections as Collection[]
        collectionStore.importCollections(collections, merge)
        return { success: true, count: collections.length }
      }

      // Check if this is a session export (backward compatibility)
      if (data.version && data.files) {
        // This is a session file, not a collection file
        return { success: false, error: 'This is a session file. Use "Import Session" instead.' }
      }

      return { success: false, error: 'Invalid collection file format' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to import collections' 
      }
    }
  }

  return {
    exportSession,
    importSession,
    exportRequest,
    exportResponse,
    exportCollections,
    exportCollection,
    importCollections,
  }
}
