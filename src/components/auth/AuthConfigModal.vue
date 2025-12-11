<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import { useAuthService } from '@/composables/useAuthService'
import type { AuthConfig, AuthType } from '@/types'
import NeonButton from '@/components/ui/NeonButton.vue'
import BasicAuthForm from './BasicAuthForm.vue'
import BearerAuthForm from './BearerAuthForm.vue'
import ApiKeyForm from './ApiKeyForm.vue'
import OAuth2Form from './OAuth2Form.vue'
import HeaderEditor from './HeaderEditor.vue'
import { X, FolderOpen, LockOpen, Check } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  requestId: string
  requestName: string
  fileId?: string
  show: boolean
  isFileAuth?: boolean
}>(), {
  isFileAuth: false
})

const emit = defineEmits<{
  close: []
}>()

const authStore = useAuthStore()
const authService = useAuthService()

const authTypes: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api-key', label: 'API Key' },
  { value: 'oauth2-client-credentials', label: 'OAuth2 (Client Credentials)' },
  { value: 'oauth2-password', label: 'OAuth2 (Password Grant)' },
  { value: 'oauth2-authorization-code', label: 'OAuth2 (Authorization Code + PKCE)' },
  { value: 'oauth2-implicit', label: 'OAuth2 (Implicit - Legacy)' },
  { value: 'manual-headers', label: 'Manual Headers' },
]

// For request-level auth, add option to inherit from folder
const requestAuthTypes = computed(() => {
  if (props.isFileAuth || !props.fileId) {
    return authTypes
  }
  
  // Check if folder has auth configured
  const folderAuth = authStore.getFileAuthConfig(props.fileId)
  if (folderAuth && folderAuth.type !== 'none') {
    return [
      { value: 'inherit' as AuthType, label: `↑ Inherit from folder (${authStore.getAuthTypeLabel(folderAuth.type)})` },
      ...authTypes
    ]
  }
  
  return authTypes
})

// Local config state
const localConfig = ref<AuthConfig>(authStore.createDefaultConfig('none'))
const useInherit = ref(false)
const isTesting = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

// Function to load the config from store
function loadConfig() {
  testResult.value = null
  
  if (props.isFileAuth) {
    // File-level auth - use the fileId (which is passed as requestId for file auth)
    const existing = authStore.getFileAuthConfig(props.requestId)
    if (existing) {
      // Deep clone to avoid mutating store state
      localConfig.value = JSON.parse(JSON.stringify(existing))
    } else {
      localConfig.value = authStore.createDefaultConfig('none')
    }
    useInherit.value = false
  } else {
    // Request-level auth - check for own config (not inherited)
    // Use hasOwnAuthConfig to check if this specific request has its own config
    if (authStore.hasOwnAuthConfig(props.requestId)) {
      // Get the config directly from the Map
      const ownConfig = authStore.authConfigs.get(props.requestId)
      if (ownConfig) {
        // Deep clone to avoid mutating store state
        localConfig.value = JSON.parse(JSON.stringify(ownConfig))
      }
      useInherit.value = false
    } else if (hasInheritedAuth.value) {
      // No own config, but has inherited config from folder
      useInherit.value = true
      localConfig.value = authStore.createDefaultConfig('none')
    } else {
      // No config at all
      localConfig.value = authStore.createDefaultConfig('none')
      useInherit.value = false
    }
  }
}

// Check if there's inherited auth available
const hasInheritedAuth = computed(() => {
  if (props.isFileAuth || !props.fileId) return false
  const folderAuth = authStore.getFileAuthConfig(props.fileId)
  return folderAuth !== null && folderAuth.type !== 'none'
})

// Get inherited auth label
const inheritedAuthLabel = computed(() => {
  if (!props.fileId) return null
  const folderAuth = authStore.getFileAuthConfig(props.fileId)
  if (folderAuth && folderAuth.type !== 'none') {
    return authStore.getAuthTypeLabel(folderAuth.type)
  }
  return null
})

// Initialize config when modal opens or requestId changes
watch([() => props.show, () => props.requestId], ([show]) => {
  if (show) {
    loadConfig()
  }
}, { immediate: true })

