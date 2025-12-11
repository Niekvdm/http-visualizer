<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Package, Check } from 'lucide-vue-next'

const props = defineProps<{
  data: unknown
  animated?: boolean
}>()

const revealedLines = ref(0)
const isRevealing = ref(false)
const revealComplete = ref(false)

// Helper function for value colors
function getValueColor(value: string): string {
  const trimmed = value.trim().replace(/,$/, '')
  if (trimmed === 'null') return 'text-red-400'
  if (trimmed === 'true' || trimmed === 'false') return 'text-purple-400'
  if (trimmed.startsWith('"')) return 'text-[var(--color-primary)]'
  if (!isNaN(Number(trimmed))) return 'text-orange-400'
  return 'text-[var(--color-text)]'
}

// Format JSON into lines with syntax highlighting
interface JsonLine {
  text: string
  indent: number
  type: 'key' | 'string' | 'number' | 'boolean' | 'null' | 'bracket' | 'punctuation'
  delay: number
}

const jsonLines = computed((): JsonLine[] => {
  if (!props.data) return []
  
  const lines: JsonLine[] = []
  let lineIndex = 0
  
  function processValue(value: unknown, indent: number, isLast: boolean = true): void {
    if (value === null) {
      lines.push({ text: 'null' + (isLast ? '' : ','), indent, type: 'null', delay: lineIndex++ * 50 })
    } else if (typeof value === 'boolean') {
      lines.push({ text: String(value) + (isLast ? '' : ','), indent, type: 'boolean', delay: lineIndex++ * 50 })
    } else if (typeof value === 'number') {
      lines.push({ text: String(value) + (isLast ? '' : ','), indent, type: 'number', delay: lineIndex++ * 50 })
    } else if (typeof value === 'string') {
      const escaped = JSON.stringify(value)
      lines.push({ text: escaped + (isLast ? '' : ','), indent, type: 'string', delay: lineIndex++ * 50 })
    } else if (Array.isArray(value)) {
      lines.push({ text: '[', indent, type: 'bracket', delay: lineIndex++ * 50 })
      value.forEach((item, index) => {
        processValue(item, indent + 1, index === value.length - 1)
      })
      lines.push({ text: ']' + (isLast ? '' : ','), indent, type: 'bracket', delay: lineIndex++ * 50 })
    } else if (typeof value === 'object') {
      lines.push({ text: '{', indent, type: 'bracket', delay: lineIndex++ * 50 })
      const entries = Object.entries(value as Record<string, unknown>)
      entries.forEach(([key, val], index) => {
        const isLastEntry = index === entries.length - 1
        
        // Key
        const keyText = `"${key}": `
        
        // If value is primitive, put on same line
        if (val === null || typeof val === 'boolean' || typeof val === 'number' || typeof val === 'string') {
          let valText: string
          if (val === null) {
            valText = 'null'
          } else if (typeof val === 'string') {
            valText = JSON.stringify(val)
          } else {
            valText = String(val)
          }
          lines.push({ 
            text: keyText + valText + (isLastEntry ? '' : ','), 
            indent: indent + 1, 
            type: 'key', 
            delay: lineIndex++ * 50 
          })
        } else {
          // Complex value - key on its own line
          lines.push({ text: keyText, indent: indent + 1, type: 'key', delay: lineIndex++ * 50 })
          processValue(val, indent + 1, isLastEntry)
        }
      })
      lines.push({ text: '}' + (isLast ? '' : ','), indent, type: 'bracket', delay: lineIndex++ * 50 })
    }
  }
  
  processValue(props.data, 0)
  return lines
})

// Start reveal animation
function startReveal() {
  if (props.animated === false) {
    revealedLines.value = jsonLines.value.length
    revealComplete.value = true
    return
  }
  
  isRevealing.value = true
  revealedLines.value = 0
  
  const revealNext = () => {
    if (revealedLines.value < jsonLines.value.length) {
      revealedLines.value++
      setTimeout(revealNext, 40)
    } else {
      isRevealing.value = false
      revealComplete.value = true
    }
  }
  
  setTimeout(revealNext, 200)
}

// Get color class for token type
function getColorClass(type: JsonLine['type']): string {
  switch (type) {
    case 'key':
      return 'text-[var(--color-secondary)]'
    case 'string':
      return 'text-[var(--color-primary)]'
    case 'number':
      return 'text-orange-400'
    case 'boolean':
      return 'text-purple-400'
    case 'null':
      return 'text-red-400'
    case 'bracket':
      return 'text-[var(--color-text-dim)]'
    default:
      return 'text-[var(--color-text)]'
  }
}

onMounted(() => {
  startReveal()
})

watch(() => props.data, () => {
  startReveal()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
      <div class="flex items-center gap-2">
        <Package class="w-4 h-4 text-[var(--color-primary)]" />
        <span class="text-sm font-medium text-[var(--color-text)]">Response Data</span>
      </div>
      <div class="flex items-center gap-2">
        <span 
          v-if="isRevealing" 
          class="text-xs text-[var(--color-text-dim)] animate-pulse"
        >
          Revealing...
        </span>
        <span 
          v-else-if="revealComplete"
          class="text-xs text-[var(--color-primary)] flex items-center gap-1"
        >
          <Check class="w-3 h-3" /> Complete
        </span>
        <span class="text-xs text-[var(--color-text-dim)]">
          {{ revealedLines }} / {{ jsonLines.length }} lines
        </span>
      </div>
    </div>

    <!-- JSON Content -->
    <div class="flex-1 overflow-auto p-4 font-mono text-sm">
      <div class="relative">
        <!-- Progress bar -->
        <div 
          v-if="isRevealing"
          class="absolute top-0 left-0 h-0.5 bg-[var(--color-primary)] transition-all duration-100"
          :style="{ width: `${(revealedLines / jsonLines.length) * 100}%` }"
        />

        <!-- Lines -->
        <div class="space-y-0.5">
          <div
            v-for="(line, index) in jsonLines.slice(0, revealedLines)"
            :key="index"
            class="flex transition-all duration-200"
            :class="[
              index === revealedLines - 1 && isRevealing ? 'bg-[var(--color-primary)]/10' : ''
            ]"
            :style="{ 
              paddingLeft: `${line.indent * 20}px`,
              animationDelay: `${line.delay}ms`
            }"
          >
            <!-- Line number -->
            <span class="w-8 text-right pr-3 text-[var(--color-text-dim)] opacity-50 select-none">
              {{ index + 1 }}
            </span>
            
            <!-- Content with syntax highlighting -->
            <span :class="getColorClass(line.type)">
              <!-- Highlight keys differently -->
              <template v-if="line.type === 'key' && line.text.includes(':')">
                <span class="text-[var(--color-secondary)]">{{ line.text.split(':')[0] }}</span>
                <span class="text-[var(--color-text-dim)]">:</span>
                <span :class="getValueColor(line.text.split(':').slice(1).join(':').trim())">
                  {{ line.text.split(':').slice(1).join(':') }}
                </span>
              </template>
              <template v-else>
                {{ line.text }}
              </template>
            </span>
          </div>

          <!-- Typing cursor -->
          <div 
            v-if="isRevealing && revealedLines < jsonLines.length"
            class="flex"
            :style="{ paddingLeft: `${(jsonLines[revealedLines]?.indent || 0) * 20 + 32}px` }"
          >
            <span class="w-2 h-4 bg-[var(--color-primary)] animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

