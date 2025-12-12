<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { HttpAuth } from '@/types'
import { useCollectionStore } from '@/stores/collectionStore'
import { useAuthService } from '@/composables/useAuthService'
import { useAuthStore } from '@/stores/authStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { resolveVariables } from '@/utils/variableResolver'
import { Lock, Eye, EyeOff, FolderOpen, AlertTriangle, Check } from 'lucide-vue-next'
import VariableInput from './VariableInput.vue'

const props = defineProps<{
  auth?: HttpAuth
  folderId?: string
  collectionId?: string
  requestId?: string
}>()

const emit = defineEmits<{
  'update:auth': [auth: HttpAuth | undefined]
}>()

const collectionStore = useCollectionStore()
const authService = useAuthService()
const authStore = useAuthStore()
const environmentStore = useEnvironmentStore()

type AuthType = HttpAuth['type'] | 'inherit'

// Get resolved variables from environment and collection
const resolvedVariables = computed(() => {
  const collectionVars = props.collectionId 
    ? collectionStore.collections.find(c => c.id === props.collectionId)?.variables || {}
    : {}
  return {
    ...collectionVars,
    ...environmentStore.activeVariables,
  }
})
type OAuth2GrantType = NonNullable<HttpAuth['oauth2']>['grantType']

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

// Cache configs per type so switching tabs doesn't lose data
const authConfigCache = ref<Partial<Record<HttpAuth['type'], HttpAuth>>>({})

// OAuth2 authorization state
const isAuthorizing = ref(false)
const authError = ref<string | null>(null)

// OAuth2 grant type helpers
const isAuthCodeGrant = computed(() => 
  localAuth.value.type === 'oauth2' && localAuth.value.oauth2?.grantType === 'authorization_code'
)
const isImplicitGrant = computed(() => 
  localAuth.value.type === 'oauth2' && localAuth.value.oauth2?.grantType === 'implicit'
)
const isPasswordGrant = computed(() => 
  localAuth.value.type === 'oauth2' && localAuth.value.oauth2?.grantType === 'password'
)
const needsAuthorizationUrl = computed(() => isAuthCodeGrant.value || isImplicitGrant.value)
const needsTokenUrl = computed(() => !isImplicitGrant.value)
const needsClientSecret = computed(() => !isImplicitGrant.value)
const needsRedirectUri = computed(() => isAuthCodeGrant.value || isImplicitGrant.value)
const needsPkce = computed(() => isAuthCodeGrant.value)
const needsUserCredentials = computed(() => isPasswordGrant.value)