// Handle auth type change
function onTypeChange(newType: string) {
  if (newType === 'inherit') {
    useInherit.value = true
    localConfig.value = authStore.createDefaultConfig('none')
    testResult.value = null
    return
  }
  
  useInherit.value = false
  
  if (newType === localConfig.value.type) return
  
  // Create new config with default values for the new type
  localConfig.value = authStore.createDefaultConfig(newType as AuthType)
  testResult.value = null
}

// Get current selected type for the dropdown
const selectedType = computed(() => {
  if (useInherit.value) return 'inherit'
  return localConfig.value.type
})

// Test the configuration
async function testConfig() {
  isTesting.value = true
  testResult.value = null
  
  try {
    const configToTest = useInherit.value && props.fileId
      ? authStore.getFileAuthConfig(props.fileId)!
      : localConfig.value
    
    testResult.value = await authService.testAuthConfig(props.requestId, configToTest)
  } catch (error) {
    testResult.value = {
      success: false,
      message: error instanceof Error ? error.message : 'Test failed'
    }
  } finally {
    isTesting.value = false
  }
}

// Save configuration
function save() {
  if (props.isFileAuth) {
    // Save file-level auth
    if (localConfig.value.type === 'none') {
      authStore.removeFileAuthConfig(props.requestId)
    } else {
      // Deep clone to avoid storing a reference
      authStore.setFileAuthConfig(props.requestId, JSON.parse(JSON.stringify(localConfig.value)))
    }
  } else {
    // Save request-level auth
    if (useInherit.value) {
      // Remove request-specific config to use inherited
      authStore.removeAuthConfig(props.requestId)
    } else if (localConfig.value.type === 'none') {
      authStore.removeAuthConfig(props.requestId)
    } else {
      // Deep clone to avoid storing a reference
      authStore.setAuthConfig(props.requestId, JSON.parse(JSON.stringify(localConfig.value)))
    }
  }
  
  emit('close')
}

// Cancel and close
function cancel() {
  emit('close')
}

// Modal title
const modalTitle = computed(() => {
  if (props.isFileAuth) {
    return 'Folder Authentication'
  }
  return 'Request Authentication'
})

// Modal subtitle
const modalSubtitle = computed(() => {
  if (props.isFileAuth) {
    return `All requests in this folder will inherit this auth`
  }
  return props.requestName
})
</script>

