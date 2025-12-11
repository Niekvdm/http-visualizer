<script setup lang="ts">
import { computed } from 'vue'
import type { HttpHeader } from '@/types'
import KeyValueEditor from '@/components/shared/KeyValueEditor.vue'

const props = defineProps<{
  headers: HttpHeader[]
}>()

const emit = defineEmits<{
  'update:headers': [headers: HttpHeader[]]
}>()

// Adapter to convert between HttpHeader[] and KeyValueItem[]
const items = computed({
  get: () => props.headers,
  set: (value) => emit('update:headers', value as HttpHeader[]),
})

// Filter enabled headers for preview
const enabledHeaders = computed(() => 
  props.headers.filter(h => h.enabled && h.key)
)
</script>

<template>
  <div class="space-y-3">
    <div class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-2">
      Custom Headers
    </div>

    <KeyValueEditor
      v-model:items="items"
      key-label="Key"
      value-label="Value"
      key-placeholder="Header name"
      value-placeholder="Header value (supports {{variables}})"
      add-button-text="+ Add Header"
      empty-message="No custom headers configured"
    />

    <!-- Preview -->
    <div v-if="enabledHeaders.length > 0" class="text-xs bg-[var(--color-bg-tertiary)] p-3 rounded mt-4">
      <div class="font-bold text-[var(--color-text-dim)] mb-2">Preview:</div>
      <div 
        v-for="header in enabledHeaders" 
        :key="header.key"
        class="font-mono"
      >
        <span class="text-[var(--color-primary)]">{{ header.key }}</span>: 
        <span class="text-[var(--color-secondary)]">{{ header.value || '(empty)' }}</span>
      </div>
    </div>
  </div>
</template>