// Cached token (use requestId if available)
const tokenKey = computed(() => props.requestId || 'legacy-auth')
const cachedToken = computed(() => authStore.getCachedToken(tokenKey.value))
const hasToken = computed(() => !!cachedToken.value)
const tokenExpiry = computed(() => {
  if (!cachedToken.value?.expiresAt) return null
  const remaining = cachedToken.value.expiresAt - Date.now()
  if (remaining <= 0) return 'Expired'
  const seconds = Math.floor(remaining / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
})

// Clear cache when switching to a different request
watch(
  () => props.requestId,
  () => {
    authConfigCache.value = {}
  }
)

// Initialize from props
watch(
  () => props.auth,
  (newAuth) => {
    if (newAuth) {
      localAuth.value = JSON.parse(JSON.stringify(newAuth))
      useInherit.value = false
      // Also add to cache so switching away and back preserves it
      if (newAuth.type !== 'none') {
        authConfigCache.value[newAuth.type] = JSON.parse(JSON.stringify(newAuth))
      }
      // Sync OAuth2 config to auth store on load so token fetch works
      if (newAuth.type === 'oauth2' && newAuth.oauth2) {
        // Use setTimeout to ensure requestId is available
        setTimeout(() => syncOAuth2ConfigToAuthStore(), 0)
      }
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
  // Save current config to cache before switching (if it has real data)
  if (localAuth.value.type !== 'none') {
    authConfigCache.value[localAuth.value.type] = JSON.parse(JSON.stringify(localAuth.value))
  }
  
  if (type === 'inherit') {
    useInherit.value = true
    localAuth.value = { type: 'none' }
  } else {
    useInherit.value = false
    // Restore from cache if available, otherwise create default
    const cached = authConfigCache.value[type as HttpAuth['type']]
    if (cached) {
      localAuth.value = JSON.parse(JSON.stringify(cached))
    } else {
      localAuth.value = createDefaultAuth(type as HttpAuth['type'])
    }
    // Sync OAuth2 config to auth store so token fetch works when testing
    if (type === 'oauth2') {
      setTimeout(() => syncOAuth2ConfigToAuthStore(), 0)
    }
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

function updateOAuth2(field: keyof NonNullable<HttpAuth['oauth2']>, value: string | boolean) {
  if (localAuth.value.oauth2) {
    (localAuth.value.oauth2 as Record<string, string | boolean>)[field] = value
    emitUpdate()
    // Sync to auth store so token fetch works on request execution
    syncOAuth2ConfigToAuthStore()
  }
}

// Helper to resolve environment variables in a string
function resolve(value: string | undefined): string {
  if (!value) return ''
  return resolveVariables(value, resolvedVariables.value, false)
}

// Convert legacy HttpAuth OAuth2 to modern AuthConfig and store in authStore
// This ensures the token is applied when executing requests
function syncOAuth2ConfigToAuthStore() {
  if (!props.requestId || !localAuth.value.oauth2) return
  
  const oauth2 = localAuth.value.oauth2
  const grantType = oauth2.grantType
  
  if (grantType === 'authorization_code') {
    authStore.setAuthConfig(props.requestId, {
      type: 'oauth2-authorization-code',
      oauth2AuthorizationCode: {
        authorizationUrl: resolve(oauth2.authorizationUrl),
        tokenUrl: resolve(oauth2.accessTokenUrl),
        clientId: resolve(oauth2.clientId),
        clientSecret: resolve(oauth2.clientSecret),
        redirectUri: resolve(oauth2.redirectUri),
        scope: resolve(oauth2.scope),
        usePkce: oauth2.usePkce ?? true,
      }
    })
  } else if (grantType === 'implicit') {
    authStore.setAuthConfig(props.requestId, {
      type: 'oauth2-implicit',
      oauth2Implicit: {
        authorizationUrl: resolve(oauth2.authorizationUrl),
        clientId: resolve(oauth2.clientId),
        redirectUri: resolve(oauth2.redirectUri),
        scope: resolve(oauth2.scope),
      }
    })
  } else if (grantType === 'client_credentials') {
    authStore.setAuthConfig(props.requestId, {
      type: 'oauth2-client-credentials',
      oauth2ClientCredentials: {
        tokenUrl: resolve(oauth2.accessTokenUrl),
        clientId: resolve(oauth2.clientId),
        clientSecret: resolve(oauth2.clientSecret) || '',
        scope: resolve(oauth2.scope),
      }
    })
  } else if (grantType === 'password') {
    authStore.setAuthConfig(props.requestId, {
      type: 'oauth2-password',
      oauth2Password: {
        tokenUrl: resolve(oauth2.accessTokenUrl),
        clientId: resolve(oauth2.clientId),
        clientSecret: resolve(oauth2.clientSecret),
        username: resolve(oauth2.username),
        password: resolve(oauth2.password),
        scope: resolve(oauth2.scope),
      }
    })
  }
}

// OAuth2 Authorization flow
async function initiateAuth() {
  if (!props.requestId) {
    authError.value = 'Request ID is required for OAuth2 authorization'
    return
  }
  
  isAuthorizing.value = true
  authError.value = null
  
  try {
    const oauth2 = localAuth.value.oauth2
    if (!oauth2) return
    
    // Sync config to authStore so token gets applied when executing requests
    syncOAuth2ConfigToAuthStore()
    
    // Resolve environment variables in all OAuth2 fields
    if (isAuthCodeGrant.value) {
      await authService.initiateAuthCodeFlow(props.requestId, {
        authorizationUrl: resolve(oauth2.authorizationUrl),
        tokenUrl: resolve(oauth2.accessTokenUrl),
        clientId: resolve(oauth2.clientId),
        clientSecret: resolve(oauth2.clientSecret),
        redirectUri: resolve(oauth2.redirectUri),
        scope: resolve(oauth2.scope),
        usePkce: oauth2.usePkce ?? true,
      })
    } else if (isImplicitGrant.value) {
      await authService.initiateImplicitFlow(props.requestId, {
        authorizationUrl: resolve(oauth2.authorizationUrl),
        clientId: resolve(oauth2.clientId),
        redirectUri: resolve(oauth2.redirectUri),
        scope: resolve(oauth2.scope),
      })
    }
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Authorization failed'
  } finally {
    isAuthorizing.value = false
  }
}

function clearToken() {
  if (props.requestId) {
    authService.clearTokens(props.requestId)
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
      <!-- Deprecation warning for Implicit flow -->
      <div v-if="isImplicitGrant" class="flex gap-2 p-3 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30 rounded text-xs">
        <AlertTriangle class="w-4 h-4 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
        <div>
          <span class="font-bold text-[var(--color-warning)]">Legacy Flow:</span>
          <span class="text-[var(--color-text-dim)]"> Implicit flow is deprecated in OAuth 2.1. Use Authorization Code + PKCE for new applications.</span>
        </div>
      </div>

      <!-- Grant Type -->
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
          <option value="authorization_code">Authorization Code + PKCE</option>
          <option value="implicit">Implicit (Legacy)</option>
        </select>
      </div>

      <!-- Token URL (not needed for implicit) -->
      <div v-if="needsTokenUrl">
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Token URL
        </label>
        <VariableInput
          :model-value="localAuth.oauth2.accessTokenUrl"
          :collection-id="collectionId"
          placeholder="https://auth.example.com/oauth/token"
          @update:model-value="updateOAuth2('accessTokenUrl', $event)"
        />
      </div>

      <!-- Authorization URL (auth code and implicit only) -->
      <div v-if="needsAuthorizationUrl">
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Authorization URL
        </label>
        <VariableInput
          :model-value="localAuth.oauth2.authorizationUrl || ''"
          :collection-id="collectionId"
          placeholder="https://auth.example.com/oauth/authorize"
          @update:model-value="updateOAuth2('authorizationUrl', $event)"
        />
      </div>

      <!-- Client ID and Secret -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
            Client ID
          </label>
          <VariableInput
            :model-value="localAuth.oauth2.clientId"
            :collection-id="collectionId"
            placeholder="Client ID"
            @update:model-value="updateOAuth2('clientId', $event)"
          />
        </div>
        <div v-if="needsClientSecret">
          <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
            Client Secret
            <span v-if="isAuthCodeGrant" class="text-[var(--color-text-dim)]">(optional)</span>
          </label>
          <VariableInput
            :model-value="localAuth.oauth2.clientSecret || ''"
            :collection-id="collectionId"
            placeholder="Client Secret"
            type="password"
            @update:model-value="updateOAuth2('clientSecret', $event)"
          />
        </div>
      </div>

      <!-- Redirect URI (auth code and implicit only) -->
      <div v-if="needsRedirectUri">
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Redirect URI
        </label>
        <VariableInput
          :model-value="localAuth.oauth2.redirectUri || ''"
          :collection-id="collectionId"
          placeholder="http://localhost:5173/oauth/callback"
          @update:model-value="updateOAuth2('redirectUri', $event)"
        />
      </div>

      <!-- Username/Password (password grant only) -->
      <template v-if="needsUserCredentials">
        <div>
          <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
            Username
          </label>
          <VariableInput
            :model-value="localAuth.oauth2.username || ''"
            :collection-id="collectionId"
            placeholder="Enter username"
            @update:model-value="updateOAuth2('username', $event)"
          />
        </div>
        <div>
          <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
            Password
          </label>
          <VariableInput
            :model-value="localAuth.oauth2.password || ''"
            :collection-id="collectionId"
            placeholder="Enter password"
            type="password"
            @update:model-value="updateOAuth2('password', $event)"
          />
        </div>
      </template>

      <!-- Scope -->
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Scope (optional)
        </label>
        <VariableInput
          :model-value="localAuth.oauth2.scope || ''"
          :collection-id="collectionId"
          placeholder="e.g., openid profile email"
          @update:model-value="updateOAuth2('scope', $event)"
        />
      </div>

      <!-- PKCE checkbox (auth code only) -->
      <div v-if="needsPkce" class="flex items-center gap-2">
        <input
          :checked="localAuth.oauth2.usePkce ?? true"
          type="checkbox"
          class="accent-[var(--color-primary)]"
          @change="updateOAuth2('usePkce', ($event.target as HTMLInputElement).checked)"
        />
        <label class="text-xs text-[var(--color-text)]">
          Use PKCE (Proof Key for Code Exchange)
        </label>
      </div>

      <!-- Authorize button (auth code and implicit only) -->
      <div v-if="needsAuthorizationUrl" class="pt-2">
        <button
          class="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-colors bg-[var(--color-primary)] text-[var(--color-bg)] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isAuthorizing"
          @click="initiateAuth"
        >
          {{ isAuthorizing ? 'AUTHORIZING...' : 'AUTHORIZE' }}
        </button>
        <p v-if="authError" class="mt-2 text-xs text-[var(--color-error)]">
          {{ authError }}
        </p>
      </div>

      <!-- Token status -->
      <div v-if="hasToken" class="text-[10px] bg-[var(--color-bg-tertiary)] p-3 rounded">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[var(--color-primary)] font-bold flex items-center gap-1">
            <Check class="w-3 h-3" /> Token Cached
          </span>
          <button 
            class="text-[var(--color-error)] hover:underline text-[10px]"
            @click="clearToken"
          >
            Clear
          </button>
        </div>
        <div class="text-[var(--color-text-dim)]">
          <div>Type: {{ cachedToken?.tokenType }}</div>
          <div v-if="tokenExpiry">Expires: {{ tokenExpiry }}</div>
          <div class="truncate">Token: {{ cachedToken?.accessToken.slice(0, 30) }}...</div>
        </div>
      </div>

      <!-- Note for non-interactive flows -->
      <div v-if="!needsAuthorizationUrl" class="text-[10px] text-[var(--color-text-dim)] bg-[var(--color-bg-tertiary)] p-2 rounded">
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

