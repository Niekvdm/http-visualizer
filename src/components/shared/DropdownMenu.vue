<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { useDropdownMenu } from '@/composables/useDropdownMenu'

const props = withDefaults(defineProps<{
  /** Ref to the trigger element for positioning */
  triggerRef: HTMLElement | null
  /** Whether the dropdown is open */
  modelValue: boolean
  /** Offset from trigger element */
  offset?: number
  /** Horizontal alignment */
  align?: 'left' | 'right' | 'center'
  /** Width offset for alignment */
  alignOffset?: number
  /** Minimum width of dropdown */
  minWidth?: string
}>(), {
  offset: 4,
  align: 'left',
  alignOffset: 120,
  minWidth: '160px',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const slots = useSlots()

// Compute position based on trigger element
const position = computed(() => {
  if (!props.triggerRef) {
    return { top: '0', left: '0' }
  }

  const rect = props.triggerRef.getBoundingClientRect()
  const top = `${rect.bottom + props.offset}px`

  let left: string
  switch (props.align) {
    case 'right':
      left = `${rect.left - props.alignOffset}px`
      break
    case 'center':
      left = `${rect.left + rect.width / 2 - props.alignOffset / 2}px`
      break
    case 'left':
    default:
      left = `${rect.left}px`
      break
  }

  return { top, left }
})

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  // Check if click is outside the dropdown
  if (props.modelValue) {
    emit('update:modelValue', false)
  }
}

// Close on escape
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.modelValue) {
    emit('update:modelValue', false)
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      ref="dropdownRef"
      class="fixed z-[200] py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-xl"
      :style="{
        top: position.top,
        left: position.left,
        minWidth: minWidth,
      }"
      @keydown="handleKeydown"
    >
      <slot />
    </div>
  </Teleport>
</template>

