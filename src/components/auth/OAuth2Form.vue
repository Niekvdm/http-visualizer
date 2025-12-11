<script setup lang="ts">
import { computed, ref } from 'vue'
import type { 
  OAuth2ClientCredentialsConfig, 
  OAuth2PasswordConfig, 
  OAuth2AuthorizationCodeConfig,
  AuthType 
} from '@/types'
import { useAuthService } from '@/composables/useAuthService'
import { useAuthStore } from '@/stores/authStore'
import NeonButton from '@/components/ui/NeonButton.vue'
import { Check } from 'lucide-vue-next'

const props = defineProps<{
  type: 'oauth2-client-credentials' | 'oauth2-password' | 'oauth2-authorization-code'
  config: OAuth2ClientCredentialsConfig | OAuth2PasswordConfig | OAuth2AuthorizationCodeConfig
  requestId: string
}>()

const emit = defineEmits<{
  'update:config': [config: OAuth2ClientCredentialsConfig | OAuth2PasswordConfig | OAuth2AuthorizationCodeConfig]
}>()

const authService = useAuthService()
const authStore = useAuthStore()

const isAuthorizing = ref(false)
const authError = ref<string | null>(null)

// Type guards
const isClientCredentials = computed(() => props.type === 'oauth2-client-credentials')
const isPassword = computed(() => props.type === 'oauth2-password')
const isAuthCode = computed(() => props.type === 'oauth2-authorization-code')

// Config casts
const ccConfig = computed(() => props.config as OAuth2ClientCredentialsConfig)
const pwConfig = computed(() => props.config as OAuth2PasswordConfig)
const acConfig = computed(() => props.config as OAuth2AuthorizationCodeConfig)

// Cached token
const cachedToken = computed(() => authStore.getCachedToken(props.requestId))
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

function updateField(field: string, value: string | boolean) {
  emit('update:config', { ...props.config, [field]: value })
}

async function initiateAuth() {
  if (!isAuthCode.value) return
  
  isAuthorizing.value = true
  authError.value = null
  
  try {
    await authService.initiateAuthCodeFlow(props.requestId, acConfig.value)
  } catch (error) {
    authError.value = error instanceof Error ? error.message : 'Authorization failed'
  } finally {
    isAuthorizing.value = false
  }
}

function clearToken() {
  authService.clearTokens(props.requestId)
}
</script>

<template>
  <div class="space-y-4">
    <!-- Token URL (all types) -->
    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Token URL
      </label>
      <input
        :value="(config as any).tokenUrl"
        type="text"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="https://auth.example.com/oauth/token"
        @input="updateField('tokenUrl', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Authorization URL (auth code only) -->
    <div v-if="isAuthCode">
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Authorization URL
      </label>
      <input
        :value="acConfig.authorizationUrl"
        type="text"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="https://auth.example.com/oauth/authorize"
        @input="updateField('authorizationUrl', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Client ID (all types) -->
    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Client ID
      </label>
      <input
        :value="(config as any).clientId"
        type="text"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="your-client-id"
        @input="updateField('clientId', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Client Secret (client credentials required, others optional) -->
    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Client Secret
        <span v-if="!isClientCredentials" class="text-[var(--color-text-dim)]">(optional)</span>
      </label>
      <input
        :value="(config as any).clientSecret || ''"
        type="password"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="your-client-secret"
        @input="updateField('clientSecret', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Username/Password (password grant only) -->
    <template v-if="isPassword">
      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Username
        </label>
        <input
          :value="pwConfig.username"
          type="text"
          class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
          placeholder="Enter username"
          @input="updateField('username', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div>
        <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
          Password
        </label>
        <input
          :value="pwConfig.password"
          type="password"
          class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
          placeholder="Enter password"
          @input="updateField('password', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </template>

    <!-- Redirect URI (auth code only) -->
    <div v-if="isAuthCode">
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Redirect URI
      </label>
      <input
        :value="acConfig.redirectUri"
        type="text"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="http://localhost:5173/oauth/callback"
        @input="updateField('redirectUri', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Scope (all types) -->
    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Scope <span class="text-[var(--color-text-dim)]">(optional)</span>
      </label>
      <input
        :value="(config as any).scope || ''"
        type="text"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="openid profile email"
        @input="updateField('scope', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Audience (client credentials only) -->
    <div v-if="isClientCredentials">
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Audience <span class="text-[var(--color-text-dim)]">(optional)</span>
      </label>
      <input
        :value="ccConfig.audience || ''"
        type="text"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="https://api.example.com"
        @input="updateField('audience', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- PKCE (auth code only) -->
    <div v-if="isAuthCode" class="flex items-center gap-2">
      <input
        :checked="acConfig.usePkce"
        type="checkbox"
        class="accent-[var(--color-primary)]"
        @change="updateField('usePkce', ($event.target as HTMLInputElement).checked)"
      />
      <label class="text-sm text-[var(--color-text)]">
        Use PKCE (Proof Key for Code Exchange)
      </label>
    </div>

    <!-- Authorize button (auth code only) -->
    <div v-if="isAuthCode" class="pt-2">
      <NeonButton 
        size="sm" 
        :loading="isAuthorizing"
        @click="initiateAuth"
      >
        {{ isAuthorizing ? 'AUTHORIZING...' : 'AUTHORIZE' }}
      </NeonButton>
      <p v-if="authError" class="mt-2 text-xs text-[var(--color-error)]">
        {{ authError }}
      </p>
    </div>

    <!-- Token status -->
    <div v-if="hasToken" class="text-xs bg-[var(--color-bg-tertiary)] p-3 rounded">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[var(--color-primary)] font-bold flex items-center gap-1"><Check class="w-3 h-3" /> Token Cached</span>
        <button 
          class="text-[var(--color-error)] hover:underline"
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
  </div>
</template>

