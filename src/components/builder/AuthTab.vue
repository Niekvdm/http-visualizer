<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { HttpAuth } from '@/types'
import { useCollectionStore } from '@/stores/collectionStore'
import { Lock, Eye, EyeOff, FolderOpen } from 'lucide-vue-next'

const props = defineProps<{
  auth?: HttpAuth
  folderId?: string
  collectionId?: string
}>()

const emit = defineEmits<{
  'update:auth': [auth: HttpAuth | undefined]
}>()

const collectionStore = useCollectionStore()

type AuthType = HttpAuth['type'] | 'inherit'

// Check if folder has auth configured
const folderAuth = computed(() => {
  if (!props.folderId || !props.collectionId) return null
  return collectionStore.getFolderAuth(props.collectionId, props.folderId)
})

const hasFolderAuth = computed(() => {
  return folderAuth.value != null && folderAuth.value.type !== 'none'
})

const folderAuthLabel = computed(() => {
  if (!folderAuth.value || folderAuth.value.type === 'none') return null
  const labels: Record<string, string> = {
    'basic': 'Basic Auth',
    'bearer': 'Bearer Token',
    'api-key': 'API Key',
    'oauth2': 'OAuth2',
  }
  return labels[folderAuth.value.type] || null
})

const baseAuthTypes: { value: HttpAuth['type']; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api-key', label: 'API Key' },
  { value: 'oauth2', label: 'OAuth2' },
]

// Auth types with inherit option if folder has auth
const authTypes = computed(() => {
  if (hasFolderAuth.value) {
    return [
      { value: 'inherit' as AuthType, label: `↑ Inherit (${folderAuthLabel.value})` },
      ...baseAuthTypes
    ]
  }
  return baseAuthTypes
})

// Local state
const localAuth = ref<HttpAuth>({ type: 'none' })
const useInherit = ref(false)
const showPassword = ref(false)
const showToken = ref(false)
const showSecret = ref(false)

// Initialize from props
watch(
  () => props.auth,
  (newAuth) => {
    if (newAuth) {
      localAuth.value = JSON.parse(JSON.stringify(newAuth))
      useInherit.value = false
    } else {
      // No auth set - check if we should default to inherit
      if (hasFolderAuth.value) {
        useInherit.value = true
        localAuth.value = { type: 'none' }
      } else {
        useInherit.value = false
        localAuth.value = { type: 'none' }
      }
    }
  },
  { immediate: true, deep: true }
)

// Current selected type for display
const selectedType = computed(() => {
  if (useInherit.value) return 'inherit'
  return localAuth.value.type
})

// Emit changes
function emitUpdate() {
  if (useInherit.value) {
    // When inheriting, emit undefined so request doesn't have its own auth
    emit('update:auth', undefined)
  } else if (localAuth.value.type === 'none') {
    emit('update:auth', undefined)
  } else {
    emit('update:auth', JSON.parse(JSON.stringify(localAuth.value)))
  }
}

// Change auth type
function setAuthType(type: AuthType) {
  if (type === 'inherit') {
    useInherit.value = true
    localAuth.value = { type: 'none' }
  } else {
    useInherit.value = false
    localAuth.value = createDefaultAuth(type as HttpAuth['type'])
  }
  emitUpdate()
}

// Create default auth config for type
function createDefaultAuth(type: AuthType): HttpAuth {
  switch (type) {
    case 'basic':
      return { type: 'basic', basic: { username: '', password: '' } }
    case 'bearer':
      return { type: 'bearer', bearer: { token: '' } }
    case 'api-key':
      return { type: 'api-key', apiKey: { key: '', value: '', in: 'header' } }
    case 'oauth2':
      return { 
        type: 'oauth2', 
        oauth2: { 
          grantType: 'client_credentials',
          accessTokenUrl: '',
          clientId: '',
          clientSecret: '',
          scope: ''
        } 
      }
    default:
      return { type: 'none' }
  }
}

// Update handlers
function updateBasic(field: 'username' | 'password', value: string) {
  if (localAuth.value.basic) {
    localAuth.value.basic[field] = value
    emitUpdate()
  }
}

function updateBearer(value: string) {
  if (localAuth.value.bearer) {
    localAuth.value.bearer.token = value
    emitUpdate()
  }
}

