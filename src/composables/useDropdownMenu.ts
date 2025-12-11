import { ref, computed, watch, onUnmounted, nextTick, type Ref } from 'vue'
import { useClickOutside } from './useClickOutside'

export interface DropdownPosition {
  top: string
  left: string
}

export interface UseDropdownMenuOptions {
  /** Offset from the trigger element in pixels */
  offset?: number
  /** Horizontal alignment relative to trigger */
  align?: 'left' | 'right' | 'center'
  /** Width offset for alignment calculations */
  alignOffset?: number
}

/**
 * Composable for managing dropdown menu state, positioning, and click-outside behavior
 * 
 * @param triggerRef - Ref to the trigger element (button that opens the dropdown)
 * @param options - Configuration options
 */
export function useDropdownMenu(
  triggerRef: Ref<HTMLElement | null>,
  options: UseDropdownMenuOptions = {}
) {
  const { offset = 4, align = 'left', alignOffset = 0 } = options

  const isOpen = ref(false)
  const dropdownRef = ref<HTMLElement | null>(null)

  // Calculate position based on trigger element
  const position = computed<DropdownPosition>(() => {
    if (!triggerRef.value) {
      return { top: '0', left: '0' }
    }

    const rect = triggerRef.value.getBoundingClientRect()
    const top = `${rect.bottom + offset}px`

    let left: string
    switch (align) {
      case 'right':
        left = `${rect.right - alignOffset}px`
        break
      case 'center':
        left = `${rect.left + rect.width / 2 - alignOffset / 2}px`
        break
      case 'left':
      default:
        left = `${rect.left - alignOffset}px`
        break
    }

    return { top, left }
  })

  // Setup click outside handling
  useClickOutside(dropdownRef, () => {
    isOpen.value = false
  }, { enabled: isOpen })

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  return {
    isOpen,
    dropdownRef,
    position,
    toggle,
    open,
    close,
  }
}

