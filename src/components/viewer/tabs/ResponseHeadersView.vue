<script setup lang="ts">
import { computed } from 'vue'
import HeadersTable from '../shared/HeadersTable.vue'

const props = defineProps<{
  headers: Record<string, string>
}>()

const headersArray = computed(() => {
  if (!props.headers) return []
  return Object.entries(props.headers)
})
</script>

<template>
  <div class="h-full overflow-auto p-2">
    <HeadersTable
      :headers="headersArray"
      key-color-class="text-[var(--color-primary)]"
    />
  </div>
</template>
