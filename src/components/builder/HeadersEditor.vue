<script setup lang="ts">
import { computed } from 'vue'
import type { HttpHeader } from '@/types'
import { Plus, Trash2, GripVertical } from 'lucide-vue-next'

const props = defineProps<{
  headers: HttpHeader[]
}>()

const emit = defineEmits<{
  'update:headers': [headers: HttpHeader[]]
}>()

const localHeaders = computed({
  get: () => props.headers,
  set: (value) => emit('update:headers', value)
})

function addHeader() {
  localHeaders.value = [
    ...localHeaders.value,
    { key: '', value: '', enabled: true }
  ]
}

function removeHeader(index: number) {
  const updated = [...localHeaders.value]
  updated.splice(index, 1)
  localHeaders.value = updated
}

function updateHeader(index: number, field: keyof HttpHeader, value: string | boolean) {
  const updated = [...localHeaders.value]
  updated[index] = { ...updated[index], [field]: value }
  localHeaders.value = updated
}

function toggleHeader(index: number) {
  updateHeader(index, 'enabled', !localHeaders.value[index].enabled)
}
</script>

<template>
  <div class="headers-editor space-y-2">
    <!-- Header row labels -->
    <div class="flex items-center gap-2 text-[10px] text-[var(--color-text-dim)] uppercase tracking-wider px-1">
      <div class="w-6"></div>
      <div class="flex-1">Key</div>
      <div class="flex-1">Value</div>
      <div class="w-8"></div>
    </div>

    <!-- Header rows -->
    <div 
      v-for="(header, index) in localHeaders" 
      :key="index"
      class="flex items-center gap-2 group"
    >
      <!-- Enable checkbox -->
      <input
        type="checkbox"
        :checked="header.enabled"
        class="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg)] accent-[var(--color-primary)] cursor-pointer"
        @change="toggleHeader(index)"
      />

      <!-- Key input -->
      <input
        :value="header.key"
        type="text"
        placeholder="Header name"
        class="flex-1 px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)] disabled:opacity-50"
        :disabled="!header.enabled"
        @input="updateHeader(index, 'key', ($event.target as HTMLInputElement).value)"
      />

      <!-- Value input -->
      <input
        :value="header.value"
        type="text"
        placeholder="Value"
        class="flex-1 px-2 py-1.5 text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] font-mono placeholder:text-[var(--color-text-dim)] disabled:opacity-50"
        :disabled="!header.enabled"
        @input="updateHeader(index, 'value', ($event.target as HTMLInputElement).value)"
      />

      <!-- Remove button -->
      <button
        class="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--color-error)]/20 text-[var(--color-text-dim)] hover:text-[var(--color-error)] transition-all"
        title="Remove header"
        @click="removeHeader(index)"
      >
        <Trash2 class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Add header button -->
    <button
      class="flex items-center gap-1 px-2 py-1.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] rounded transition-colors"
      @click="addHeader"
    >
      <Plus class="w-3.5 h-3.5" />
      Add Header
    </button>

    <!-- Empty state -->
    <div
      v-if="localHeaders.length === 0"
      class="text-center py-4 text-xs text-[var(--color-text-dim)]"
    >
      No headers defined. Click "Add Header" to add one.
    </div>
  </div>
</template>

