<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  text: string
  glitchOnChange?: boolean
  intensity?: 'low' | 'medium' | 'high'
}>(), {
  glitchOnChange: true,
  intensity: 'medium'
})

const displayText = ref(props.text)
const isGlitching = ref(false)
let glitchInterval: ReturnType<typeof setInterval> | null = null

const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`01'

function getRandomChar() {
  return glitchChars[Math.floor(Math.random() * glitchChars.length)]
}

function glitchText(original: string): string {
  const chars = original.split('')
  const glitchCount = props.intensity === 'low' ? 1 : props.intensity === 'high' ? 5 : 3
  
  for (let i = 0; i < glitchCount; i++) {
    const idx = Math.floor(Math.random() * chars.length)
    if (Math.random() > 0.5) {
      chars[idx] = getRandomChar()
    }
  }
  
  return chars.join('')
}

function startGlitch() {
  if (glitchInterval) return
  
  isGlitching.value = true
  let iterations = 0
  const maxIterations = 10
  
  glitchInterval = setInterval(() => {
    displayText.value = glitchText(props.text)
    iterations++
    
    if (iterations >= maxIterations) {
      stopGlitch()
    }
  }, 50)
}

function stopGlitch() {
  if (glitchInterval) {
    clearInterval(glitchInterval)
    glitchInterval = null
  }
  displayText.value = props.text
  isGlitching.value = false
}

watch(() => props.text, (newText) => {
  if (props.glitchOnChange) {
    startGlitch()
  } else {
    displayText.value = newText
  }
})

onMounted(() => {
  if (props.glitchOnChange) {
    startGlitch()
  }
})

onUnmounted(() => {
  stopGlitch()
})
</script>

<template>
  <span 
    class="inline-block font-mono"
    :class="{ 'text-[var(--color-primary)]': isGlitching }"
  >
    {{ displayText }}
  </span>
</template>

