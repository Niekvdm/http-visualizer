<script setup lang="ts">
import { computed } from 'vue'
import type { HttpHeader } from '@/types'
import { Check, X } from 'lucide-vue-next'

const props = defineProps<{
  headers: HttpHeader[]
}>()

const emit = defineEmits<{
  'update:headers': [headers: HttpHeader[]]
}>()

function updateHeader(index: number, field: keyof HttpHeader, value: string | boolean) {
  const newHeaders = [...props.headers]
  newHeaders[index] = { ...newHeaders[index], [field]: value }
  emit('update:headers', newHeaders)
}

function addHeader() {
  emit('update:headers', [...props.headers, { key: '', value: '', enabled: true }])
}

function removeHeader(index: number) {
  const newHeaders = props.headers.filter((_, i) => i !== index)
  emit('update:headers', newHeaders)
}

function toggleHeader(index: number) {
  updateHeader(index, 'enabled', !props.headers[index].enabled)
}
</script>

<template>
  <div class="space-y-3">
    <div class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-2">
      Custom Headers
    </div>

    <!-- Header rows -->
    <div 
      v-for="(header, index) in headers" 
      :key="index"
      class="flex items-center gap-2"
    >
      <!-- Enable toggle -->
      <button
        class="w-6 h-6 flex items-center justify-center rounded border transition-colors"
        :class="[
          header.enabled 
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/20 text-[var(--color-primary)]' 
            : 'border-[var(--color-border)] text-[var(--color-text-dim)]'
        ]"
        title="Toggle header"
        @click="toggleHeader(index)"
      >
        <Check v-if="header.enabled" class="w-3 h-3" />
      </button>

      <!-- Key input -->
      <input
        :value="header.key"
        type="text"
        class="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        :class="{ 'opacity-50': !header.enabled }"
        placeholder="Header name"
        @input="updateHeader(index, 'key', ($event.target as HTMLInputElement).value)"
      />

      <!-- Value input -->
      <input
        :value="header.value"
        type="text"
        class="flex-[2] bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1.5 text-sm text-[var(--color-text)] font-mono focus:border-[var(--color-primary)] focus:outline-none"
        :class="{ 'opacity-50': !header.enabled }"
        placeholder="Header value (supports {{variables}})"
        @input="updateHeader(index, 'value', ($event.target as HTMLInputElement).value)"
      />

      <!-- Remove button -->
      <button
        class="w-6 h-6 flex items-center justify-center text-[var(--color-error)] hover:bg-[var(--color-error)]/20 rounded transition-colors"
        title="Remove header"
        @click="removeHeader(index)"
      >
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Empty state -->
    <div 
      v-if="headers.length === 0"
      class="text-center py-4 text-[var(--color-text-dim)] text-sm"
    >
      No custom headers configured
    </div>

    <!-- Add button -->
    <button
      class="w-full py-2 border border-dashed border-[var(--color-border)] rounded text-sm text-[var(--color-text-dim)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
      @click="addHeader"
    >
      + Add Header
    </button>

    <!-- Preview -->
    <div v-if="headers.some(h => h.enabled && h.key)" class="text-xs bg-[var(--color-bg-tertiary)] p-3 rounded mt-4">
      <div class="font-bold text-[var(--color-text-dim)] mb-2">Preview:</div>
      <div 
        v-for="header in headers.filter(h => h.enabled && h.key)" 
        :key="header.key"
        class="font-mono"
      >
        <span class="text-[var(--color-primary)]">{{ header.key }}</span>: 
        <span class="text-[var(--color-secondary)]">{{ header.value || '(empty)' }}</span>
      </div>
    </div>
  </div>
</template>

