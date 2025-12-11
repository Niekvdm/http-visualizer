<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useCollectionStore } from '@/stores/collectionStore'

const props = defineProps<{
  modelValue: string
  collectionId?: string
  placeholder?: string
  type?: 'text' | 'password'
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const environmentStore = useEnvironmentStore()
const collectionStore = useCollectionStore()

const isEditing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// Get collection variables
const collectionVariables = computed(() => {
  if (!props.collectionId) return {}
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

// Parse value into segments (text and variables)
const segments = computed(() => {
  const result: Array<
    | { type: 'text'; value: string }
    | { type: 'variable'; name: string; resolved: ReturnType<typeof resolveVariable> }
  > = []
  
  if (!props.modelValue) return result
  
  const regex = /(\{\{[^}]+\}\})/g
  const parts = props.modelValue.split(regex)
  
  for (const part of parts) {
    if (!part) continue
    
    const varMatch = part.match(/^\{\{([^}]+)\}\}$/)
    if (varMatch) {
      const name = varMatch[1].trim()
      result.push({
        type: 'variable',
        name,
        resolved: resolveVariable(name)
      })
    } else {
      result.push({ type: 'text', value: part })
    }
  }
  
  return result
})

// Check if value has any variables
const hasVariables = computed(() => {
  return segments.value.some(s => s.type === 'variable')
})

function startEditing() {
  isEditing.value = true
  setTimeout(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  }, 0)
}

function stopEditing() {
  isEditing.value = false
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    stopEditing()
  }
}

// Mask password values
function maskValue(value: string): string {
  if (props.type === 'password') {
    return '•'.repeat(Math.min(value.length, 20))
  }
  return value
}
</script>

<template>
  <div class="variable-input relative w-full">
    <!-- Display mode with badges -->
    <div
      v-if="!isEditing && hasVariables"
      class="flex items-center gap-0 px-3 py-2 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded cursor-text font-mono overflow-hidden whitespace-nowrap hover:border-[var(--color-text-dim)]"
      @click="startEditing"
    >
      <template v-for="(segment, index) in segments" :key="index">
        <!-- Text segment -->
        <span v-if="segment.type === 'text'" class="text-[var(--color-text)] truncate">
          {{ maskValue(segment.value) }}
        </span>
        
        <!-- Variable badge -->
        <span
          v-else
          class="variable-badge group inline-flex items-center px-1 py-0.5 mx-0.5 rounded text-[10px] font-medium transition-all duration-150 shrink-0"
          :class="[
            segment.resolved
              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/30'
              : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)] border border-[var(--color-warning)]/30'
          ]"
        >
          <!-- Resolved value (shown by default) -->
          <span class="group-hover:hidden">
            {{ segment.resolved ? maskValue(segment.resolved.value) : '⚠ undefined' }}
          </span>
          <!-- Variable name (shown on hover) -->
          <span class="hidden group-hover:inline">{{ segment.name }}</span>
        </span>
      </template>
      
      <!-- Placeholder if empty -->
      <span v-if="!modelValue" class="text-[var(--color-text-dim)]">
        {{ placeholder }}
      </span>
    </div>

    <!-- Edit mode / no variables mode -->
    <input
      v-else
      ref="inputRef"
      :value="modelValue"
      :type="type || 'text'"
      :placeholder="placeholder"
      class="w-full px-3 py-2 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)]"
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

