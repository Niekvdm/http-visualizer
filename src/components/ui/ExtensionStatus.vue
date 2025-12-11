<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useExtensionBridge } from '@/composables/useExtensionBridge'
import ExtensionInstallModal from './ExtensionInstallModal.vue'
import { LoaderCircle } from 'lucide-vue-next'

const { isExtensionAvailable, extensionVersion, checkExtensionAvailability } = useExtensionBridge()

const showTooltip = ref(false)
const showInstallModal = ref(false)
const isChecking = ref(false)

// Periodically check for extension availability
let checkInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // Check immediately
  recheckExtension()
  
  // Check every 5 seconds if not available
  checkInterval = setInterval(() => {
    if (!isExtensionAvailable.value) {
      checkExtensionAvailability()
    }
  }, 5000)
})

onUnmounted(() => {
  if (checkInterval) {
    clearInterval(checkInterval)
  }
})

async function recheckExtension() {
  isChecking.value = true
  await checkExtensionAvailability()
  isChecking.value = false
}

function handleClick() {
  if (isExtensionAvailable.value) {
    // If connected, just recheck
    recheckExtension()
  } else {
    // If not connected, show install modal
    showInstallModal.value = true
  }
}
</script>

<template>
  <div 
    class="relative"
    @mouseenter="showTooltip = true"
    @mouseleave="showTooltip = false"
  >
    <!-- Status indicator button - just a glowing dot -->
    <button
      class="flex items-center justify-center w-6 h-6 rounded transition-all"
      :class="[
        isExtensionAvailable
          ? 'hover:bg-[var(--color-primary)]/10'
          : 'hover:bg-[var(--color-warning)]/10'
      ]"
      @click="handleClick"
      :disabled="isChecking"
      :title="isExtensionAvailable ? 'Extension connected' : 'Extension not found'"
    >
      <!-- Status dot -->
      <span 
        v-if="!isChecking"
        class="w-2.5 h-2.5 rounded-full"
        :class="[
          isExtensionAvailable
            ? 'bg-[var(--color-primary)] shadow-[0_0_8px_var(--color-primary)]'
            : 'bg-[var(--color-warning)] animate-pulse'
        ]"
      />
      
      <!-- Loading spinner when checking -->
      <LoaderCircle v-else class="w-3 h-3 animate-spin text-[var(--color-text-dim)]" />
    </button>

    <!-- Tooltip -->
    <Transition
      enter-active-class="transition-all duration-200"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div 
        v-if="showTooltip"
        class="absolute top-full left-0 mt-2 w-72 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl z-50 overflow-hidden"
      >
        <!-- Header -->
        <div 
          class="px-3 py-2 border-b border-[var(--color-border)]"
          :class="[
            isExtensionAvailable
              ? 'bg-[var(--color-primary)]/5'
              : 'bg-[var(--color-warning)]/5'
          ]"
        >
          <div class="flex items-center gap-2">
            <span 
              class="w-2 h-2 rounded-full"
              :class="[
                isExtensionAvailable
                  ? 'bg-[var(--color-primary)]'
                  : 'bg-[var(--color-warning)]'
              ]"
            />
            <span class="text-sm font-medium text-[var(--color-text)]">
              {{ isExtensionAvailable ? 'Extension Connected' : 'Extension Not Found' }}
            </span>
          </div>
          <div v-if="isExtensionAvailable && extensionVersion" class="text-xs text-[var(--color-text-dim)] mt-1">
            Version {{ extensionVersion }}
          </div>
        </div>

        <!-- Content -->
        <div class="p-3">
          <template v-if="isExtensionAvailable">
            <p class="text-xs text-[var(--color-text-dim)] leading-relaxed">
              The HTTP Visualizer extension is active. All requests will bypass CORS restrictions.
            </p>
          </template>
          
          <template v-else>
            <p class="text-xs text-[var(--color-text-dim)] leading-relaxed mb-3">
              Install the browser extension to bypass CORS restrictions when making API requests.
            </p>
            
            <div class="bg-[var(--color-bg-tertiary)] rounded p-2 text-xs">
              <div class="font-medium text-[var(--color-text)] mb-1">Quick Install:</div>
              <ol class="text-[var(--color-text-dim)] space-y-1 list-decimal list-inside">
                <li>Open <code class="text-[var(--color-secondary)]">chrome://extensions</code></li>
                <li>Enable "Developer mode"</li>
                <li>Click "Load unpacked"</li>
                <li>Select the <code class="text-[var(--color-secondary)]">http-visualizer-extension</code> folder</li>
              </ol>
            </div>
            
            <button
              class="mt-3 w-full px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/30 rounded hover:bg-[var(--color-primary)]/20 transition-colors"
              @click="recheckExtension"
            >
              Check Again
            </button>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Install Modal -->
    <ExtensionInstallModal 
      :show="showInstallModal"
      @close="showInstallModal = false"
    />
  </div>
</template>