<template>
  <Teleport to="body">
    <div 
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
        @click="cancel"
      />

      <!-- Modal -->
      <div class="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div>
            <h2 class="text-[var(--color-primary)] font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <FolderOpen v-if="isFileAuth" class="w-4 h-4" />
              {{ modalTitle }}
            </h2>
            <p class="text-xs text-[var(--color-text-dim)] mt-0.5 truncate max-w-[300px]">
              {{ modalSubtitle }}
            </p>
          </div>
          <button 
            class="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-xl"
            @click="cancel"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <!-- Inherited auth notice -->
          <div 
            v-if="!isFileAuth && hasInheritedAuth && useInherit"
            class="p-3 rounded bg-[var(--color-secondary)]/10 border border-[var(--color-secondary)]/30"
          >
            <div class="text-sm text-[var(--color-secondary)] font-bold mb-1">
              ↑ Using Folder Authentication
            </div>
            <div class="text-xs text-[var(--color-text-dim)]">
              This request inherits {{ inheritedAuthLabel }} from its folder.
              Select a different auth type below to override.
            </div>
          </div>

          <!-- Auth type selector -->
          <div>
            <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-2">
              Auth Type
            </label>
            <select
              :value="selectedType"
              class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] focus:outline-none cursor-pointer"
              @change="onTypeChange(($event.target as HTMLSelectElement).value)"
            >
              <option 
                v-for="type in requestAuthTypes" 
                :key="type.value" 
                :value="type.value"
              >
                {{ type.label }}
              </option>
            </select>
          </div>

          <!-- Auth type specific forms (only show if not inheriting) -->
          <template v-if="!useInherit && localConfig.type !== 'none'">
            <!-- Basic Auth -->
            <BasicAuthForm 
              v-if="localConfig.type === 'basic' && localConfig.basic"
              :config="localConfig.basic"
              @update:config="localConfig.basic = $event"
            />

            <!-- Bearer Token -->
            <BearerAuthForm 
              v-else-if="localConfig.type === 'bearer' && localConfig.bearer"
              :config="localConfig.bearer"
              @update:config="localConfig.bearer = $event"
            />

            <!-- API Key -->
            <ApiKeyForm 
              v-else-if="localConfig.type === 'api-key' && localConfig.apiKey"
              :config="localConfig.apiKey"
              @update:config="localConfig.apiKey = $event"
            />

            <!-- OAuth2 Client Credentials -->
            <OAuth2Form 
              v-else-if="localConfig.type === 'oauth2-client-credentials' && localConfig.oauth2ClientCredentials"
              type="oauth2-client-credentials"
              :config="localConfig.oauth2ClientCredentials"
              :request-id="requestId"
              @update:config="localConfig.oauth2ClientCredentials = $event as typeof localConfig.oauth2ClientCredentials"
            />

            <!-- OAuth2 Password -->
            <OAuth2Form 
              v-else-if="localConfig.type === 'oauth2-password' && localConfig.oauth2Password"
              type="oauth2-password"
              :config="localConfig.oauth2Password"
              :request-id="requestId"
              @update:config="localConfig.oauth2Password = $event as typeof localConfig.oauth2Password"
            />

            <!-- OAuth2 Authorization Code -->
            <OAuth2Form 
              v-else-if="localConfig.type === 'oauth2-authorization-code' && localConfig.oauth2AuthorizationCode"
              type="oauth2-authorization-code"
              :config="localConfig.oauth2AuthorizationCode"
              :request-id="requestId"
              @update:config="localConfig.oauth2AuthorizationCode = $event as typeof localConfig.oauth2AuthorizationCode"
            />

            <!-- OAuth2 Implicit (Legacy) -->
            <OAuth2Form 
              v-else-if="localConfig.type === 'oauth2-implicit' && localConfig.oauth2Implicit"
              type="oauth2-implicit"
              :config="localConfig.oauth2Implicit"
              :request-id="requestId"
              @update:config="localConfig.oauth2Implicit = $event as typeof localConfig.oauth2Implicit"
            />

            <!-- Manual Headers -->
            <HeaderEditor 
              v-else-if="localConfig.type === 'manual-headers' && localConfig.manualHeaders"
              :headers="localConfig.manualHeaders.headers"
              @update:headers="localConfig.manualHeaders!.headers = $event"
            />
          </template>

          <!-- No auth message -->
          <div 
            v-if="!useInherit && localConfig.type === 'none'"
            class="text-center py-8 text-[var(--color-text-dim)]"
          >
            <LockOpen class="w-8 h-8 mx-auto mb-2" />
            <div class="text-sm">
              <template v-if="isFileAuth">
                No authentication will be applied to requests in this folder
              </template>
              <template v-else>
                No authentication will be applied to this request
              </template>
            </div>
          </div>

          <!-- Test result -->
          <div 
            v-if="testResult"
            class="p-3 rounded text-sm"
            :class="[
              testResult.success 
                ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 text-[var(--color-primary)]'
                : 'bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)]'
            ]"
          >
            <div class="font-bold mb-1 flex items-center gap-1">
              <component :is="testResult.success ? Check : X" class="w-4 h-4" />
              {{ testResult.success ? 'Success' : 'Failed' }}
            </div>
            <div class="text-xs opacity-80">{{ testResult.message }}</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
          <NeonButton 
            v-if="!useInherit && localConfig.type !== 'none'"
            size="sm" 
            variant="ghost"
            :loading="isTesting"
            @click="testConfig"
          >
            {{ isTesting ? 'TESTING...' : 'TEST' }}
          </NeonButton>
          <div v-else />

          <div class="flex gap-2">
            <NeonButton size="sm" variant="ghost" @click="cancel">
              CANCEL
            </NeonButton>
            <NeonButton size="sm" @click="save">
              SAVE
            </NeonButton>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
