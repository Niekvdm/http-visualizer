<script setup lang="ts">
import { ref, computed, provide, nextTick } from 'vue'
import { useClickOutside } from '@/composables/useClickOutside'

const props = withDefaults(defineProps<{
  /** Horizontal alignment relative to trigger */
  align?: 'left' | 'right' | 'center'
  /** Offset from trigger element in pixels */
  offset?: number
  /** Minimum width of dropdown */
  minWidth?: string
  /** Auto-close when item is clicked */
  closeOnSelect?: boolean
}>(), {
  align: 'right',
  offset: 4,
  minWidth: '160px',
  closeOnSelect: true,
})

const isOpen = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)

// Provide close function to menu items
provide('contextMenuClose', () => {
  if (props.closeOnSelect) {
    isOpen.value = false
  }
})

// Calculate position with viewport boundary detection
const position = computed(() => {
  if (!triggerRef.value || !isOpen.value) {
    return { top: '0', left: '0', transformOrigin: 'top right' }
  }

  const rect = triggerRef.value.getBoundingClientRect()
  const menuWidth = parseInt(props.minWidth) || 160
  const menuHeight = 200 // Estimated max height

  let top = rect.bottom + props.offset
  let left: number
  let transformOrigin = 'top'

  // Calculate horizontal position based on alignment
  switch (props.align) {
    case 'right':
      left = rect.right - menuWidth
      transformOrigin += ' right'
      break
    case 'center':
      left = rect.left + rect.width / 2 - menuWidth / 2
      transformOrigin += ' center'
      break
    case 'left':
    default:
      left = rect.left
      transformOrigin += ' left'
      break
  }

  // Viewport boundary detection - horizontal
  if (left + menuWidth > window.innerWidth - 8) {
    left = window.innerWidth - menuWidth - 8
  }
  if (left < 8) {
    left = 8
  }

  // Viewport boundary detection - vertical
  if (top + menuHeight > window.innerHeight - 8) {
    // Position above trigger instead
    top = rect.top - props.offset - menuHeight
    transformOrigin = transformOrigin.replace('top', 'bottom')
  }

  return {
    top: `${top}px`,
    left: `${left}px`,
    transformOrigin,
  }
})

// Click outside detection - exclude trigger element
useClickOutside(menuRef, () => {
  isOpen.value = false
}, {
  enabled: isOpen,
  exclude: [triggerRef],
})

function toggle() {
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

// Handle escape key
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    isOpen.value = false
  }
}

// Expose methods for programmatic control
defineExpose({ isOpen, toggle, close })
</script>

<template>
  <div ref="triggerRef" class="inline-block" @click.stop="toggle">
    <slot name="trigger" />
  </div>

  <Teleport to="body">
    <Transition name="context-menu">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="fixed z-[200] py-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-xl"
        :style="{
          top: position.top,
          left: position.left,
          minWidth: minWidth,
          transformOrigin: position.transformOrigin,
        }"
        @keydown="handleKeydown"
        tabindex="-1"
      >
        <slot />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu-enter-active,
.context-menu-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.context-menu-enter-from,
.context-menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
