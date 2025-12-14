<script setup lang="ts">
import { computed } from 'vue'
import type { SentRequest } from '@/types/request'
import { formatBytes } from '@/utils/formatters'
import HeadersTable from '../shared/HeadersTable.vue'
import StatusBadge from '../shared/StatusBadge.vue'
import JsonTreeView from '../JsonTreeView.vue'

const props = defineProps<{
  sentRequest: SentRequest
}>()

const requestHeadersArray = computed(() => {
  if (!props.sentRequest.headers) return []
  return Object.entries(props.sentRequest.headers)
})

const requestBodyParsed = computed(() => {
  if (!props.sentRequest.body) return null
  try {
    return JSON.parse(props.sentRequest.body)
  } catch {
    return null
  }
})

const requestBodySize = computed(() => {
  if (!props.sentRequest.body) return 0
  return new Blob([props.sentRequest.body]).size
})

const methodVariant = computed(() => {
  const method = props.sentRequest.method.toUpperCase()
  const variants: Record<string, 'get' | 'post' | 'put' | 'patch' | 'delete' | 'default'> = {
    'GET': 'get',
    'POST': 'post',
    'PUT': 'put',
    'PATCH': 'patch',
    'DELETE': 'delete',
  }
  return variants[method] || 'default'
})

const viaVariant = computed(() => {
  if (props.sentRequest.viaExtension) return 'extension'
  if (props.sentRequest.viaProxy) return 'proxy'
  return 'direct'
})

const viaText = computed(() => {
  if (props.sentRequest.viaExtension) return 'via Extension'
  if (props.sentRequest.viaProxy) return 'via Proxy'
  return 'Direct Fetch'
})

const viaTitle = computed(() => {
  if (props.sentRequest.viaExtension) return 'Request sent via browser extension (CORS bypassed)'
  if (props.sentRequest.viaProxy) return 'Request sent via proxy backend (CORS bypassed)'
  return 'Request sent directly (may hit CORS)'
})
</script>

<template>
  <div class="h-full overflow-auto p-2">
    <div class="space-y-2">
      <!-- Request Line -->
      <div class="bg-[var(--color-bg-tertiary)] rounded-sm p-2.5 border border-[var(--color-border)]">
        <div class="flex items-center gap-2 mb-1.5">
          <StatusBadge :variant="methodVariant" :text="sentRequest.method" />
          <StatusBadge :variant="viaVariant" :text="viaText" :title="viaTitle" />
        </div>
        <code class="text-xs text-[var(--color-text)] break-all font-mono">
          {{ sentRequest.url }}
        </code>
      </div>

      <!-- Request Headers -->
      <div class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
        <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center justify-between">
          <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
            Request Headers
          </span>
          <span class="text-[10px] text-[var(--color-text-dim)]">
            {{ requestHeadersArray.length }}
          </span>
        </div>
        <div class="p-2.5">
          <HeadersTable
            :headers="requestHeadersArray"
            key-color-class="text-[var(--color-secondary)]"
            :mask-sensitive="true"
          />
        </div>
      </div>

      <!-- Request Body (if present) -->
      <div v-if="sentRequest.body" class="bg-[var(--color-bg-tertiary)] rounded-sm border border-[var(--color-border)]">
        <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center justify-between">
          <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
            Request Body
          </span>
          <span class="text-[10px] text-[var(--color-text-dim)]">
            {{ formatBytes(requestBodySize) }}
          </span>
        </div>
        <div class="p-2.5">
          <!-- If JSON, show tree view -->
          <JsonTreeView
            v-if="requestBodyParsed"
            :data="requestBodyParsed"
            :initial-expanded="true"
          />
          <!-- Otherwise show raw -->
          <pre v-else class="font-mono text-xs text-[var(--color-text)] whitespace-pre-wrap break-all">{{ sentRequest.body }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
