<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useCollectionStore } from '@/stores/collectionStore'

const props = defineProps<{
  modelValue: string
  collectionId: string
  placeholder?: string
  invalid?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  blur: []
  keydown: [event: KeyboardEvent]
}>()

const environmentStore = useEnvironmentStore()
const collectionStore = useCollectionStore()

const isEditing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// Get collection variables
const collectionVariables = computed(() => {
  const collection = collectionStore.collections.find(c => c.id === props.collectionId)
  return collection?.variables || {}
})

// Get environment variables
const environmentVariables = computed(() => {
  return environmentStore.activeVariables
})

// Resolve a variable name to its value
function resolveVariable(name: string): { value: string; source: 'environment' | 'collection' } | null {
  if (name in environmentVariables.value) {
    return { value: environmentVariables.value[name], source: 'environment' }
  }
  if (name in collectionVariables.value) {
    return { value: collectionVariables.value[name], source: 'collection' }
  }
  return null
}

// Parse URL into segments (text and variables)
const urlSegments = computed(() => {
  const segments: Array<
    | { type: 'text'; value: string }
    | { type: 'variable'; name: string; resolved: ReturnType<typeof resolveVariable> }
  >[] = []
  
  const regex = /(\{\{[^}]+\}\})/g
  const parts = props.modelValue.split(regex)
  
  for (const part of parts) {
    if (!part) continue
    
    const varMatch = part.match(/^\{\{([^}]+)\}\}$/)
    if (varMatch) {
      const name = varMatch[1].trim()
      segments.push({
        type: 'variable',
        name,
        resolved: resolveVariable(name)
      })
    } else {
      segments.push({ type: 'text', value: part })
    }
  }
  
  return segments
})

// Check if URL has any variables
const hasVariables = computed(() => {
  return urlSegments.value.some(s => s.type === 'variable')
})

function startEditing() {
  isEditing.value = true
  // Focus input after Vue updates DOM
  setTimeout(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  }, 0)
}

function stopEditing() {
  isEditing.value = false
  emit('blur')
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function onKeydown(event: KeyboardEvent) {
  emit('keydown', event)
  if (event.key === 'Enter') {
    stopEditing()
  }
}
</script>

<template>
  <div class="variable-url-input relative w-full">
    <!-- Display mode with badges -->
    <div
      v-if="!isEditing && hasVariables"
      class="url-display flex items-center gap-0 px-3 py-2 text-sm bg-[var(--color-bg)] border rounded cursor-text font-mono overflow-visible whitespace-nowrap"
      :class="[
        invalid 
          ? 'border-[var(--color-warning)]' 
          : 'border-[var(--color-border)] hover:border-[var(--color-text-dim)]'
      ]"
      @click="startEditing"
    >
      <template v-for="(segment, index) in urlSegments" :key="index">
        <!-- Text segment -->
        <span v-if="segment.type === 'text'" class="text-[var(--color-text)]">
          {{ segment.value }}
        </span>
        
        <!-- Variable badge -->
        <span
          v-else
          class="variable-badge group inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-medium transition-all duration-150"
          :class="[
            segment.resolved
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/30'
              : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/30'
          ]"
        >
          <!-- Variable name (shown by default) -->
          <span class="group-hover:hidden">{{ segment.name }}</span>
          <!-- Resolved value (shown on hover) -->
          <span class="hidden group-hover:inline">
            {{ segment.resolved ? segment.resolved.value : '⚠ undefined' }}
          </span>
        </span>
      </template>
      
      <!-- Placeholder if empty -->
      <span v-if="!modelValue" class="text-[var(--color-text-dim)]">
        {{ placeholder || 'Enter URL...' }}
      </span>
    </div>

    <!-- Edit mode / no variables mode -->
    <input
      v-else
      ref="inputRef"
      :value="modelValue"
      type="text"
      :placeholder="placeholder || 'https://api.example.com/endpoint'"
      class="w-full px-3 py-2 text-sm bg-[var(--color-bg)] border rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)]"
      :class="[
        invalid 
          ? 'border-[var(--color-warning)]' 
          : 'border-[var(--color-border)]'
      ]"
      @input="onInput"
      @blur="stopEditing"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.variable-badge {
  vertical-align: baseline;
  cursor: help;
}
</style>

