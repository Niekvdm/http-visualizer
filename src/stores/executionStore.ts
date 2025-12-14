import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ExecutionState, ExecutionHistory, ExecutionPhase } from '@/types'
import { generateId } from '@/utils/formatters'
import {
  getRandomFetchingText,
  getRandomAuthText,
  getRandomAuthorizingText,
  getRandomSuccessText,
  getRandomErrorText,
} from '@/utils/funnyTexts'

export const useExecutionStore = defineStore('execution', () => {
  // State
  const executionState = ref<ExecutionState>({
    phase: 'idle',
    funnyText: '',
    startTime: 0,
  })
  const history = ref<ExecutionHistory[]>([])

  // Current request being executed (for context)
  const currentRequestId = ref<string | null>(null)
  const currentCollectionId = ref<string | null>(null)

  // Computed
  const isExecuting = computed(() => {
    return (
      executionState.value.phase !== 'idle' &&
      executionState.value.phase !== 'success' &&
      executionState.value.phase !== 'error'
    )
  })

  const currentPhase = computed(() => executionState.value.phase)
  const currentFunnyText = computed(() => executionState.value.funnyText)
  const currentResponse = computed(() => executionState.value.response)
  const currentError = computed(() => executionState.value.error)
  const currentSentRequest = computed(() => executionState.value.sentRequest)

  // Actions
  function setCurrentRequest(requestId: string, collectionId: string) {
    currentRequestId.value = requestId
    currentCollectionId.value = collectionId
  }

  function clearCurrentRequest() {
    currentRequestId.value = null
    currentCollectionId.value = null
  }

  function setExecutionPhase(phase: ExecutionPhase) {
    executionState.value.phase = phase

    switch (phase) {
      case 'authenticating':
        executionState.value.funnyText = getRandomAuthText()
        executionState.value.startTime = Date.now()
        break
      case 'authorizing':
        executionState.value.funnyText = getRandomAuthorizingText()
        if (executionState.value.startTime === 0) {
          executionState.value.startTime = Date.now()
        }
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
        executionState.value.duration =
          executionState.value.endTime - executionState.value.startTime
        clearOAuthState()
        break
      case 'error':
        executionState.value.funnyText = getRandomErrorText()
        executionState.value.endTime = Date.now()
        executionState.value.duration =
          executionState.value.endTime - executionState.value.startTime
        clearOAuthState()
        break
      case 'idle':
        executionState.value.funnyText = ''
        executionState.value.startTime = 0
        executionState.value.endTime = undefined
        executionState.value.duration = undefined
        executionState.value.sentRequest = undefined
        executionState.value.response = undefined
        executionState.value.error = undefined
        clearOAuthState()
        break
    }
  }

  // OAuth state management for iframe-based auth
  function setOAuthState(
    authUrl: string,
    state: string,
    tokenKey: string,
    usePopup = false
  ) {
    executionState.value.oauthAuthUrl = authUrl
    executionState.value.oauthState = state
    executionState.value.oauthTokenKey = tokenKey
    executionState.value.oauthUsePopup = usePopup
  }

  function clearOAuthState() {
    executionState.value.oauthAuthUrl = undefined
    executionState.value.oauthState = undefined
    executionState.value.oauthTokenKey = undefined
    executionState.value.oauthUsePopup = undefined
  }

  function setOAuthUsePopup(usePopup: boolean) {
    executionState.value.oauthUsePopup = usePopup
  }

  function updateFunnyText() {
    if (executionState.value.phase === 'authenticating') {
      executionState.value.funnyText = getRandomAuthText()
    } else if (executionState.value.phase === 'authorizing') {
      executionState.value.funnyText = getRandomAuthorizingText()
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
    clearCurrentRequest()
  }

  function clearAll() {
    history.value = []
    reset()
  }

  return {
    // State
    executionState,
    history,
    currentRequestId,
    currentCollectionId,

    // Computed
    isExecuting,
    currentPhase,
    currentFunnyText,
    currentResponse,
    currentError,
    currentSentRequest,

    // Actions
    setCurrentRequest,
    clearCurrentRequest,
    setExecutionPhase,
    updateFunnyText,
    addToHistory,
    clearHistory,
    reset,
    clearAll,
    // OAuth state management
    setOAuthState,
    clearOAuthState,
    setOAuthUsePopup,
  }
})
