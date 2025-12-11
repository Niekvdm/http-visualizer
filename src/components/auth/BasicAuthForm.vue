<script setup lang="ts">
import { computed } from 'vue'
import type { BasicAuthConfig } from '@/types'

const props = defineProps<{
  config: BasicAuthConfig
}>()

const emit = defineEmits<{
  'update:config': [config: BasicAuthConfig]
}>()

const username = computed({
  get: () => props.config.username,
  set: (value) => emit('update:config', { ...props.config, username: value })
})

const password = computed({
  get: () => props.config.password,
  set: (value) => emit('update:config', { ...props.config, password: value })
})

const encodedPreview = computed(() => {
  if (username.value && password.value) {
    try {
      const encoded = window.btoa(`${username.value}:${password.value}`)
      return encoded.slice(0, 20) + '...'
    } catch {
      return '(encoding error)'
    }
  }
  return '(empty)'
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Username
      </label>
      <input
        v-model="username"
        type="text"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="Enter username"
      />
    </div>

    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Password
      </label>
      <input
        v-model="password"
        type="password"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="Enter password"
      />
    </div>

    <div class="text-xs text-[var(--color-text-dim)] bg-[var(--color-bg-tertiary)] p-3 rounded">
      <div class="font-bold mb-1">Preview:</div>
      <code class="text-[var(--color-secondary)]">
        Authorization: Basic {{ encodedPreview }}
      </code>
    </div>
  </div>
</template>
