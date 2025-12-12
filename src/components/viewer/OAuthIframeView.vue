<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRequestStore } from '@/stores/requestStore'
import { useAuthService } from '@/composables/useAuthService'
import { ExternalLink, AlertTriangle, RefreshCw, Lock, ShieldCheck, X } from 'lucide-vue-next'

const props = defineProps<{
  authUrl: string
  state: string
  tokenKey: string
}>()

const emit = defineEmits<{
  'auth-complete': [success: boolean]
  'fallback-to-popup': []
}>()

const requestStore = useRequestStore()
const authService = useAuthService()

const iframeRef = ref<HTMLIFrameElement | null>(null)
const loadingState = ref<'loading' | 'loaded' | 'blocked' | 'error'>('loading')
const loadError = ref<string | null>(null)
const loadTimeoutId = ref<ReturnType<typeof setTimeout> | null>(null)

// Iframe load timeout (3 seconds to detect X-Frame-Options blocking)
const LOAD_TIMEOUT = 3000

function onIframeLoad() {
  // Clear the timeout since we got a load event
  if (loadTimeoutId.value) {
    clearTimeout(loadTimeoutId.value)
    loadTimeoutId.value = null
  }

  // Try to detect if the iframe was blocked by X-Frame-Options
  // We can't directly access cross-origin content, but we can check if it loaded
  try {
    const iframe = iframeRef.value
    if (iframe) {
      // If we can access contentWindow.length, the frame has content
      // This will throw for cross-origin or blocked frames
      const hasContent = iframe.contentWindow && iframe.contentWindow.length >= 0
      if (hasContent) {
        loadingState.value = 'loaded'
        return
      }
    }
  } catch {
    // Cross-origin access denied is expected - the iframe loaded something
    loadingState.value = 'loaded'
    return
  }

  // If we got here with no content, might be blocked
  loadingState.value = 'loaded'
}

function onIframeError() {
  if (loadTimeoutId.value) {
    clearTimeout(loadTimeoutId.value)
    loadTimeoutId.value = null
  }
  loadingState.value = 'blocked'
  loadError.value = 'The OAuth provider blocked iframe embedding'
}

function handleLoadTimeout() {
  // After timeout, if still loading, assume blocked
  if (loadingState.value === 'loading') {
    loadingState.value = 'blocked'
    loadError.value = 'The OAuth provider may have blocked iframe embedding (timeout)'
  }
}

function openInPopup() {
  requestStore.setOAuthUsePopup(true)
  emit('fallback-to-popup')

  const popup = authService.openAuthPopupFallback(props.authUrl)
  if (!popup) {
    loadError.value = 'Failed to open popup. Please allow popups for this site.'
    return
  }

  // The caller's waitForAuthCallback will receive the postMessage when popup completes
  // Monitor popup closure to abort if user closes it
  const popupCheckInterval = setInterval(() => {
    if (popup.closed) {
      clearInterval(popupCheckInterval)
      authService.abortPendingAuth(props.state)
    }
  }, 500)
}

function cancelAuth() {
  // Abort the pending auth callback - the caller's catch block will handle phase change
  authService.abortPendingAuth(props.state)
}

onMounted(() => {
  // Set a timeout to detect blocked iframes
  loadTimeoutId.value = setTimeout(handleLoadTimeout, LOAD_TIMEOUT)
})

onUnmounted(() => {
  if (loadTimeoutId.value) {
    clearTimeout(loadTimeoutId.value)
  }
})

// Reset state when authUrl changes
watch(() => props.authUrl, () => {
  loadingState.value = 'loading'
  loadError.value = null
  if (loadTimeoutId.value) {
    clearTimeout(loadTimeoutId.value)
  }
  loadTimeoutId.value = setTimeout(handleLoadTimeout, LOAD_TIMEOUT)
})
</script>

<template>
  <div class="oauth-iframe-view">
    <!-- Header bar -->
    <div class="header-bar">
      <div class="header-left">
        <div class="security-badge">
          <ShieldCheck class="icon" />
          <span>Secure OAuth</span>
        </div>
        <div class="auth-label">
          <Lock class="icon-small" />
          <span>Sign in to continue</span>
        </div>
      </div>
      <div class="header-actions">
        <button
          class="action-btn popup-btn"
          title="Open in popup window"
          @click="openInPopup"
        >
          <ExternalLink class="icon-small" />
          <span>Open in Popup</span>
        </button>
        <button
          class="action-btn cancel-btn"
          title="Cancel authorization"
          @click="cancelAuth"
        >
          <X class="icon-small" />
        </button>
      </div>
    </div>

    <!-- Loading overlay -->
    <div v-if="loadingState === 'loading'" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner-container">
          <RefreshCw class="spinner" />
          <div class="spinner-ring" />
        </div>
        <div class="loading-text">{{ requestStore.executionState.funnyText }}</div>
        <div class="loading-subtext">Loading authorization page...</div>
      </div>
    </div>

    <!-- Blocked/Error overlay -->
    <div v-else-if="loadingState === 'blocked' || loadingState === 'error'" class="blocked-overlay">
      <div class="blocked-content">
        <div class="blocked-icon">
          <AlertTriangle class="icon-large" />
        </div>
        <div class="blocked-title">Iframe Blocked</div>
        <div class="blocked-message">
          {{ loadError || 'The OAuth provider has blocked embedding in an iframe.' }}
        </div>
        <button class="popup-fallback-btn" @click="openInPopup">
          <ExternalLink class="icon-small" />
          <span>Continue in Popup Window</span>
        </button>
        <button class="cancel-link" @click="cancelAuth">
          Cancel authorization
        </button>
      </div>
    </div>

    <!-- Iframe container -->
    <div class="iframe-container" :class="{ hidden: loadingState !== 'loaded' }">
      <iframe
        ref="iframeRef"
        :src="authUrl"
        class="auth-iframe"
        sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        allow="publickey-credentials-get"
        @load="onIframeLoad"
        @error="onIframeError"
      />
    </div>

    <!-- Bottom status bar -->
    <div class="status-bar">
      <div class="status-dot" :class="loadingState" />
      <span class="status-text">
        <template v-if="loadingState === 'loading'">Connecting to OAuth provider...</template>
        <template v-else-if="loadingState === 'loaded'">Connected</template>
        <template v-else>Connection blocked - use popup instead</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.oauth-iframe-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg);
  position: relative;
  overflow: hidden;
}

