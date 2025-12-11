<script setup lang="ts">
import { computed } from 'vue'
import { formatJson, isValidJson } from '@/utils/formatters'

const props = defineProps<{
  content: string
  contentType?: string
}>()

const formattedContent = computed(() => {
  if (isValidJson(props.content)) {
    return formatJson(props.content)
  }
  return props.content
})

const isJson = computed(() => isValidJson(props.content))

// Simple syntax highlighting for JSON
function highlightJson(json: string): string {
  return json
    .replace(/"([^"]+)":/g, '<span class="text-[var(--color-text)]">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="text-[var(--color-secondary)]">"$1"</span>')
    .replace(/: (\d+\.?\d*)/g, ': <span class="text-[var(--color-warning)]">$1</span>')
    .replace(/: (true|false)/g, ': <span class="text-[var(--color-primary)]">$1</span>')
    .replace(/: (null)/g, ': <span class="text-[var(--color-text-dim)]">$1</span>')
}

const highlightedContent = computed(() => {
  if (isJson.value) {
    return highlightJson(formattedContent.value)
  }
  return formattedContent.value
})
</script>

<template>
  <div class="h-full overflow-auto p-4 font-mono text-sm">
    <pre 
      v-if="isJson"
      class="whitespace-pre-wrap break-words text-[var(--color-text)]"
      v-html="highlightedContent"
    />
    <pre 
      v-else
      class="whitespace-pre-wrap break-words text-[var(--color-text)]"
    >{{ formattedContent }}</pre>
  </div>
</template>

