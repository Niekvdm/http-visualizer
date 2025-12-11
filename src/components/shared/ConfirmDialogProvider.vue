<script setup lang="ts">
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import ConfirmDialog from './ConfirmDialog.vue'

const { dialogState, handleConfirm, handleCancel } = useConfirmDialog()
</script>

<template>
  <ConfirmDialog
    :show="dialogState.isOpen"
    :title="dialogState.title"
    :message="dialogState.message"
    :confirm-text="dialogState.confirmText"
    :cancel-text="dialogState.cancelText"
    :variant="dialogState.variant"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

