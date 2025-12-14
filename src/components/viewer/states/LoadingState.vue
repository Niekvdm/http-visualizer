<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'

defineProps<{
  funnyText: string
  showViewRequest?: boolean
}>()

const emit = defineEmits<{
  viewRequest: []
}>()
</script>

<template>
  <div class="h-full flex items-center justify-center">
    <div class="text-center">
      <RefreshCw class="w-8 h-8 mb-3 mx-auto animate-spin text-[var(--color-primary)]" />
      <div class="text-[var(--color-primary)] font-mono text-sm glow-text">
        {{ funnyText }}
      </div>
      <button
        v-if="showViewRequest"
        class="mt-3 text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-secondary)] underline"
        @click="emit('viewRequest')"
      >
        View sent request →
      </button>
    </div>
  </div>
</template>
