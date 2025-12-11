<script setup lang="ts">
import { computed } from 'vue'
import type { HttpHeader } from '@/types'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { Check, X, AlertCircle } from 'lucide-vue-next'

const props = defineProps<{
  url: string
  headers: HttpHeader[]
  body?: string
  collectionId: string
}>()

const environmentStore = useEnvironmentStore()
const collectionStore = useCollectionStore()

// Get collection variables
const collectionVariables = computed(() => {
  const collection = collectionStore.collections.find(c => c.id === props.collectionId)
  return collection?.variables || {}
})

// Get environment variables
const environmentVariables = computed(() => {
  return environmentStore.activeVariables
})

// Extract variables from URL, headers, and body
const detectedVariables = computed(() => {
  const variables: { 
    name: string
    locations: string[]
    resolved: boolean
    value?: string
    source?: 'environment' | 'collection'
  }[] = []
  const varMap = new Map<string, string[]>()
  
  const varRegex = /\{\{([^}]+)\}\}/g
  
  // Check URL
  let match
  while ((match = varRegex.exec(props.url)) !== null) {
    const name = match[1].trim()
    if (!varMap.has(name)) varMap.set(name, [])
    if (!varMap.get(name)!.includes('URL')) varMap.get(name)!.push('URL')
  }
  
  // Check headers
  for (const header of props.headers) {
    varRegex.lastIndex = 0
    while ((match = varRegex.exec(header.key)) !== null) {
      const name = match[1].trim()
      if (!varMap.has(name)) varMap.set(name, [])
      if (!varMap.get(name)!.includes('Header')) varMap.get(name)!.push('Header')
    }
    varRegex.lastIndex = 0
    while ((match = varRegex.exec(header.value)) !== null) {
      const name = match[1].trim()
      if (!varMap.has(name)) varMap.set(name, [])
      if (!varMap.get(name)!.includes('Header')) varMap.get(name)!.push('Header')
    }
  }
  
  // Check body
  if (props.body) {
    varRegex.lastIndex = 0
    while ((match = varRegex.exec(props.body)) !== null) {
      const name = match[1].trim()
      if (!varMap.has(name)) varMap.set(name, [])
      if (!varMap.get(name)!.includes('Body')) varMap.get(name)!.push('Body')
    }
  }
  
  // Build result with resolution info
  for (const [name, locations] of varMap) {
    // Check environment first, then collection
    if (name in environmentVariables.value) {
      variables.push({
        name,
        locations,
        resolved: true,
        value: environmentVariables.value[name],
        source: 'environment'
      })
    } else if (name in collectionVariables.value) {
      variables.push({
        name,
        locations,
        resolved: true,
        value: collectionVariables.value[name],
        source: 'collection'
      })
    } else {
      variables.push({
        name,
        locations,
        resolved: false
      })
    }
  }
  
  // Sort: unresolved first, then by name
  return variables.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1
    return a.name.localeCompare(b.name)
  })
})

const unresolvedCount = computed(() => 
  detectedVariables.value.filter(v => !v.resolved).length
)
</script>

<template>
  <div class="variables-tab space-y-4">
    <!-- Info text -->
    <div class="text-xs text-[var(--color-text-dim)]">
      <p class="mb-2">
        Use variables in your URL, headers, or body with the syntax: <code class="px-1 py-0.5 bg-[var(--color-bg)] rounded" v-pre>{{variableName}}</code>
      </p>
      <p>
        Variables are resolved from environment and collection settings.
      </p>
    </div>

    <!-- Warning for unresolved variables -->
    <div 
      v-if="unresolvedCount > 0"
      class="flex items-center gap-2 px-3 py-2 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded text-xs text-[var(--color-warning)]"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      <span>{{ unresolvedCount }} unresolved variable{{ unresolvedCount > 1 ? 's' : '' }} - these will not be replaced at runtime</span>
    </div>

    <!-- Detected variables -->
    <div v-if="detectedVariables.length > 0" class="space-y-2">
      <h3 class="text-xs font-bold text-[var(--color-text)] uppercase tracking-wider">
        Detected Variables ({{ detectedVariables.length }})
      </h3>
      <div class="space-y-1">
        <div
          v-for="variable in detectedVariables"
          :key="variable.name"
          class="flex items-center gap-3 px-3 py-2 bg-[var(--color-bg)] rounded border"
          :class="[
            variable.resolved 
              ? 'border-[var(--color-border)]' 
              : 'border-[var(--color-warning)]/50'
          ]"
        >
          <!-- Status icon -->
          <div 
            class="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            :class="[
              variable.resolved 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
            ]"
          >
            <Check v-if="variable.resolved" class="w-3 h-3" />
            <X v-else class="w-3 h-3" />
          </div>

          <!-- Variable name -->
          <code class="text-xs font-mono text-[var(--color-primary)] min-w-[100px]">
            {{ variable.name }}
          </code>

          <!-- Value or unresolved message -->
          <div class="flex-1 min-w-0">
            <template v-if="variable.resolved">
              <code class="text-xs font-mono text-[var(--color-text)] truncate block">
                {{ variable.value }}
              </code>
              <span class="text-[10px] text-[var(--color-text-dim)]">
                from {{ variable.source }}
              </span>
            </template>
            <span v-else class="text-xs text-[var(--color-warning)]">
              Not defined
            </span>
          </div>

          <!-- Locations -->
          <div class="flex gap-1 shrink-0">
            <span
              v-for="loc in variable.locations"
              :key="loc"
              class="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)]"
            >
              {{ loc }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- No variables -->
    <div
      v-else
      class="text-center py-8 text-xs text-[var(--color-text-dim)] bg-[var(--color-bg)] rounded border border-dashed border-[var(--color-border)]"
    >
      No variables detected in this request
    </div>
  </div>
</template>

