<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'

withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false
})

const emit = defineEmits<{
  click: [e: MouseEvent]
}>()

function handleClick(e: MouseEvent) {
  emit('click', e)
}
</script>

<template>
  <button
    class="relative font-mono font-bold uppercase tracking-wider transition-all duration-200 border-2 rounded"
    :class="[
      // Size classes
      size === 'sm' && 'px-3 py-1 text-xs',
      size === 'md' && 'px-4 py-2 text-sm',
      size === 'lg' && 'px-6 py-3 text-base',
      
      // Variant classes
      variant === 'primary' && 'bg-[var(--color-primary)] text-[var(--color-bg)] border-[var(--color-primary)] hover:bg-transparent hover:text-[var(--color-primary)] hover:shadow-[0_0_20px_var(--color-glow)]',
      variant === 'secondary' && 'bg-transparent text-[var(--color-secondary)] border-[var(--color-secondary)] hover:bg-[var(--color-secondary)] hover:text-[var(--color-bg)] hover:shadow-[0_0_20px_var(--color-secondary)]',
      variant === 'danger' && 'bg-transparent text-[var(--color-error)] border-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-[var(--color-bg)] hover:shadow-[0_0_20px_var(--color-error)]',
      variant === 'ghost' && 'bg-transparent text-[var(--color-text)] border-transparent hover:border-[var(--color-border)] hover:text-[var(--color-primary)]',
      
      // State classes
      (disabled || loading) && 'opacity-50 cursor-not-allowed pointer-events-none',
    ]"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="flex items-center gap-2">
      <LoaderCircle class="w-4 h-4 animate-spin" />
      <slot>Loading...</slot>
    </span>
    <span v-else>
      <slot />
    </span>
  </button>
</template>

