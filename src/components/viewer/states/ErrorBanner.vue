<script setup lang="ts">
import type { ExecutionError } from '@/types/execution'
import { AlertTriangle } from 'lucide-vue-next'

defineProps<{
  error: ExecutionError
}>()
</script>

<template>
  <div class="absolute top-0 left-0 right-0 z-10 bg-[var(--color-error)]/10 border-b border-[var(--color-error)]/30 px-3 py-1.5">
    <div class="flex items-center gap-2 text-xs">
      <AlertTriangle class="w-3.5 h-3.5 text-[var(--color-error)]" />
      <span class="text-[var(--color-error)] font-medium">{{ error.message }}</span>
      <span v-if="error.code" class="text-[var(--color-text-dim)] text-[10px]">({{ error.code }})</span>
    </div>
  </div>
</template>
