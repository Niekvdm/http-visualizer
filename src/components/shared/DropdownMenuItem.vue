<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  /** Whether this is a danger/destructive action */
  danger?: boolean
  /** Whether the item is disabled */
  disabled?: boolean
  /** Icon component to display */
  icon?: object
}>(), {
  danger: false,
  disabled: false,
})

const emit = defineEmits<{
  click: []
}>()

function handleClick() {
  if (!props.disabled) {
    emit('click')
  }
}
</script>

<template>
  <button
    class="w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-bg-tertiary)] flex items-center gap-2 transition-colors"
    :class="[
      danger ? 'text-[var(--color-error)]' : 'text-[var(--color-text)]',
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
    ]"
    :disabled="disabled"
    @click="handleClick"
  >
    <component v-if="icon" :is="icon" class="w-4 h-4" />
    <slot />
  </button>
</template>

