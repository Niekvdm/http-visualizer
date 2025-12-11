import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ParsedFile, ParsedRequest, ExecutionState, ExecutionHistory, ExecutionPhase } from '@/types'
import { generateId } from '@/utils/formatters'
import { getRandomFetchingText, getRandomAuthText, getRandomSuccessText, getRandomErrorText } from '@/utils/funnyTexts'

export const useRequestStore = defineStore('requests', () => {
  // State
  const files = ref<ParsedFile[]>([])
  const selectedFileId = ref<string | null>(null)
  const selectedRequestId = ref<string | null>(null)
  const executionState = ref<ExecutionState>({
    phase: 'idle',
    funnyText: '',
    startTime: 0,
  })
  const history = ref<ExecutionHistory[]>([])
  const globalVariables = ref<Record<string, string>>({})
  
  // Computed
  const selectedFile = computed(() => {
    return files.value.find(f => f.id === selectedFileId.value) || null
  })
  
  const selectedRequest = computed(() => {
    if (!selectedFile.value || !selectedRequestId.value) return null
    return selectedFile.value.requests.find(r => r.id === selectedRequestId.value) || null
  })
  
  const allRequests = computed(() => {
    return files.value.flatMap(f => f.requests.map(r => ({ ...r, fileName: f.name })))
  })
  
  const isExecuting = computed(() => {
    return executionState.value.phase !== 'idle' && 
           executionState.value.phase !== 'success' && 
           executionState.value.phase !== 'error'
  })
  
  // Actions
  function addFile(file: ParsedFile) {
    // Check if file already exists (by name)
    const existingIndex = files.value.findIndex(f => f.name === file.name)
    if (existingIndex >= 0) {
      files.value[existingIndex] = file
    } else {
      files.value.push(file)
    }
    
    // Merge variables
    Object.assign(globalVariables.value, file.variables)
    
    // Auto-select if first file
    if (!selectedFileId.value) {
      selectedFileId.value = file.id
      if (file.requests.length > 0) {
        selectedRequestId.value = file.requests[0].id
      }
    }
  }
  
  function removeFile(fileId: string) {
    const index = files.value.findIndex(f => f.id === fileId)
    if (index >= 0) {
      files.value.splice(index, 1)
      
      // Clear selection if removed file was selected
      if (selectedFileId.value === fileId) {
        selectedFileId.value = files.value.length > 0 ? files.value[0].id : null
        selectedRequestId.value = null
      }
    }
  }
  
  function selectFile(fileId: string) {
    const file = files.value.find(f => f.id === fileId)
    if (file) {
      selectedFileId.value = fileId
      // Auto-select first request
      if (file.requests.length > 0 && !file.requests.find(r => r.id === selectedRequestId.value)) {
        selectedRequestId.value = file.requests[0].id
      }
    }
  }
  
  function selectRequest(requestId: string) {
    selectedRequestId.value = requestId
    
    // Find and select the file containing this request
    for (const file of files.value) {
      if (file.requests.find(r => r.id === requestId)) {
        selectedFileId.value = file.id
        break
      }
    }
  }
  
  function setVariable(key: string, value: string) {
    globalVariables.value[key] = value
  }
  
  function removeVariable(key: string) {
    delete globalVariables.value[key]
  }
  
  // Execution state management
  function setExecutionPhase(phase: ExecutionPhase) {
    executionState.value.phase = phase
    
    switch (phase) {
      case 'authenticating':
        executionState.value.funnyText = getRandomAuthText()
        executionState.value.startTime = Date.now()
        break
      case 'fetching':
        executionState.value.funnyText = getRandomFetchingText()
        if (executionState.value.startTime === 0) {
          executionState.value.startTime = Date.now()
        }
        break
      case 'success':
        executionState.value.funnyText = getRandomSuccessText()
        executionState.value.endTime = Date.now()
        executionState.value.duration = executionState.value.endTime - executionState.value.startTime
        break
      case 'error':
        executionState.value.funnyText = getRandomErrorText()
        executionState.value.endTime = Date.now()
        executionState.value.duration = executionState.value.endTime - executionState.value.startTime
        break
      case 'idle':
        executionState.value.funnyText = ''
        executionState.value.startTime = 0
        executionState.value.endTime = undefined
        executionState.value.duration = undefined
        executionState.value.sentRequest = undefined
        executionState.value.response = undefined
        executionState.value.error = undefined
        break
    }
  }
  
  function updateFunnyText() {
    if (executionState.value.phase === 'authenticating') {
      executionState.value.funnyText = getRandomAuthText()
    } else if (executionState.value.phase === 'fetching') {
      executionState.value.funnyText = getRandomFetchingText()
    }
  }
  
  function addToHistory(requestId: string, requestName: string, state: ExecutionState) {
    history.value.unshift({
      id: generateId(),
      requestId,
      requestName,
      timestamp: Date.now(),
      state: { ...state },
    })
    
    // Keep only last 50 entries
    if (history.value.length > 50) {
      history.value = history.value.slice(0, 50)
    }
  }
  
  function clearHistory() {
    history.value = []
  }
  
  function reset() {
    setExecutionPhase('idle')
  }
  
  function clearSelection() {
    selectedFileId.value = null
    selectedRequestId.value = null
  }
  
  function clearAll() {
    files.value = []
    selectedFileId.value = null
    selectedRequestId.value = null
    history.value = []
    globalVariables.value = {}
    reset()
  }
  
  return {
    // State
    files,
    selectedFileId,
    selectedRequestId,
    executionState,
    history,
    globalVariables,
    
    // Computed
    selectedFile,
    selectedRequest,
    allRequests,
    isExecuting,
    
    // Actions
    addFile,
    removeFile,
    selectFile,
    selectRequest,
    setVariable,
    removeVariable,
    setExecutionPhase,
    updateFunnyText,
    addToHistory,
    clearHistory,
    reset,
    clearSelection,
    clearAll,
  }
})

