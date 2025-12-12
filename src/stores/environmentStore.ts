import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Environment } from '@/types'
import { generateId } from '@/utils/formatters'

const SESSION_STORAGE_KEY = 'http-visualizer-env'

export const useEnvironmentStore = defineStore('environment', () => {
  // State
  const environments = ref<Environment[]>([
    {
      id: 'default',
      name: 'Default',
      variables: {},
      isDefault: true,
    },
  ])
  const activeEnvironmentId = ref<string | null>('default')
  const fileOverrides = ref<Map<string, Record<string, string>>>(new Map())

  // Initialize from session storage
  function initFromStorage() {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        
        if (data.environments && Array.isArray(data.environments)) {
          environments.value = data.environments
        }
        if (data.activeEnvironmentId !== undefined) {
          activeEnvironmentId.value = data.activeEnvironmentId
        }
        if (data.fileOverrides) {
          fileOverrides.value = new Map(Object.entries(data.fileOverrides))
        }
      }
    } catch (error) {
      console.error('Failed to load environment state from session storage:', error)
    }
  }

  // Save to session storage
  function saveToStorage() {
    try {
      const fileOverridesObj: Record<string, Record<string, string>> = {}
      fileOverrides.value.forEach((value, key) => {
        fileOverridesObj[key] = value
      })
      
      const data = {
        environments: environments.value,
        activeEnvironmentId: activeEnvironmentId.value,
        fileOverrides: fileOverridesObj,
      }
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save environment state to session storage:', error)
    }
  }

  // Watch for changes and auto-save
  watch(
    [environments, activeEnvironmentId, fileOverrides],
    () => {
      saveToStorage()
    },
    { deep: true }
  )

  // Computed
  const activeEnvironment = computed(() => {
    if (!activeEnvironmentId.value) return null
    return environments.value.find(e => e.id === activeEnvironmentId.value) || null
  })

  const activeVariables = computed(() => {
    return activeEnvironment.value?.variables || {}
  })

  const environmentNames = computed(() => {
    return environments.value.map(e => ({ id: e.id, name: e.name }))
  })

  // Actions
  function createEnvironment(name: string, variables: Record<string, string> = {}): Environment {
    const env: Environment = {
      id: generateId(),
      name,
      variables,
    }
    environments.value.push(env)
    return env
  }

  function updateEnvironment(id: string, updates: Partial<Omit<Environment, 'id'>>) {
    const env = environments.value.find(e => e.id === id)
    if (env) {
      if (updates.name !== undefined) env.name = updates.name
      if (updates.variables !== undefined) env.variables = updates.variables
      if (updates.isDefault !== undefined) env.isDefault = updates.isDefault
    }
  }

  function deleteEnvironment(id: string) {
    const index = environments.value.findIndex(e => e.id === id)
    if (index >= 0) {
      const env = environments.value[index]
      // Don't delete the default environment
      if (env.isDefault) return false
      
      environments.value.splice(index, 1)
      
      // If deleted environment was active, switch to default
      if (activeEnvironmentId.value === id) {
        const defaultEnv = environments.value.find(e => e.isDefault)
        activeEnvironmentId.value = defaultEnv?.id || environments.value[0]?.id || null
      }
      return true
    }
    return false
  }

  function setActiveEnvironment(id: string | null) {
    if (id === null || environments.value.find(e => e.id === id)) {
      activeEnvironmentId.value = id
    }
  }

  function setEnvironmentVariable(envId: string, key: string, value: string) {
    const env = environments.value.find(e => e.id === envId)
    if (env) {
      env.variables[key] = value
    }
  }

  function removeEnvironmentVariable(envId: string, key: string) {
    const env = environments.value.find(e => e.id === envId)
    if (env) {
      delete env.variables[key]
    }
  }

  // File overrides
  function setFileOverride(fileId: string, key: string, value: string) {
    if (!fileOverrides.value.has(fileId)) {
      fileOverrides.value.set(fileId, {})
    }
    fileOverrides.value.get(fileId)![key] = value
  }

  function removeFileOverride(fileId: string, key: string) {
    const overrides = fileOverrides.value.get(fileId)
    if (overrides) {
      delete overrides[key]
      if (Object.keys(overrides).length === 0) {
        fileOverrides.value.delete(fileId)
      }
    }
  }

  function setFileOverrides(fileId: string, variables: Record<string, string>) {
    if (Object.keys(variables).length === 0) {
      fileOverrides.value.delete(fileId)
    } else {
      fileOverrides.value.set(fileId, { ...variables })
    }
  }

  function getFileOverrides(fileId: string): Record<string, string> {
    return fileOverrides.value.get(fileId) || {}
  }

  function clearFileOverrides(fileId: string) {
    fileOverrides.value.delete(fileId)
  }

  // Get resolved variables for a specific file (with priority chain)
  function getResolvedVariables(fileId?: string): Record<string, string> {
    const resolved: Record<string, string> = {}
    
    // 1. Start with active environment variables
    if (activeEnvironment.value) {
      Object.assign(resolved, activeEnvironment.value.variables)
    }
    
    // 2. Apply file-level overrides (higher priority)
    if (fileId) {
      const overrides = fileOverrides.value.get(fileId)
      if (overrides) {
        Object.assign(resolved, overrides)
      }
    }
    
    return resolved
  }

  // Import environments from parsed file
  function importFromFile(fileEnvironments: Record<string, Record<string, string>>) {
    for (const [envName, variables] of Object.entries(fileEnvironments)) {
      // Check if environment with this name already exists
      let env = environments.value.find(e => e.name.toLowerCase() === envName.toLowerCase())
      
      if (env) {
        // Merge variables (file variables don't overwrite existing)
        for (const [key, value] of Object.entries(variables)) {
          if (!(key in env.variables)) {
            env.variables[key] = value
          }
        }
      } else {
        // Create new environment
        createEnvironment(envName, variables)
      }
    }
  }

  // Export state for session export
  function exportState(): {
    environments: Environment[]
    activeEnvironmentId: string | null
    fileOverrides: Record<string, Record<string, string>>
  } {
    // Deep copy fileOverrides to ensure all data is properly serialized
    const fileOverridesObj: Record<string, Record<string, string>> = {}
    fileOverrides.value.forEach((value, key) => {
      fileOverridesObj[key] = { ...value }
    })
    
    // Deep copy environments to ensure all data is properly serialized
    // (Vue's reactive proxies can cause issues with direct references)
    return {
      environments: JSON.parse(JSON.stringify(environments.value)),
      activeEnvironmentId: activeEnvironmentId.value,
      fileOverrides: fileOverridesObj,
    }
  }

  // Import state from session import
  function importState(state: {
    environments?: Environment[]
    activeEnvironmentId?: string | null
    fileOverrides?: Record<string, Record<string, string>>
  }) {
    if (state.environments) {
      environments.value = state.environments
    }
    if (state.activeEnvironmentId !== undefined) {
      activeEnvironmentId.value = state.activeEnvironmentId
    }
    if (state.fileOverrides) {
      fileOverrides.value = new Map(Object.entries(state.fileOverrides))
    }
  }

  // Reset to defaults
  function reset() {
    environments.value = [
      {
        id: 'default',
        name: 'Default',
        variables: {},
        isDefault: true,
      },
    ]
    activeEnvironmentId.value = 'default'
    fileOverrides.value = new Map()
  }

  // Initialize on store creation
  initFromStorage()

  return {
    // State
    environments,
    activeEnvironmentId,
    fileOverrides,
    
    // Computed
    activeEnvironment,
    activeVariables,
    environmentNames,
    
    // Actions
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
    setEnvironmentVariable,
    removeEnvironmentVariable,
    setFileOverride,
    removeFileOverride,
    setFileOverrides,
    getFileOverrides,
    clearFileOverrides,
    getResolvedVariables,
    importFromFile,
    exportState,
    importState,
    reset,
    saveToStorage,
  }
})
