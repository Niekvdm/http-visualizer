<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useExtensionBridge } from '@/composables/useExtensionBridge'
import NeonButton from './NeonButton.vue'
import { X, AlertTriangle, Package, Globe, PartyPopper, Check, Puzzle } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const { isExtensionAvailable, checkExtensionAvailability } = useExtensionBridge()

const isChecking = ref(false)
const downloadStarted = ref(false)

// Detect browser type
const browserInfo = computed(() => {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('edg/')) {
    return { name: 'Edge', isChromium: true, extensionsUrl: 'edge://extensions' }
  } else if (ua.includes('chrome')) {
    return { name: 'Chrome', isChromium: true, extensionsUrl: 'chrome://extensions' }
  } else if (ua.includes('firefox')) {
    return { name: 'Firefox', isChromium: false, extensionsUrl: 'about:debugging#/runtime/this-firefox' }
  } else if (ua.includes('safari')) {
    return { name: 'Safari', isChromium: false, extensionsUrl: '' }
  }
  return { name: 'Browser', isChromium: true, extensionsUrl: 'chrome://extensions' }
})

// Download the extension ZIP
function downloadExtension() {
  downloadStarted.value = true
  const link = document.createElement('a')
  link.href = '/http-visualizer-extension.zip'
  link.download = 'http-visualizer-extension.zip'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Check for extension connection
async function checkConnection() {
  isChecking.value = true
  await checkExtensionAvailability()
  isChecking.value = false
  
  if (isExtensionAvailable.value) {
    emit('close')
  }
}

// Close modal on escape key
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="emit('close')"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/90 backdrop-blur-sm" />

        <!-- Modal -->
        <div class="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <!-- Animated background effect -->
          <div class="absolute inset-0 overflow-hidden pointer-events-none">
            <div class="absolute -top-1/2 -left-1/2 w-full h-full bg-[var(--color-primary)]/5 rounded-full blur-3xl animate-pulse" />
            <div class="absolute -bottom-1/2 -right-1/2 w-full h-full bg-[var(--color-secondary)]/5 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;" />
          </div>

          <!-- Header -->
          <div class="relative flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <div>
              <h2 class="text-xl font-bold text-[var(--color-primary)] flex items-center gap-3">
                <Puzzle class="w-7 h-7" />
                Install Browser Extension
              </h2>
              <p class="text-sm text-[var(--color-text-dim)] mt-1">
                Required for bypassing CORS restrictions
              </p>
            </div>
            <button 
              class="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-2xl transition-colors"
              @click="emit('close')"
            >
              <X class="w-6 h-6" />
            </button>
          </div>

          <!-- Content -->
          <div class="relative flex-1 overflow-y-auto p-6">
            <!-- Why needed section -->
            <div class="mb-8 p-4 rounded-lg bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/30">
              <div class="flex items-start gap-3">
                <AlertTriangle class="w-6 h-6 text-[var(--color-warning)] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 class="font-bold text-[var(--color-warning)] mb-1">Why is this needed?</h3>
                  <p class="text-sm text-[var(--color-text-dim)] leading-relaxed">
                    Browsers block cross-origin requests (CORS) for security. The extension acts as a proxy, 
                    allowing HTTP Visualizer to make requests to any API without CORS restrictions.
                  </p>
                </div>
              </div>
            </div>

            <!-- Step 1: Download -->
            <div class="mb-6">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-[var(--color-primary)] text-[var(--color-bg)] flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 class="font-bold text-[var(--color-text)]">Download the Extension</h3>
                <span v-if="downloadStarted" class="text-xs text-[var(--color-primary)] flex items-center gap-1">
                  <Check class="w-3 h-3" /> Downloaded
                </span>
              </div>
              <div class="ml-11">
                <button
                  class="group flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/20 hover:border-[var(--color-primary)]/50 transition-all w-full"
                  @click="downloadExtension"
                >
                  <Package class="w-6 h-6 text-[var(--color-primary)] group-hover:scale-110 transition-transform" />
                  <div class="text-left flex-1">
                    <div class="font-medium text-[var(--color-primary)]">http-visualizer-extension.zip</div>
                    <div class="text-xs text-[var(--color-text-dim)]">Click to download</div>
                  </div>
                  <span class="text-[var(--color-primary)] text-xl">↓</span>
                </button>
                <p class="text-xs text-[var(--color-text-dim)] mt-2">
                  Extract the ZIP file to a folder you'll remember (e.g., Documents)
                </p>
              </div>
            </div>

            <!-- Step 2: Open Extensions Page -->
            <div class="mb-6">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-[var(--color-secondary)] text-[var(--color-bg)] flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 class="font-bold text-[var(--color-text)]">Open Extensions Page</h3>
              </div>
              <div class="ml-11">
                <div class="p-4 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
                  <template v-if="browserInfo.isChromium">
                    <div class="flex items-center gap-2 mb-3">
                      <Globe class="w-5 h-5 text-[var(--color-secondary)]" />
                      <span class="font-medium text-[var(--color-text)]">{{ browserInfo.name }}</span>
                    </div>
                    <ol class="space-y-2 text-sm text-[var(--color-text-dim)]">
                      <li class="flex items-start gap-2">
                        <span class="text-[var(--color-secondary)]">a)</span>
                        <span>
                          Open a new tab and go to 
                          <code class="px-1.5 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-primary)] font-mono text-xs">{{ browserInfo.extensionsUrl }}</code>
                        </span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-[var(--color-secondary)]">b)</span>
                        <span>Enable <strong class="text-[var(--color-text)]">"Developer mode"</strong> (toggle in top-right corner)</span>
                      </li>
                    </ol>
                  </template>
                  <template v-else-if="browserInfo.name === 'Firefox'">
                    <div class="flex items-center gap-2 mb-3">
                      <Globe class="w-5 h-5 text-orange-500" />
                      <span class="font-medium text-[var(--color-text)]">Firefox</span>
                    </div>
                    <ol class="space-y-2 text-sm text-[var(--color-text-dim)]">
                      <li class="flex items-start gap-2">
                        <span class="text-[var(--color-secondary)]">a)</span>
                        <span>
                          Open a new tab and go to 
                          <code class="px-1.5 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-primary)] font-mono text-xs">about:debugging</code>
                        </span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-[var(--color-secondary)]">b)</span>
                        <span>Click <strong class="text-[var(--color-text)]">"This Firefox"</strong> in the sidebar</span>
                      </li>
                    </ol>
                  </template>
                  <template v-else>
                    <p class="text-sm text-[var(--color-text-dim)]">
                      Open your browser's extension management page and enable developer mode.
                    </p>
                  </template>
                </div>
              </div>
            </div>

            <!-- Step 3: Load Extension -->
            <div class="mb-6">
              <div class="flex items-center gap-3 mb-3">
                <div class="w-8 h-8 rounded-full bg-[var(--color-accent)] text-[var(--color-bg)] flex items-center justify-center font-bold text-sm" style="background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));">
                  3
                </div>
                <h3 class="font-bold text-[var(--color-text)]">Load the Extension</h3>
              </div>
              <div class="ml-11">
                <div class="p-4 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]">
                  <template v-if="browserInfo.isChromium">
                    <ol class="space-y-2 text-sm text-[var(--color-text-dim)]">
                      <li class="flex items-start gap-2">
                        <span class="text-[var(--color-secondary)]">a)</span>
                        <span>Click <strong class="text-[var(--color-text)]">"Load unpacked"</strong> button</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-[var(--color-secondary)]">b)</span>
                        <span>Select the <code class="px-1.5 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-primary)] font-mono text-xs">http-visualizer-extension</code> folder you extracted</span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-[var(--color-secondary)]">c)</span>
                        <span>The extension icon should appear in your toolbar</span>
                      </li>
                    </ol>
                  </template>
                  <template v-else-if="browserInfo.name === 'Firefox'">
                    <ol class="space-y-2 text-sm text-[var(--color-text-dim)]">
                      <li class="flex items-start gap-2">
                        <span class="text-[var(--color-secondary)]">a)</span>
                        <span>Click <strong class="text-[var(--color-text)]">"Load Temporary Add-on..."</strong></span>
                      </li>
                      <li class="flex items-start gap-2">
                        <span class="text-[var(--color-secondary)]">b)</span>
                        <span>Navigate to the extracted folder and select <code class="px-1.5 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-primary)] font-mono text-xs">manifest.json</code></span>
                      </li>
                    </ol>
                  </template>
                </div>
              </div>
            </div>

            <!-- Success indicator when connected -->
            <Transition
              enter-active-class="transition-all duration-300"
              enter-from-class="opacity-0 scale-95"
              enter-to-class="opacity-100 scale-100"
            >
              <div 
                v-if="isExtensionAvailable"
                class="p-4 rounded-lg bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30"
              >
                <div class="flex items-center gap-3">
                  <PartyPopper class="w-8 h-8 text-[var(--color-primary)]" />
                  <div>
                    <h3 class="font-bold text-[var(--color-primary)]">Extension Connected!</h3>
                    <p class="text-sm text-[var(--color-text-dim)]">
                      You're all set. CORS restrictions will be bypassed for all requests.
                    </p>
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- Footer -->
          <div class="relative flex items-center justify-between px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
            <p class="text-xs text-[var(--color-text-dim)]">
              <span class="text-[var(--color-warning)]">Note:</span> 
              Refresh this page after installing the extension
            </p>
            <div class="flex gap-3">
              <NeonButton 
                variant="ghost" 
                size="sm"
                @click="emit('close')"
              >
                CLOSE
              </NeonButton>
              <NeonButton 
                size="sm"
                :loading="isChecking"
                :disabled="isExtensionAvailable"
                @click="checkConnection"
              >
                <span class="flex items-center gap-1">
                  <Check v-if="isExtensionAvailable" class="w-4 h-4" />
                  {{ isExtensionAvailable ? 'CONNECTED' : 'CHECK CONNECTION' }}
                </span>
              </NeonButton>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

