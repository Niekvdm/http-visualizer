import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Theme, ThemeColors } from '@/types'
import { createStorageService } from '@/composables/useStoragePersistence'

// Storage service for theme persistence
const themeStorage = createStorageService<string>('current-theme', 'theme')

// Predefined themes
const themes: Theme[] = [
  {
    id: 'matrix',
    name: 'Matrix',
    colors: {
      bg: '#0a0a0a',
      bgSecondary: '#111111',
      bgTertiary: '#1a1a1a',
      primary: '#00ff41',
      primaryDim: '#00cc33',
      secondary: '#33ff66',
      error: '#ff0040',
      warning: '#ffb800',
      text: '#b0ffb0',
      textDim: '#6b8f6b',
      border: '#00ff4133',
      glow: '#00ff4180',
    }
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    colors: {
      bg: '#0d0221',
      bgSecondary: '#150734',
      bgTertiary: '#1a0a40',
      primary: '#ff00ff',
      primaryDim: '#cc00cc',
      secondary: '#00ffff',
      error: '#ff3366',
      warning: '#ffcc00',
      text: '#e0e0ff',
      textDim: '#8080a0',
      border: '#ff00ff33',
      glow: '#ff00ff80',
    }
  },
  {
    id: 'amber',
    name: 'Amber Terminal',
    colors: {
      bg: '#0a0800',
      bgSecondary: '#121008',
      bgTertiary: '#1a1810',
      primary: '#ffb000',
      primaryDim: '#cc8c00',
      secondary: '#ff6600',
      error: '#ff3333',
      warning: '#ffff00',
      text: '#ffd080',
      textDim: '#8f7040',
      border: '#ffb00033',
      glow: '#ffb00080',
    }
  },
  {
    id: 'phosphor',
    name: 'Phosphor Green',
    colors: {
      bg: '#001100',
      bgSecondary: '#002200',
      bgTertiary: '#003300',
      primary: '#33ff33',
      primaryDim: '#22cc22',
      secondary: '#66ff66',
      error: '#ff4444',
      warning: '#ffff44',
      text: '#88ff88',
      textDim: '#448844',
      border: '#33ff3333',
      glow: '#33ff3380',
    }
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    colors: {
      bg: '#0a0a14',
      bgSecondary: '#10101e',
      bgTertiary: '#181828',
      primary: '#6688ff',
      primaryDim: '#4466dd',
      secondary: '#88aaff',
      error: '#ff6688',
      warning: '#ffaa44',
      text: '#c0c0e0',
      textDim: '#6060a0',
      border: '#6688ff33',
      glow: '#6688ff80',
    }
  },
  {
    id: 'paper',
    name: 'Paper Light',
    colors: {
      bg: '#faf8f5',
      bgSecondary: '#f0ede8',
      bgTertiary: '#e6e2db',
      primary: '#c25a3c',
      primaryDim: '#a84830',
      secondary: '#2d7d9a',
      error: '#c9302c',
      warning: '#d68910',
      text: '#2c2825',
      textDim: '#7a746c',
      border: '#c25a3c25',
      glow: '#c25a3c40',
    }
  },
  {
    id: 'solarized-light',
    name: 'Solarized Light',
    colors: {
      bg: '#fdf6e3',
      bgSecondary: '#eee8d5',
      bgTertiary: '#e4ddc8',
      primary: '#268bd2',
      primaryDim: '#1a6091',
      secondary: '#2aa198',
      error: '#dc322f',
      warning: '#b58900',
      text: '#073642',
      textDim: '#586e75',
      border: '#268bd230',
      glow: '#268bd250',
    }
  },
  {
    id: 'github-light',
    name: 'GitHub Light',
    colors: {
      bg: '#ffffff',
      bgSecondary: '#f6f8fa',
      bgTertiary: '#eaeef2',
      primary: '#0969da',
      primaryDim: '#0550ae',
      secondary: '#8250df',
      error: '#cf222e',
      warning: '#9a6700',
      text: '#1f2328',
      textDim: '#656d76',
      border: '#0969da25',
      glow: '#0969da40',
    }
  },
  {
    id: 'rose-pine-dawn',
    name: 'Rosé Pine Dawn',
    colors: {
      bg: '#faf4ed',
      bgSecondary: '#fffaf3',
      bgTertiary: '#f2e9e1',
      primary: '#b4637a',
      primaryDim: '#9a4d63',
      secondary: '#907aa9',
      error: '#b4637a',
      warning: '#ea9d34',
      text: '#575279',
      textDim: '#9893a5',
      border: '#b4637a30',
      glow: '#b4637a50',
    }
  },
  {
    id: 'blueprint',
    name: 'Blueprint',
    colors: {
      bg: '#1a2744',
      bgSecondary: '#1e2f52',
      bgTertiary: '#243760',
      primary: '#6cb4ee',
      primaryDim: '#4a7ab8',
      secondary: '#88ccff',
      error: '#ff6b6b',
      warning: '#ffd93d',
      text: '#c5ddf5',
      textDim: '#7a9bc5',
      border: '#6cb4ee35',
      glow: '#6cb4ee60',
    }
  },
]

