import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  PresentationMode, 
  PresentationPhase, 
  PresentationSettings,
  TerminalLine,
  ParsedRequest,
  ExecutionState
} from '@/types'

const SESSION_STORAGE_KEY = 'http-visualizer-presentation'

// Default settings
const defaultSettings: PresentationSettings = {
  typingSpeed: 50,           // 50 chars/sec
  autoAdvance: true,
  autoAdvanceDelay: 2000,    // 2 seconds between phases
  dramaticPauses: true,
  showJsonReveal: true,
  soundEnabled: false,
}

// Story narratives for different phases
const storyNarratives: Record<string, string[]> = {
  idle: [
    "A new adventure awaits...",
    "Select your quest from the sidebar.",
  ],
  intro: [
    "Our brave request prepares for its journey...",
    "The destination is set, the payload is ready.",
  ],
  auth: [
    "But first, the guardian must be satisfied!",
    "The secret tokens are presented...",
    "The gates begin to open...",
  ],
  sending: [
    "With credentials in hand, our hero ventures forth!",
    "Through the vast network it travels...",
    "Packets dance through the digital realm...",
  ],
  receiving: [
    "A response echoes from the distant server!",
    "The data streams back through the void...",
  ],
  success: [
    "Victory! The server has answered!",
    "A treasure trove of data has been retrieved!",
    "The quest is complete!",
  ],
  error: [
    "Alas! The server has rejected our plea!",
    "An error has occurred in the realm...",
    "But fear not, for we shall try again!",
  ],
}

