<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useExecutionStore } from '@/stores/executionStore'
import { useAuthService } from '@/composables/useAuthService'
import OAuthIframeView from '@/components/viewer/OAuthIframeView.vue'
import { X, ShieldAlert } from 'lucide-vue-next'

const executionStore = useExecutionStore()
const authService = useAuthService()

const isVisible = computed(() => executionStore.executionState.phase === 'authorizing')

const oauthAuthUrl = computed(() => executionStore.executionState.oauthAuthUrl)
const oauthState = computed(() => executionStore.executionState.oauthState)
const oauthTokenKey = computed(() => executionStore.executionState.oauthTokenKey)
const hasOAuthState = computed(() => !!oauthAuthUrl.value && !!oauthState.value && !!oauthTokenKey.value)

const showPanel = ref(false)

watch(isVisible, (visible) => {
  if (visible) {
    requestAnimationFrame(() => {
      showPanel.value = true
    })
  } else {
    showPanel.value = false
  }
}, { immediate: true })

function cancelAuth() {
  // Abort the pending auth callback - the caller's catch block will handle phase change
  if (oauthState.value) {
    authService.abortPendingAuth(oauthState.value)
  }
}

function handleAuthComplete(_success: boolean) {
  // Handled by requestExecutor
}

function handlePopupFallback() {
  // Handled by OAuthIframeView
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      class="fixed inset-0 z-[95] flex justify-end"
    >
      <!-- Backdrop -->
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
        :class="showPanel ? 'opacity-100' : 'opacity-0'"
      />

      <!-- Panel -->
      <div
        class="relative w-[500px] max-w-full h-full bg-[var(--color-bg-secondary)] shadow-2xl flex flex-col transition-transform duration-300 ease-out"
        :class="showPanel ? 'translate-x-0' : 'translate-x-full'"
      >
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded bg-[var(--color-warning)]/10 text-[var(--color-warning)]">
              <ShieldAlert class="w-5 h-5" />
            </div>
            <div>
              <div class="text-sm font-mono font-bold text-[var(--color-text)]">
                Authorization Required
              </div>
              <div class="text-xs text-[var(--color-text-dim)]">
                Sign in to continue
              </div>
            </div>
          </div>
          <button
            class="p-1.5 rounded hover:bg-[var(--color-bg-tertiary)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            title="Cancel"
            @click="cancelAuth"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-hidden">
          <OAuthIframeView
            v-if="hasOAuthState"
            :auth-url="oauthAuthUrl!"
            :state="oauthState!"
            :token-key="oauthTokenKey!"
            @auth-complete="handleAuthComplete"
            @fallback-to-popup="handlePopupFallback"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Hide the OAuthIframeView header since we have our own */
:deep(.header-bar) {
  display: none;
}
</style>