/* Header bar with glassmorphism effect */
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: linear-gradient(
    135deg,
    rgba(var(--color-primary-rgb, 0, 255, 65), 0.08) 0%,
    rgba(var(--color-secondary-rgb, 0, 200, 255), 0.04) 100%
  );
  border-bottom: 1px solid rgba(var(--color-primary-rgb, 0, 255, 65), 0.2);
  backdrop-filter: blur(8px);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.security-badge {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  background: rgba(var(--color-primary-rgb, 0, 255, 65), 0.15);
  border: 1px solid rgba(var(--color-primary-rgb, 0, 255, 65), 0.3);
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-primary);
}

.auth-label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--color-text-dim);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-dim);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-text-dim);
  color: var(--color-text);
}

.popup-btn:hover {
  border-color: var(--color-secondary);
  color: var(--color-secondary);
}

.cancel-btn {
  padding: 0.375rem;
}

.cancel-btn:hover {
  border-color: var(--color-error);
  color: var(--color-error);
}

.icon {
  width: 14px;
  height: 14px;
}

.icon-small {
  width: 12px;
  height: 12px;
}

.icon-large {
  width: 48px;
  height: 48px;
}

/* Loading overlay */
.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    180deg,
    rgba(var(--color-bg-rgb, 10, 10, 10), 0.95) 0%,
    rgba(var(--color-bg-rgb, 10, 10, 10), 0.98) 100%
  );
  z-index: 20;
}

.loading-content {
  text-align: center;
}

.spinner-container {
  position: relative;
  width: 64px;
  height: 64px;
  margin: 0 auto 1.5rem;
}

.spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 28px;
  height: 28px;
  color: var(--color-primary);
  animation: spin 1.5s linear infinite;
}

.spinner-ring {
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: var(--color-primary);
  border-right-color: rgba(var(--color-primary-rgb, 0, 255, 65), 0.3);
  border-radius: 50%;
  animation: spin-reverse 2s linear infinite;
}

@keyframes spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}

@keyframes spin-reverse {
  to { transform: rotate(-360deg); }
}

.loading-text {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.875rem;
  color: var(--color-primary);
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(var(--color-primary-rgb, 0, 255, 65), 0.5);
}

.loading-subtext {
  font-size: 0.75rem;
  color: var(--color-text-dim);
}

/* Blocked overlay */
.blocked-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    180deg,
    rgba(var(--color-bg-rgb, 10, 10, 10), 0.98) 0%,
    rgba(var(--color-error-rgb, 255, 0, 64), 0.05) 100%
  );
  z-index: 20;
}

.blocked-content {
  text-align: center;
  max-width: 320px;
  padding: 2rem;
}

.blocked-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  background: rgba(var(--color-warning-rgb, 255, 165, 0), 0.1);
  border: 2px solid rgba(var(--color-warning-rgb, 255, 165, 0), 0.3);
  border-radius: 50%;
  color: var(--color-warning);
}

.blocked-title {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-warning);
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.blocked-message {
  font-size: 0.75rem;
  color: var(--color-text-dim);
  line-height: 1.5;
  margin-bottom: 1.5rem;
}

.popup-fallback-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: linear-gradient(
    135deg,
    var(--color-secondary) 0%,
    rgba(var(--color-secondary-rgb, 0, 200, 255), 0.8) 100%
  );
  border: none;
  border-radius: 4px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-bg);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 20px rgba(var(--color-secondary-rgb, 0, 200, 255), 0.3);
}

.popup-fallback-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(var(--color-secondary-rgb, 0, 200, 255), 0.4);
}

.cancel-link {
  display: block;
  margin-top: 1rem;
  padding: 0.5rem;
  background: none;
  border: none;
  font-size: 0.625rem;
  color: var(--color-text-dim);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.cancel-link:hover {
  color: var(--color-error);
}

/* Iframe container */
.iframe-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.iframe-container.hidden {
  visibility: hidden;
  height: 0;
}

.auth-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: none;
  background: white;
}

/* Status bar */
.status-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
  font-size: 0.625rem;
  color: var(--color-text-dim);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transition: background 0.3s ease;
}

.status-dot.loading {
  background: var(--color-warning);
  animation: pulse 1.5s ease-in-out infinite;
}

.status-dot.loaded {
  background: var(--color-primary);
}

.status-dot.blocked,
.status-dot.error {
  background: var(--color-error);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.status-text {
  font-family: 'Fira Code', 'Consolas', monospace;
}
</style>
