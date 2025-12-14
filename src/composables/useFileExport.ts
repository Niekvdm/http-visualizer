import { useRequestStore } from '@/stores/requestStore'
import { useThemeStore } from '@/stores/themeStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { 
  ExportedSession, 
  CollectionExport, 
  Collection,
  EnvironmentExport,
  Environment,
  CollectionExportOptions,
  ExportPreview,
  SecretScanResult,
  WorkspaceExport,
  Workspace,
} from '@/types'
import { detectSecrets, redactSecrets } from '@/utils/secretDetection'

const VERSION = '1.2.0'
const COLLECTION_VERSION = '1.1.0' // Bumped for environment support
const ENVIRONMENT_VERSION = '1.0.0'
const WORKSPACE_VERSION = '1.0.0'

export function useFileExport() {
  const requestStore = useRequestStore()
  const themeStore = useThemeStore()
  const envStore = useEnvironmentStore()
  const collectionStore = useCollectionStore()
  const workspaceStore = useWorkspaceStore()

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
  async function importCollections(file: File, merge = true): Promise<{ 
    success: boolean
    error?: string
    count?: number
    environmentsImported?: number 
  }> {
    try {
      const content = await file.text()
      const data = JSON.parse(content) as CollectionExport

      // Check if this is a collection export
      if (data.collections && Array.isArray(data.collections)) {
        const collections = data.collections as Collection[]
        collectionStore.importCollections(collections, merge)
        
        // Import bundled environments if present (v1.1.0+)
        let environmentsImported = 0
        if (data.environments && Array.isArray(data.environments)) {
          for (const env of data.environments) {
            // Check if environment already exists
            const existing = envStore.environments.find(e => e.name === env.name)
            if (existing) {
              // Merge variables into existing environment (import values take precedence)
              const mergedVariables = { ...existing.variables, ...env.variables }
              envStore.updateEnvironment(existing.id, { variables: mergedVariables })
              environmentsImported++
            } else {
              envStore.createEnvironment(env.name, env.variables)
              environmentsImported++
            }
          }
          // Set active environment if specified and exists
          if (data.activeEnvironmentId) {
            const activeEnv = envStore.environments.find(e => e.id === data.activeEnvironmentId)
            if (activeEnv) {
              envStore.setActiveEnvironment(activeEnv.id)
            }
          }
        }
        
        return { success: true, count: collections.length, environmentsImported }
      }

      // Check if this is a session export (backward compatibility)
      if (data.version && 'files' in data) {
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

  // ============================================
  // Environment Export/Import
  // ============================================

  /**
   * Export all environments to a standalone JSON file
   */
  function exportEnvironments(): void {
    const envState = envStore.exportState()
    
    if (envState.environments.length === 0) {
      console.warn('No environments to export')
      return
    }

    const exportData: EnvironmentExport = {
      version: ENVIRONMENT_VERSION,
      exportedAt: new Date().toISOString(),
      environments: envState.environments,
      activeEnvironmentId: envState.activeEnvironmentId,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `http-visualizer-environments-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Import environments from a JSON file
   */
  async function importEnvironments(file: File, merge = true): Promise<{ 
    success: boolean
    error?: string
    count?: number 
  }> {
    try {
      const content = await file.text()
      const data = JSON.parse(content)

      // Check if this is an environment export
      if (data.environments && Array.isArray(data.environments)) {
        const environments = data.environments as Environment[]
        
        if (!merge) {
          // Replace mode: reset and import all
          envStore.reset()
        }
        
        let importedCount = 0
        for (const env of environments) {
          if (merge) {
            // Merge mode: merge variables into existing environments
            const existing = envStore.environments.find(e => e.name === env.name)
            if (existing) {
              // Merge variables (import values take precedence)
              const mergedVariables = { ...existing.variables, ...env.variables }
              envStore.updateEnvironment(existing.id, { variables: mergedVariables })
              importedCount++
            } else {
              envStore.createEnvironment(env.name, env.variables)
              importedCount++
            }
          } else {
            // Replace mode: create all (except default which was created by reset)
            if (!env.isDefault) {
              envStore.createEnvironment(env.name, env.variables)
            } else {
              // Update default environment variables
              const defaultEnv = envStore.environments.find(e => e.isDefault)
              if (defaultEnv) {
                envStore.updateEnvironment(defaultEnv.id, { variables: env.variables })
              }
            }
            importedCount++
          }
        }
        
        // Set active environment if specified
        if (data.activeEnvironmentId) {
          const activeEnv = envStore.environments.find(e => e.id === data.activeEnvironmentId)
          if (activeEnv) {
            envStore.setActiveEnvironment(activeEnv.id)
          }
        }
        
        return { success: true, count: importedCount }
      }

      // Check if this is a collection export with environments
      if (data.collections && data.environments) {
        return { success: false, error: 'This file contains collections. Use "Import Collections" instead.' }
      }

      return { success: false, error: 'Invalid environment file format' }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to import environments' 
      }
    }
  }

  // ============================================
  // Advanced Collection Export with Options
  // ============================================

  /**
   * Get export preview data for the export modal
   */
  function getExportPreview(): ExportPreview {
    const collections = collectionStore.exportCollections()
    const secretScan = detectSecrets(collections)
    const envState = envStore.exportState()
    
    return {
      collections,
      secretScan,
      environments: envState.environments,
      activeEnvironmentId: envState.activeEnvironmentId,
    }
  }

  /**
   * Export collections with configurable options
   */
  function exportCollectionsWithOptions(options: CollectionExportOptions = {}): void {
    let collections = collectionStore.exportCollections()
    
    if (collections.length === 0) {
      console.warn('No collections to export')
      return
    }

    // Optionally redact secrets
    if (options.redactSecrets) {
      collections = redactSecrets(collections)
    }

    const exportData: CollectionExport = {
      version: COLLECTION_VERSION,
      exportedAt: new Date().toISOString(),
      collections,
    }

    // Optionally include environments
    if (options.includeEnvironments) {
      const envState = envStore.exportState()
      exportData.environments = envState.environments
      exportData.activeEnvironmentId = envState.activeEnvironmentId
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    const suffix = options.includeEnvironments ? '-with-env' : ''
    a.download = `http-visualizer-collections${suffix}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Scan collections for secrets without exporting
   */
  function scanForSecrets(): SecretScanResult {
    const collections = collectionStore.exportCollections()
    return detectSecrets(collections)
  }

  // ============================================
  // Workspace Export/Import
  // ============================================

  /**
   * Export a workspace with all its collections and environments
   */
  function exportWorkspace(workspaceId?: string): void {
    const targetWorkspaceId = workspaceId || workspaceStore.activeWorkspaceId
    if (!targetWorkspaceId) {
      console.warn('No workspace to export')
      return
    }

    const workspace = workspaceStore.getWorkspace(targetWorkspaceId)
    if (!workspace) {
      console.warn('Workspace not found:', targetWorkspaceId)
      return
    }

    // For active workspace, use current data
    // For other workspaces, we'd need to load from storage (not implemented yet)
    if (targetWorkspaceId !== workspaceStore.activeWorkspaceId) {
      console.warn('Can only export the active workspace currently')
      return
    }

    const collections = collectionStore.exportCollections()
    const envState = envStore.exportState()

    const exportData: WorkspaceExport = {
      version: WORKSPACE_VERSION,
      exportedAt: new Date().toISOString(),
      workspace: {
        id: workspace.id,
        name: workspace.name,
        description: workspace.description,
        color: workspace.color,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt,
      },
      collections,
      environments: envState.environments,
      activeEnvironmentId: envState.activeEnvironmentId,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.href = url
    a.download = `workspace-${workspace.name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Import a workspace from a JSON file
   */
  async function importWorkspace(file: File): Promise<{
    success: boolean
    error?: string
    workspaceId?: string
  }> {
    try {
      const content = await file.text()
      const data = JSON.parse(content) as WorkspaceExport

      // Validate workspace export format
      if (!data.workspace || !data.collections) {
        // Check if this might be a collection export instead
        if (data.collections && Array.isArray(data.collections) && !data.workspace) {
          return { success: false, error: 'This is a collection export. Use "Import Collections" instead.' }
        }
        return { success: false, error: 'Invalid workspace file format' }
      }

      // Import the workspace
      const importedWorkspace = workspaceStore.importWorkspace(data.workspace)

      // Save current workspace data before switching
      collectionStore.saveToStorage()
      envStore.saveToStorage()

      // Switch to the new workspace
      workspaceStore.setActiveWorkspace(importedWorkspace.id)
      
      // Set workspace ID in stores
      collectionStore.setCurrentWorkspaceId(importedWorkspace.id)
      envStore.setCurrentWorkspaceId(importedWorkspace.id)

      // Import collections into the new workspace
      collectionStore.importCollections(data.collections, false)

      // Import environments if present
      if (data.environments && Array.isArray(data.environments)) {
        envStore.importState({
          environments: data.environments,
          activeEnvironmentId: data.activeEnvironmentId,
        })
      }

      // Save the imported data
      collectionStore.saveToStorage()
      envStore.saveToStorage()

      return { success: true, workspaceId: importedWorkspace.id }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to import workspace',
      }
    }
  }

  /**
   * Validate if a file is a valid workspace export
   */
  async function validateWorkspaceFile(file: File): Promise<{
    isValid: boolean
    workspace?: Workspace
    collectionCount?: number
    environmentCount?: number
    error?: string
  }> {
    try {
      const content = await file.text()
      const data = JSON.parse(content) as WorkspaceExport

      if (!data.workspace || !data.collections) {
        return { isValid: false, error: 'Invalid workspace file format' }
      }

      return {
        isValid: true,
        workspace: data.workspace,
        collectionCount: data.collections.length,
        environmentCount: data.environments?.length || 0,
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Failed to read file',
      }
    }
  }

  return {
    // Session export/import
    exportSession,
    importSession,
    exportRequest,
    exportResponse,
    
    // Collection export/import
    exportCollections,
    exportCollection,
    importCollections,
    
    // Environment export/import
    exportEnvironments,
    importEnvironments,
    
    // Advanced export with options
    getExportPreview,
    exportCollectionsWithOptions,
    scanForSecrets,

    // Workspace export/import
    exportWorkspace,
    importWorkspace,
    validateWorkspaceFile,
  }
}
