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
</script>

<template>
  <KeyValueEditor
    v-model:items="items"
    key-label="Key"
    value-label="Value"
    key-placeholder="Header name"
    value-placeholder="Value"
    add-button-text="Add Header"
    empty-message="No headers defined. Click &quot;Add Header&quot; to add one."
  />
</template>
