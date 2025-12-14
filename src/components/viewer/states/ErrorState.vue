<script setup lang="ts">
import type { ExecutionError } from '@/types/execution'
import { Bomb } from 'lucide-vue-next'

defineProps<{
  error: ExecutionError
  funnyText: string
}>()
</script>

<template>
  <div class="h-full flex items-center justify-center p-3">
    <div class="text-center max-w-md">
      <Bomb class="w-8 h-8 mb-3 mx-auto text-[var(--color-error)]" />
      <div class="text-[var(--color-error)] font-mono text-sm mb-1.5">
        {{ funnyText }}
      </div>
      <div class="text-[var(--color-text-dim)] text-xs font-mono">
        {{ error.message }}
      </div>
      <div v-if="error.code" class="text-[var(--color-text-dim)] text-[10px] mt-1.5">
        Code: {{ error.code }}
      </div>
    </div>
  </div>
</template>
