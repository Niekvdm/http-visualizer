import { onUnmounted, watch, type Ref } from 'vue'

/**
 * Composable for handling click-outside detection
 * 
 * @param elementRef - Ref to the element to detect clicks outside of
 * @param callback - Function to call when a click outside is detected
 * @param options - Configuration options
 */
export function useClickOutside(
  elementRef: Ref<HTMLElement | null>,
  callback: () => void,
  options: {
    /** Whether the listener is active */
    enabled?: Ref<boolean>
    /** Use capture phase for the event listener */
    capture?: boolean
  } = {}
) {
  const { enabled, capture = true } = options

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node
    if (elementRef.value && !elementRef.value.contains(target)) {
      callback()
    }
  }

  function addListener() {
    document.addEventListener('click', handleClickOutside, capture)
  }

  function removeListener() {
    document.removeEventListener('click', handleClickOutside, capture)
  }

  // If enabled ref is provided, watch it to add/remove listeners
  if (enabled) {
    watch(enabled, (isEnabled) => {
      if (isEnabled) {
        // Use nextTick-like behavior to avoid catching the click that opened the element
        setTimeout(addListener, 0)
      } else {
        removeListener()
      }
    }, { immediate: true })
  }

  // Cleanup on unmount
  onUnmounted(() => {
    removeListener()
  })

  return {
    addListener,
    removeListener,
  }
}

