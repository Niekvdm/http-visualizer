<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  /** Whether the modal is visible */
  show: boolean
  /** Modal title */
  title?: string
  /** Modal subtitle */
  subtitle?: string
  /** Maximum width class */
  maxWidth?: string
  /** Whether to show the close button */
  showClose?: boolean
  /** Whether clicking backdrop closes the modal */
  closeOnBackdrop?: boolean
  /** Whether pressing Escape closes the modal */
  closeOnEscape?: boolean
  /** Z-index for the modal */
  zIndex?: number
}>(), {
  maxWidth: 'max-w-lg',
  showClose: true,
  closeOnBackdrop: true,
  closeOnEscape: true,
  zIndex: 50,
})

const emit = defineEmits<{
  close: []
}>()

function handleBackdropClick() {
  if (props.closeOnBackdrop) {
    emit('close')
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.closeOnEscape && props.show) {
    emit('close')
  }
}

// Add/remove keydown listener
watch(() => props.show, (isShown) => {
  if (isShown) {
    document.addEventListener('keydown', handleKeydown)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  }
}, { immediate: true })

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div 
      v-if="show"
      class="fixed inset-0 flex items-center justify-center"
      :style="{ zIndex }"
    >
      <!-- Backdrop -->
      <div 
        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
        @click="handleBackdropClick"
      />

      <!-- Modal -->
      <div 
        class="relative bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        :class="maxWidth"
      >
        <!-- Header -->
        <div 
          v-if="title || $slots.header"
          class="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0"
        >
          <slot name="header">
            <div>
              <h2 class="text-[var(--color-primary)] font-bold text-sm uppercase tracking-wider">
                {{ title }}
              </h2>
              <p 
                v-if="subtitle" 
                class="text-xs text-[var(--color-text-dim)] mt-0.5 truncate"
              >
                {{ subtitle }}
              </p>
            </div>
          </slot>
          
          <button 
            v-if="showClose"
            class="text-[var(--color-text-dim)] hover:text-[var(--color-text)] p-1 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors"
            @click="emit('close')"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-4">
          <slot />
        </div>

        <!-- Footer -->
        <div 
          v-if="$slots.footer"
          class="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)] shrink-0"
        >
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

