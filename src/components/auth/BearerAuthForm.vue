<script setup lang="ts">
import { computed } from 'vue'
import type { BearerAuthConfig } from '@/types'

const props = defineProps<{
  config: BearerAuthConfig
}>()

const emit = defineEmits<{
  'update:config': [config: BearerAuthConfig]
}>()

const token = computed({
  get: () => props.config.token,
  set: (value) => emit('update:config', { ...props.config, token: value })
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Token
      </label>
      <textarea
        v-model="token"
        rows="3"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none resize-none"
        placeholder="Enter bearer token (without 'Bearer' prefix)"
      />
    </div>

    <div class="text-xs text-[var(--color-text-dim)] bg-[var(--color-bg-tertiary)] p-3 rounded">
      <div class="font-bold mb-1">Preview:</div>
      <code class="text-[var(--color-secondary)] break-all">
        Authorization: Bearer {{ token ? token.slice(0, 30) + (token.length > 30 ? '...' : '') : '(empty)' }}
      </code>
    </div>
  </div>
</template>