function updateApiKey(field: 'key' | 'value' | 'in', value: string) {
  if (localAuth.value.apiKey) {
    if (field === 'in') {
      localAuth.value.apiKey.in = value as 'header' | 'query'
    } else {
      localAuth.value.apiKey[field] = value
    }
    emitUpdate()
  }
}

function updateOAuth2(field: keyof NonNullable<HttpAuth['oauth2']>, value: string) {
  if (localAuth.value.oauth2) {
    (localAuth.value.oauth2 as Record<string, string>)[field] = value
    emitUpdate()
  }
}

// Preview helpers
const basicPreview = computed(() => {
  if (localAuth.value.basic?.username && localAuth.value.basic?.password) {
    try {
      const encoded = window.btoa(`${localAuth.value.basic.username}:${localAuth.value.basic.password}`)
      return encoded.slice(0, 20) + '...'
    } catch {
      return '(encoding error)'
    }
  }
  return '(empty)'
})
</script>

<template>
  <div class="auth-tab space-y-4">
    <!-- Auth type selector -->
    <div class="flex items-center gap-2">
      <label class="text-xs text-[var(--color-text-dim)]">Auth Type:</label>
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="type in authTypes"
          :key="type.value"
          class="px-2 py-1 text-[10px] font-mono uppercase rounded transition-colors"
          :class="[
            selectedType === type.value
              ? 'bg-[var(--color-primary)] text-[var(--color-bg)]'
              : 'bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
          ]"
          @click="setAuthType(type.value)"
        >
          {{ type.label }}
        </button>
      </div>
    </div>

    <!-- Inherit from folder notice -->
    <div
      v-if="useInherit && hasFolderAuth"
      class="p-3 rounded bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/30"
    >
      <div class="flex items-center gap-2 text-sm text-[var(--color-secondary)] font-bold mb-1">
        <FolderOpen class="w-4 h-4" />
        Using Folder Authentication
      </div>
      <div class="text-xs text-[var(--color-text-dim)]">
        This request inherits <span class="text-[var(--color-warning)]">{{ folderAuthLabel }}</span> from its folder.
        Select a different auth type above to override.
      </div>
    </div>

    <!-- No Auth message -->
    <div
      v-else-if="localAuth.type === 'none'"
      class="text-center py-8 text-xs text-[var(--color-text-dim)] bg-[var(--color-bg)] rounded border border-dashed border-[var(--color-border)]"
    >
      <Lock class="w-8 h-8 mx-auto mb-2 opacity-30" />
      No authentication configured for this request
    </div>

    <!-- Basic Auth -->
    <div v-else-if="localAuth.type === 'basic' && localAuth.basic" class="space-y-3">
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Username
        </label>
        <input
          :value="localAuth.basic.username"
          type="text"
          class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
          placeholder="Enter username"
          @input="updateBasic('username', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Password
        </label>
        <div class="relative">
          <input
            :value="localAuth.basic.password"
            :type="showPassword ? 'text' : 'password'"
            class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 pr-10 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Enter password"
            @input="updateBasic('password', ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            @click="showPassword = !showPassword"
          >
            <Eye v-if="!showPassword" class="w-4 h-4" />
            <EyeOff v-else class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="text-[10px] text-[var(--color-text-dim)] bg-[var(--color-bg-tertiary)] p-2 rounded">
        <span class="font-bold">Preview:</span>
        <code class="ml-1 text-[var(--color-secondary)]">Authorization: Basic {{ basicPreview }}</code>
      </div>
    </div>

    <!-- Bearer Token -->
    <div v-else-if="localAuth.type === 'bearer' && localAuth.bearer" class="space-y-3">
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Token
        </label>
        <div class="relative">
          <textarea
            :value="localAuth.bearer.token"
            :class="showToken ? '' : 'text-security-disc'"
            rows="2"
            class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 pr-10 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none resize-none"
            placeholder="Enter bearer token (without 'Bearer' prefix)"
            @input="updateBearer(($event.target as HTMLTextAreaElement).value)"
          />
          <button
            type="button"
            class="absolute right-2 top-2 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            @click="showToken = !showToken"
          >
            <Eye v-if="!showToken" class="w-4 h-4" />
            <EyeOff v-else class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div class="text-[10px] text-[var(--color-text-dim)] bg-[var(--color-bg-tertiary)] p-2 rounded">
        <span class="font-bold">Preview:</span>
        <code class="ml-1 text-[var(--color-secondary)] break-all">
          Authorization: Bearer {{ localAuth.bearer.token ? localAuth.bearer.token.slice(0, 30) + (localAuth.bearer.token.length > 30 ? '...' : '') : '(empty)' }}
        </code>
      </div>
    </div>

    <!-- API Key -->
    <div v-else-if="localAuth.type === 'api-key' && localAuth.apiKey" class="space-y-3">
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Key Name
        </label>
        <input
          :value="localAuth.apiKey.key"
          type="text"
          class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
          placeholder="e.g., X-API-Key, api_key"
          @input="updateApiKey('key', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Key Value
        </label>
        <div class="relative">
          <input
            :value="localAuth.apiKey.value"
            :type="showPassword ? 'text' : 'password'"
            class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 pr-10 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Enter API key value"
            @input="updateApiKey('value', ($event.target as HTMLInputElement).value)"
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            @click="showPassword = !showPassword"
          >
            <Eye v-if="!showPassword" class="w-4 h-4" />
            <EyeOff v-else class="w-4 h-4" />
          </button>
        </div>
      </div>
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Add To
        </label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              :checked="localAuth.apiKey.in === 'header'"
              type="radio"
              name="apiKeyLocation"
              class="accent-[var(--color-primary)]"
              @change="updateApiKey('in', 'header')"
            />
            <span class="text-xs text-[var(--color-text)]">Header</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              :checked="localAuth.apiKey.in === 'query'"
              type="radio"
              name="apiKeyLocation"
              class="accent-[var(--color-primary)]"
              @change="updateApiKey('in', 'query')"
            />
            <span class="text-xs text-[var(--color-text)]">Query Parameter</span>
          </label>
        </div>
      </div>
      <div class="text-[10px] text-[var(--color-text-dim)] bg-[var(--color-bg-tertiary)] p-2 rounded">
        <span class="font-bold">Preview:</span>
        <code class="ml-1 text-[var(--color-secondary)]">
          <template v-if="localAuth.apiKey.in === 'header'">
            {{ localAuth.apiKey.key || 'X-API-Key' }}: {{ localAuth.apiKey.value ? localAuth.apiKey.value.slice(0, 20) + '...' : '(empty)' }}
          </template>
          <template v-else>
            ?{{ localAuth.apiKey.key || 'api_key' }}={{ localAuth.apiKey.value ? localAuth.apiKey.value.slice(0, 10) + '...' : '(empty)' }}
          </template>
        </code>
      </div>
    </div>

    <!-- OAuth2 -->
    <div v-else-if="localAuth.type === 'oauth2' && localAuth.oauth2" class="space-y-3">
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Grant Type
        </label>
        <select
          :value="localAuth.oauth2.grantType"
          class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
          @change="updateOAuth2('grantType', ($event.target as HTMLSelectElement).value)"
        >
          <option value="client_credentials">Client Credentials</option>
          <option value="password">Password Grant</option>
        </select>
      </div>
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Access Token URL
        </label>
        <input
          :value="localAuth.oauth2.accessTokenUrl"
          type="text"
          class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
          placeholder="https://auth.example.com/oauth/token"
          @input="updateOAuth2('accessTokenUrl', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
            Client ID
          </label>
          <input
            :value="localAuth.oauth2.clientId"
            type="text"
            class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Client ID"
            @input="updateOAuth2('clientId', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div>
          <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
            Client Secret
          </label>
          <div class="relative">
            <input
              :value="localAuth.oauth2.clientSecret"
              :type="showSecret ? 'text' : 'password'"
              class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 pr-10 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
              placeholder="Client Secret"
              @input="updateOAuth2('clientSecret', ($event.target as HTMLInputElement).value)"
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              @click="showSecret = !showSecret"
            >
              <Eye v-if="!showSecret" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Scope (optional)
        </label>
        <input
          :value="localAuth.oauth2.scope || ''"
          type="text"
          class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-xs text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
          placeholder="e.g., read write"
          @input="updateOAuth2('scope', ($event.target as HTMLInputElement).value)"
        />
      </div>
      <div class="text-[10px] text-[var(--color-text-dim)] bg-[var(--color-bg-tertiary)] p-2 rounded">
        <span class="font-bold">Note:</span>
        <span class="ml-1">Token will be fetched automatically before request execution.</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.text-security-disc {
  -webkit-text-security: disc;
}
</style>

