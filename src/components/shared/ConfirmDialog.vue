<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Trash2, Info } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}>(), {
  title: 'Confirm',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'info',
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const icon = computed(() => {
  switch (props.variant) {
    case 'danger': return Trash2
    case 'warning': return AlertTriangle
    default: return Info
  }
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('cancel')
  if (e.key === 'Enter') emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="show"
        class="fixed inset-0 z-[100] flex items-center justify-center"
        @keydown="handleKeydown"
      >
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/85"
          @click="emit('cancel')"
        />

        <!-- Dialog -->
        <div 
          class="confirm-dialog relative w-[320px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] overflow-hidden"
          :class="{
            'border-[var(--color-error)]/40': variant === 'danger',
            'border-[var(--color-warning)]/40': variant === 'warning',
          }"
        >
          <!-- Top accent line -->
          <div 
            class="absolute top-0 left-0 right-0 h-[2px]"
            :class="{
              'bg-[var(--color-error)]': variant === 'danger',
              'bg-[var(--color-warning)]': variant === 'warning',
              'bg-[var(--color-primary)]': variant === 'info',
            }"
          />

          <!-- Content -->
          <div class="px-4 py-3">
            <!-- Header row -->
            <div class="flex items-center gap-2 mb-2">
              <component 
                :is="icon" 
                class="w-4 h-4 shrink-0"
                :class="{
                  'text-[var(--color-error)]': variant === 'danger',
                  'text-[var(--color-warning)]': variant === 'warning',
                  'text-[var(--color-primary)]': variant === 'info',
                }"
              />
              <span 
                class="text-xs font-bold uppercase tracking-wider"
                :class="{
                  'text-[var(--color-error)]': variant === 'danger',
                  'text-[var(--color-warning)]': variant === 'warning',
                  'text-[var(--color-primary)]': variant === 'info',
                }"
              >
                {{ title }}
              </span>
            </div>

            <!-- Message -->
            <p class="text-sm text-[var(--color-text)] leading-snug mb-3">
              {{ message }}
            </p>

            <!-- Actions -->
            <div class="flex justify-end gap-2">
              <button 
                class="px-3 py-1.5 text-xs font-medium text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
                @click="emit('cancel')"
              >
                {{ cancelText }}
              </button>
              <button 
                class="px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded transition-all"
                :class="{
                  'bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/80': variant === 'danger',
                  'bg-[var(--color-warning)] text-black hover:bg-[var(--color-warning)]/80': variant === 'warning',
                  'bg-[var(--color-primary)] text-black hover:bg-[var(--color-primary)]/80': variant === 'info',
                }"
                @click="emit('confirm')"
              >
                {{ confirmText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-dialog {
  box-shadow: 
    0 0 0 1px rgba(0, 255, 65, 0.1),
    0 4px 20px rgba(0, 0, 0, 0.5),
    0 0 40px rgba(0, 255, 65, 0.05);
}

/* Transition animations */
.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity 0.15s ease;
}

.confirm-dialog-enter-active .confirm-dialog,
.confirm-dialog-leave-active .confirm-dialog {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}

.confirm-dialog-enter-from .confirm-dialog,
.confirm-dialog-leave-to .confirm-dialog {
  transform: scale(0.95);
  opacity: 0;
}
</style>