export const usePresentationStore = defineStore('presentation', () => {
  // State
  const mode = ref<PresentationMode>('dialog')
  const phase = ref<PresentationPhase>('idle')
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const settings = ref<PresentationSettings>({ ...defaultSettings })
  
  // Terminal mode state
  const terminalLines = ref<TerminalLine[]>([])
  const currentTypingLine = ref<string>('')
  const typingProgress = ref(0)
  
  // Story mode state
  const currentNarrativeIndex = ref(0)
  const narrativeOpacity = ref(0)
  
  // Space mode state
  const rocketLaunched = ref(false)
  const rocketProgress = ref(0)
  const satelliteReceiving = ref(false)
  const countdown = ref(3)
  
  // Shared animation state
  const phaseProgress = ref(0)
  const jsonRevealProgress = ref(0)
  
  // Timers
  let typingTimer: ReturnType<typeof setInterval> | null = null
  let phaseTimer: ReturnType<typeof setTimeout> | null = null
  let animationFrame: number | null = null

  // Computed
  const isPresentationMode = computed(() => mode.value !== 'dialog')
  
  const currentNarrative = computed(() => {
    const narratives = storyNarratives[phase.value] || storyNarratives.idle
    return narratives[currentNarrativeIndex.value % narratives.length]
  })

  const modeLabel = computed(() => {
    const labels: Record<string, string> = {
      dialog: 'Dialog View',
      terminal: 'Terminal Mode',
      sequence: 'Sequence Diagram',
      network: 'Network Topology',
    }
    return labels[mode.value] || mode.value
  })

  // Initialize from storage
  function initFromStorage() {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.mode) mode.value = data.mode
        if (data.settings) settings.value = { ...defaultSettings, ...data.settings }
      }
    } catch (error) {
      console.error('Failed to load presentation state:', error)
    }
  }

  // Save to storage
  function saveToStorage() {
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
        mode: mode.value,
        settings: settings.value,
      }))
    } catch (error) {
      console.error('Failed to save presentation state:', error)
    }
  }

  // Actions
  function setMode(newMode: PresentationMode) {
    mode.value = newMode
    resetState()
    saveToStorage()
  }

  function setPhase(newPhase: PresentationPhase) {
    phase.value = newPhase
    phaseProgress.value = 0
    currentNarrativeIndex.value = 0
    narrativeOpacity.value = 0
    
    // Mode-specific phase handling
    if (mode.value === 'terminal') {
      handleTerminalPhase(newPhase)
    } else if ((mode.value as string) === 'story') {
      handleStoryPhase(newPhase)
    } else if ((mode.value as string) === 'space') {
      handleSpacePhase(newPhase)
    }
  }

  function handleTerminalPhase(newPhase: PresentationPhase) {
    if (newPhase === 'idle') {
      terminalLines.value = [
        { text: 'HTTP Visualizer v1.0', type: 'info' },
        { text: '─'.repeat(40), type: 'info' },
        { text: 'Ready for requests...', type: 'output' },
      ]
    }
  }

  function handleStoryPhase(newPhase: PresentationPhase) {
    // Fade in the narrative
    narrativeOpacity.value = 0
    const fadeIn = () => {
      if (narrativeOpacity.value < 1) {
        narrativeOpacity.value += 0.02
        requestAnimationFrame(fadeIn)
      }
    }
    requestAnimationFrame(fadeIn)
  }

  function handleSpacePhase(newPhase: PresentationPhase) {
    if (newPhase === 'sending') {
      countdown.value = 3
      rocketLaunched.value = false
      rocketProgress.value = 0
      
      // Countdown then launch
      const countdownInterval = setInterval(() => {
        countdown.value--
        if (countdown.value <= 0) {
          clearInterval(countdownInterval)
          rocketLaunched.value = true
          animateRocket()
        }
      }, 1000)
    } else if (newPhase === 'success' || newPhase === 'receiving') {
      satelliteReceiving.value = true
    }
  }

  function animateRocket() {
    const animate = () => {
      if (rocketProgress.value < 1) {
        rocketProgress.value += 0.01
        animationFrame = requestAnimationFrame(animate)
      }
    }
    animationFrame = requestAnimationFrame(animate)
  }

  function addTerminalLine(text: string, type: TerminalLine['type'] = 'output') {
    terminalLines.value.push({ text, type, timestamp: Date.now() })
    
    // Keep only last 20 lines
    if (terminalLines.value.length > 20) {
      terminalLines.value = terminalLines.value.slice(-20)
    }
  }

  function typeText(text: string, callback?: () => void) {
    currentTypingLine.value = ''
    typingProgress.value = 0
    
    let index = 0
    const chars = text.split('')
    const interval = 1000 / settings.value.typingSpeed
    
    if (typingTimer) clearInterval(typingTimer)
    
    typingTimer = setInterval(() => {
      if (index < chars.length) {
        currentTypingLine.value += chars[index]
        typingProgress.value = index / chars.length
        index++
      } else {
        if (typingTimer) clearInterval(typingTimer)
        typingTimer = null
        typingProgress.value = 1
        addTerminalLine(text, 'command')
        currentTypingLine.value = ''
        callback?.()
      }
    }, interval)
  }

  function advanceNarrative() {
    const narratives = storyNarratives[phase.value] || storyNarratives.idle
    currentNarrativeIndex.value = (currentNarrativeIndex.value + 1) % narratives.length
    narrativeOpacity.value = 0
    
    // Fade in new narrative
    const fadeIn = () => {
      if (narrativeOpacity.value < 1) {
        narrativeOpacity.value += 0.02
        requestAnimationFrame(fadeIn)
      }
    }
    requestAnimationFrame(fadeIn)
  }

  function play() {
    isPlaying.value = true
    isPaused.value = false
  }

  function pause() {
    isPaused.value = true
  }

  function resume() {
    isPaused.value = false
  }

  function stop() {
    isPlaying.value = false
    isPaused.value = false
    resetState()
  }

  function resetState() {
    phase.value = 'idle'
    phaseProgress.value = 0
    jsonRevealProgress.value = 0
    terminalLines.value = []
    currentTypingLine.value = ''
    typingProgress.value = 0
    currentNarrativeIndex.value = 0
    narrativeOpacity.value = 0
    rocketLaunched.value = false
    rocketProgress.value = 0
    satelliteReceiving.value = false
    countdown.value = 3
    
    if (typingTimer) {
      clearInterval(typingTimer)
      typingTimer = null
    }
    if (phaseTimer) {
      clearTimeout(phaseTimer)
      phaseTimer = null
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
  }

  function updateSettings(newSettings: Partial<PresentationSettings>) {
    settings.value = { ...settings.value, ...newSettings }
    saveToStorage()
  }

  function advancePhase() {
    if (isPaused.value) return
    
    const phaseOrder: PresentationPhase[] = ['idle', 'intro', 'auth', 'sending', 'receiving', 'success']
    const currentIndex = phaseOrder.indexOf(phase.value)
    
    if (currentIndex < phaseOrder.length - 1) {
      setPhase(phaseOrder[currentIndex + 1])
    }
  }

  // Sync with execution state from requestStore
  // Note: Terminal mode handles its own output via TerminalMode class
  // This only updates the presentation store phase for UI indicators
  function syncWithExecution(executionState: ExecutionState, request: ParsedRequest | null) {
    if (!isPresentationMode.value) return
    
    switch (executionState.phase) {
      case 'idle':
        setPhase('idle')
        break
      case 'authenticating':
        setPhase('auth')
        break
      case 'fetching':
        setPhase('sending')
        break
      case 'success':
        setPhase('success')
        break
      case 'error':
        setPhase('error')
        break
    }
  }

  // Generate terminal output for a request
  function generateTerminalOutput(request: ParsedRequest) {
    terminalLines.value = [
      { text: 'HTTP Visualizer v1.0', type: 'info' },
      { text: '─'.repeat(40), type: 'info' },
      { text: '', type: 'output' },
    ]
    
    typeText(`> Preparing ${request.method} request...`, () => {
      setTimeout(() => {
        addTerminalLine(`  URL: ${request.url}`, 'output')
        addTerminalLine(`  Headers: ${request.headers.length}`, 'output')
        if (request.body) {
          addTerminalLine(`  Body: ${request.body.length} bytes`, 'output')
        }
      }, 500)
    })
  }

  // Initialize
  initFromStorage()

  return {
    // State
    mode,
    phase,
    isPlaying,
    isPaused,
    settings,
    terminalLines,
    currentTypingLine,
    typingProgress,
    currentNarrativeIndex,
    narrativeOpacity,
    rocketLaunched,
    rocketProgress,
    satelliteReceiving,
    countdown,
    phaseProgress,
    jsonRevealProgress,
    
    // Computed
    isPresentationMode,
    currentNarrative,
    modeLabel,
    
    // Actions
    setMode,
    setPhase,
    addTerminalLine,
    typeText,
    advanceNarrative,
    play,
    pause,
    resume,
    stop,
    resetState,
    updateSettings,
    advancePhase,
    syncWithExecution,
    generateTerminalOutput,
  }
})

