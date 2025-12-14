<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { ExecutionResponse } from '@/types/execution'

// View components
import JsonTreeView from '../JsonTreeView.vue'
import RawView from '../RawView.vue'
import TableView from '../TableView.vue'
import XmlView from '../XmlView.vue'
import HtmlView from '../HtmlView.vue'
import ImageView from '../ImageView.vue'
import HexView from '../HexView.vue'

export type ResponseViewMode = 'json' | 'xml' | 'html' | 'text' | 'image' | 'hex' | 'table'

const props = defineProps<{
  response: ExecutionResponse
}>()

// Current view mode
const viewMode = ref<ResponseViewMode>('text')

// Get content type from headers
const contentType = computed(() => {
  return props.response.headers['content-type']?.toLowerCase() || ''
})

// Parse the body as JSON if possible
const parsedBody = computed(() => props.response.bodyParsed ?? null)

// Check if body is valid JSON
const isJson = computed(() => parsedBody.value !== null)

// Check if body can be displayed as table (array or object)
const canShowTable = computed(() => {
  if (!parsedBody.value) return false
  return Array.isArray(parsedBody.value) || typeof parsedBody.value === 'object'
})

// Detect content category from Content-Type
type ContentCategory = 'json' | 'xml' | 'svg' | 'html' | 'text' | 'image' | 'binary'

const contentCategory = computed<ContentCategory>(() => {
  const ct = contentType.value
  const body = props.response.body?.trim() || ''

  // JSON
  if (ct.includes('application/json') || ct.includes('+json')) {
    return 'json'
  }

  // SVG (check before generic XML and image)
  if (ct.includes('image/svg') || ct.includes('svg+xml')) {
    return 'svg'
  }

  // XML (but not SVG)
  if (ct.includes('application/xml') || ct.includes('text/xml') || ct.includes('+xml')) {
    return 'xml'
  }

  // HTML
  if (ct.includes('text/html')) {
    return 'html'
  }

  // Images (non-SVG)
  if (ct.startsWith('image/')) {
    return 'image'
  }

  // Text-based content
  if (ct.startsWith('text/') || ct.includes('javascript') || ct.includes('css')) {
    return 'text'
  }

  // Binary/other
  if (ct.includes('application/octet-stream') || ct.includes('application/pdf')) {
    return 'binary'
  }

  // Fallback: try to detect from content
  if (isJson.value) {
    return 'json'
  }

  // Check for SVG content
  if (body.includes('<svg') && body.includes('</svg>')) {
    return 'svg'
  }

  // Check for XML-like content
  if (body.startsWith('<?xml') || body.startsWith('<') && body.includes('</')) {
    return 'xml'
  }

  // Check for HTML-like content
  if (body.toLowerCase().includes('<!doctype html') || body.toLowerCase().includes('<html')) {
    return 'html'
  }

  return 'text'
})

// Determine available view modes based on content
const availableModes = computed<ResponseViewMode[]>(() => {
  const modes: ResponseViewMode[] = []

  switch (contentCategory.value) {
    case 'json':
      modes.push('json')
      if (canShowTable.value) modes.push('table')
      modes.push('text', 'hex')
      break

    case 'svg':
      // SVG can be viewed as both image and XML
      modes.push('image', 'xml', 'text', 'hex')
      break

    case 'xml':
      modes.push('xml', 'text', 'hex')
      break

    case 'html':
      modes.push('html', 'text', 'hex')
      break

    case 'image':
      modes.push('image', 'hex')
      break

    case 'binary':
      modes.push('hex')
      // Also allow text view in case it's actually text
      modes.push('text')
      break

    case 'text':
    default:
      // For text, also check if it's valid JSON we missed
      if (isJson.value) {
        modes.push('json')
        if (canShowTable.value) modes.push('table')
      }
      modes.push('text', 'hex')
      break
  }

  return modes
})

// Get default view mode for content
const defaultMode = computed<ResponseViewMode>(() => {
  switch (contentCategory.value) {
    case 'json':
      return 'json'
    case 'svg':
      return 'image' // Default to image view for SVG
    case 'xml':
      return 'xml'
    case 'html':
      return 'html'
    case 'image':
      return 'image'
    case 'binary':
      return 'hex'
    default:
      return isJson.value ? 'json' : 'text'
  }
})

// Set initial view mode when response changes
watch(() => props.response, () => {
  viewMode.value = defaultMode.value
}, { immediate: true })

// Mode labels for display
const modeLabels: Record<ResponseViewMode, string> = {
  json: 'JSON',
  xml: 'XML',
  html: 'HTML',
  text: 'Text',
  image: 'Image',
  hex: 'Hex',
  table: 'Table'
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- View mode toggle bar -->
    <div class="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
      <button
        v-for="mode in availableModes"
        :key="mode"
        class="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded transition-colors"
        :class="viewMode === mode
          ? 'bg-[var(--color-primary)] text-[var(--color-bg)]'
          : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'"
        @click="viewMode = mode"
      >
        {{ modeLabels[mode] }}
      </button>
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-hidden">
      <!-- JSON View -->
      <div v-if="viewMode === 'json'" class="h-full overflow-auto p-2">
        <JsonTreeView v-if="parsedBody" :data="parsedBody" :initial-expanded="true" />
        <div v-else class="text-[var(--color-text-dim)] text-center py-6 text-xs">
          Response is not valid JSON
        </div>
      </div>

      <!-- XML View -->
      <XmlView v-else-if="viewMode === 'xml'" :content="response.body || ''" />

      <!-- HTML View -->
      <HtmlView v-else-if="viewMode === 'html'" :content="response.body || ''" />

      <!-- Text View -->
      <RawView
        v-else-if="viewMode === 'text'"
        :content="response.body || ''"
        :content-type="response.headers['content-type']"
      />

      <!-- Image View -->
      <ImageView
        v-else-if="viewMode === 'image'"
        :content="response.body || ''"
        :content-type="response.headers['content-type'] || 'image/png'"
      />

      <!-- Hex View -->
      <HexView v-else-if="viewMode === 'hex'" :content="response.body || ''" />

      <!-- Table View -->
      <div v-else-if="viewMode === 'table'" class="h-full">
        <TableView :data="parsedBody" />
      </div>
    </div>
  </div>
</template>