const DEFAULT_THEME = 'matrix'

// Synchronous load for initial render (browser only, falls back to default in Tauri)
function loadFromStorageSync(): string {
  const stored = themeStorage.loadSync()
  if (stored && themes.some((t) => t.id === stored)) {
    return stored
  }
  return DEFAULT_THEME
}

// Async load for full initialization
async function loadFromStorageAsync(): Promise<string> {
  const stored = await themeStorage.load()
  if (stored && themes.some((t) => t.id === stored)) {
    return stored
  }
  return DEFAULT_THEME
}

// Save to storage (fire and forget)
function saveToStorage(themeId: string) {
  themeStorage.save(themeId).catch((err) => {
    console.error('Failed to save theme:', err)
  })
}

export const useThemeStore = defineStore('theme', () => {
  // Use sync load for immediate render (browser only, default in Tauri)
  const currentThemeId = ref(loadFromStorageSync())
  const customColors = ref<Partial<ThemeColors> | null>(null)
  const isInitialized = ref(false)

  // Async initialization for Tauri mode
  async function initialize() {
    if (isInitialized.value) return
    const storedTheme = await loadFromStorageAsync()
    if (storedTheme !== currentThemeId.value) {
      currentThemeId.value = storedTheme
    }
    isInitialized.value = true
  }
  
  const availableThemes = computed(() => themes)
  
  const currentTheme = computed(() => {
    return themes.find(t => t.id === currentThemeId.value) || themes[0]
  })
  
  const colors = computed((): ThemeColors => {
    if (customColors.value) {
      return { ...currentTheme.value.colors, ...customColors.value }
    }
    return currentTheme.value.colors
  })
  
  function setTheme(themeId: string) {
    const theme = themes.find(t => t.id === themeId)
    if (theme) {
      currentThemeId.value = themeId
      customColors.value = null
      saveToStorage(themeId)
    }
  }
  
  function setCustomColor(key: keyof ThemeColors, value: string) {
    if (!customColors.value) {
      customColors.value = {}
    }
    customColors.value[key] = value
  }
  
  function resetCustomColors() {
    customColors.value = null
  }
  
  // Apply CSS variables when colors change
  function applyTheme() {
    const root = document.documentElement
    const c = colors.value
    
    root.style.setProperty('--color-bg', c.bg)
    root.style.setProperty('--color-bg-secondary', c.bgSecondary)
    root.style.setProperty('--color-bg-tertiary', c.bgTertiary)
    root.style.setProperty('--color-primary', c.primary)
    root.style.setProperty('--color-primary-dim', c.primaryDim)
    root.style.setProperty('--color-secondary', c.secondary)
    root.style.setProperty('--color-error', c.error)
    root.style.setProperty('--color-warning', c.warning)
    root.style.setProperty('--color-text', c.text)
    root.style.setProperty('--color-text-dim', c.textDim)
    root.style.setProperty('--color-border', c.border)
    root.style.setProperty('--color-glow', c.glow)
  }
  
  // Watch for color changes and apply
  watch(colors, applyTheme, { immediate: true, deep: true })
  
  return {
    currentThemeId,
    currentTheme,
    availableThemes,
    colors,
    customColors,
    isInitialized,
    initialize,
    setTheme,
    setCustomColor,
    resetCustomColors,
    applyTheme,
  }
})

