<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ParsedRequest } from '@/types'
import { getMethodColor, truncate, extractDomain } from '@/utils/formatters'
import { useAuthStore } from '@/stores/authStore'
import { useRequestStore } from '@/stores/requestStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { resolveVariables, extractVariableNames } from '@/utils/variableResolver'
import AuthConfigModal from '@/components/auth/AuthConfigModal.vue'
import { KeyRound, LockOpen, Play, Variable } from 'lucide-vue-next'

const props = defineProps<{
  request: ParsedRequest
  fileId: string
  isSelected: boolean
}>()

const emit = defineEmits<{
  select: []
  run: []
}>()

const authStore = useAuthStore()
const requestStore = useRequestStore()
const envStore = useEnvironmentStore()

const methodClass = computed(() => getMethodColor(props.request.method))

// Get resolved variables (merging request, file, and environment variables)
const resolvedVariables = computed(() => {
  const file = requestStore.files.find(f => f.id === props.fileId)
  return {
    // Request-level variables (lowest priority)
    ...props.request.variables,
    // File-level variables
    ...file?.variables,
    // Active environment variables
    ...envStore.activeVariables,
    // File overrides (highest priority)
    ...envStore.getFileOverrides(props.fileId),
  }
})

// Resolve URL with variables
const resolvedUrl = computed(() => resolveVariables(props.request.url, resolvedVariables.value))
const domain = computed(() => extractDomain(resolvedUrl.value))

// Check if URL has variables (for indicator)
const urlVariables = computed(() => extractVariableNames(props.request.url))
const hasVariables = computed(() => urlVariables.value.length > 0)

// Check if auth is configured (from file or from auth store)
const hasFileAuth = computed(() => props.request.auth?.type !== 'none' && props.request.auth?.type !== undefined)
const hasOwnAuth = computed(() => authStore.hasOwnAuthConfig(props.request.id))
const hasInheritedAuth = computed(() => !hasOwnAuth.value && authStore.hasFileAuthConfig(props.fileId))
const hasAnyAuth = computed(() => hasFileAuth.value || authStore.hasAuthConfig(props.request.id, props.fileId))

// Auth config source and label
const authSource = computed(() => authStore.getAuthConfigSource(props.request.id, props.fileId))
const authLabel = computed(() => {
  const config = authStore.getAuthConfig(props.request.id, props.fileId)
  if (config) {
    return authStore.getAuthTypeLabel(config.type)
  }
  if (props.request.auth?.type && props.request.auth.type !== 'none') {
    return props.request.auth.type.toUpperCase()
  }
  return null
})

// Auth modal state
const showAuthModal = ref(false)

function openAuthModal() {
  showAuthModal.value = true
}

function closeAuthModal() {
  showAuthModal.value = false
}
</script>

<template>
  <div 
    class="group relative p-3 rounded cursor-pointer transition-all duration-200 border-2"
    :class="[
      isSelected 
        ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/80' 
        : 'bg-[var(--color-bg-tertiary)] border-transparent hover:border-[var(--color-border)]'
    ]"
    @click="emit('select')"
  >
    <!-- Method badge -->
    <div class="flex items-center gap-2 mb-1">
      <span 
        class="text-xs font-bold px-1.5 py-0.5 rounded bg-[var(--color-bg)] font-mono"
        :class="methodClass"
      >
        {{ request.method }}
      </span>
      
      <!-- Auth indicator -->
      <button
        v-if="hasAnyAuth"
        class="text-xs px-1.5 py-0.5 rounded transition-colors flex items-center gap-1"
        :class="[
          hasOwnAuth 
            ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' 
            : hasInheritedAuth
              ? 'bg-[var(--color-secondary)]/20 text-[var(--color-secondary)]'
              : 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]'
        ]"
        :title="hasInheritedAuth ? `Inherited: ${authLabel}` : authLabel || 'Configure authentication'"
        @click.stop="openAuthModal"
      >
        <KeyRound class="w-3 h-3" />
        <span v-if="hasInheritedAuth" class="text-[10px]">↑</span>
      </button>
      
      <!-- Add auth button (shown on hover when no auth) -->
      <button
        v-else
        class="text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:text-[var(--color-primary)]"
        title="Add authentication"
        @click.stop="openAuthModal"
      >
        <LockOpen class="w-3 h-3" />
      </button>
    </div>
    
    <!-- Request name -->
    <div class="text-sm text-[var(--color-text)] font-medium mb-1 truncate pr-16">
      {{ request.name }}
    </div>
    
    <!-- URL preview -->
    <div class="text-xs text-[var(--color-text-dim)] font-mono truncate flex items-center gap-1">
      <span>{{ truncate(domain, 30) }}</span>
      <Variable 
        v-if="hasVariables" 
        class="w-3 h-3 text-[var(--color-secondary)] flex-shrink-0" 
        :title="`Variables: ${urlVariables.join(', ')}`"
      />
    </div>
    
    <!-- Inherited auth indicator -->
    <div 
      v-if="hasInheritedAuth && !hasOwnAuth"
      class="text-[10px] text-[var(--color-secondary)] mt-1"
    >
      ↳ Using folder auth
    </div>
    
    <!-- Run button (visible on hover) -->
    <button 
      class="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs bg-[var(--color-primary)] text-[var(--color-bg)] rounded font-bold hover:brightness-110 flex items-center gap-1"
      @click.stop="emit('run')"
    >
      RUN <Play class="w-3 h-3" />
    </button>
  </div>

  <!-- Auth Config Modal -->
  <AuthConfigModal
    :request-id="request.id"
    :request-name="request.name"
    :file-id="fileId"
    :show="showAuthModal"
    :is-file-auth="false"
    @close="closeAuthModal"
  />
</template>
