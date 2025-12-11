<script setup lang="ts">
import { computed } from 'vue'
import type { ApiKeyAuthConfig } from '@/types'

const props = defineProps<{
  config: ApiKeyAuthConfig
}>()

const emit = defineEmits<{
  'update:config': [config: ApiKeyAuthConfig]
}>()

const key = computed({
  get: () => props.config.key,
  set: (value) => emit('update:config', { ...props.config, key: value })
})

const value = computed({
  get: () => props.config.value,
  set: (value) => emit('update:config', { ...props.config, value })
})

const location = computed({
  get: () => props.config.in,
  set: (val) => emit('update:config', { ...props.config, in: val })
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Key Name
      </label>
      <input
        v-model="key"
        type="text"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="e.g., X-API-Key, api_key"
      />
    </div>

    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Key Value
      </label>
      <input
        v-model="value"
        type="password"
        class="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        placeholder="Enter API key value"
      />
    </div>

    <div>
      <label class="block text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1">
        Add To
      </label>
      <div class="flex gap-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="location"
            type="radio"
            value="header"
            class="accent-[var(--color-primary)]"
          />
          <span class="text-sm text-[var(--color-text)]">Header</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            v-model="location"
            type="radio"
            value="query"
            class="accent-[var(--color-primary)]"
          />
          <span class="text-sm text-[var(--color-text)]">Query Parameter</span>
        </label>
      </div>
    </div>

    <div class="text-xs text-[var(--color-text-dim)] bg-[var(--color-bg-tertiary)] p-3 rounded">
      <div class="font-bold mb-1">Preview:</div>
      <code class="text-[var(--color-secondary)]">
        <template v-if="location === 'header'">
          {{ key || 'X-API-Key' }}: {{ value ? value.slice(0, 20) + '...' : '(empty)' }}
        </template>
        <template v-else>
          ?{{ key || 'api_key' }}={{ value ? value.slice(0, 10) + '...' : '(empty)' }}
        </template>
      </code>
    </div>
  </div>
</template>

