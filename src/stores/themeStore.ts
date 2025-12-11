import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Theme, ThemeColors } from '@/types'

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
]

const STORAGE_KEY = 'http-visualizer-theme'

function loadFromStorage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && themes.some(t => t.id === stored)) {
      return stored
    }
  } catch {
    // localStorage not available
  }
  return 'matrix'
}

function saveToStorage(themeId: string) {
  try {
    localStorage.setItem(STORAGE_KEY, themeId)
  } catch {
    // localStorage not available
  }
}

export const useThemeStore = defineStore('theme', () => {
  const currentThemeId = ref(loadFromStorage())
  const customColors = ref<Partial<ThemeColors> | null>(null)
  
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
    setTheme,
    setCustomColor,
    resetCustomColors,
    applyTheme,
  }
})

