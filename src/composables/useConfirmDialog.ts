import { ref, readonly, markRaw } from 'vue'

export interface ConfirmDialogOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning' | 'info'
}

export interface ConfirmDialogState {
  isOpen: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string
  variant: 'danger' | 'warning' | 'info'
}

// Global state for the confirm dialog
const dialogState = ref<ConfirmDialogState>({
  isOpen: false,
  title: 'Confirm',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  variant: 'info',
})

let resolvePromise: ((value: boolean) => void) | null = null

/**
 * Composable for managing confirmation dialogs
 * 
 * This provides a promise-based API for confirmation dialogs,
 * replacing the native `confirm()` function with a customizable dialog.
 * 
 * Usage:
 * ```ts
 * const { confirm } = useConfirmDialog()
 * 
 * async function handleDelete() {
 *   const confirmed = await confirm({
 *     title: 'Delete Item',
 *     message: 'Are you sure you want to delete this item?',
 *     variant: 'danger'
 *   })
 *   
 *   if (confirmed) {
 *     // Perform delete
 *   }
 * }
 * ```
 */
export function useConfirmDialog() {
  /**
   * Show a confirmation dialog and return a promise that resolves to true/false
   */
  function confirm(options: ConfirmDialogOptions): Promise<boolean> {
    // Close any existing dialog first
    if (resolvePromise) {
      resolvePromise(false)
      resolvePromise = null
    }

    dialogState.value = {
      isOpen: true,
      title: options.title ?? 'Confirm',
      message: options.message,
      confirmText: options.confirmText ?? 'Confirm',
      cancelText: options.cancelText ?? 'Cancel',
      variant: options.variant ?? 'info',
    }

    return new Promise((resolve) => {
      resolvePromise = resolve
    })
  }

  /**
   * Handle dialog confirmation
   */
  function handleConfirm() {
    dialogState.value.isOpen = false
    resolvePromise?.(true)
    resolvePromise = null
  }

  /**
   * Handle dialog cancellation
   */
  function handleCancel() {
    dialogState.value.isOpen = false
    resolvePromise?.(false)
    resolvePromise = null
  }

  return {
    // Dialog state (readonly to prevent external modification)
    dialogState: readonly(dialogState),
    
    // Show confirm dialog
    confirm,
    
    // Dialog event handlers
    handleConfirm,
    handleCancel,
  }
}

/**
 * Shorthand for common confirmation patterns
 */
export const confirmActions = {
  delete: (itemName: string) => ({
    title: 'Delete',
    message: `Are you sure you want to delete "${itemName}"?`,
    confirmText: 'Delete',
    variant: 'danger' as const,
  }),

  deleteWithWarning: (itemName: string, warning: string) => ({
    title: 'Delete',
    message: `Are you sure you want to delete "${itemName}"? ${warning}`,
    confirmText: 'Delete',
    variant: 'danger' as const,
  }),

  discard: () => ({
    title: 'Discard Changes',
    message: 'You have unsaved changes. Discard them?',
    confirmText: 'Discard',
    variant: 'warning' as const,
  }),
}
