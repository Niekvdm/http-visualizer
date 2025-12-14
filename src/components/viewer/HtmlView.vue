<script setup lang="ts">
import { ref, computed } from 'vue'
import { Code, Eye } from 'lucide-vue-next'

const props = defineProps<{
  content: string
}>()

type ViewMode = 'preview' | 'source'
const viewMode = ref<ViewMode>('preview')

// Format HTML with proper indentation
function formatHtml(html: string): string {
  let formatted = ''
  let indent = 0
  const tab = '  '

  // Void elements that don't need closing tags
  const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
  ])

  // Split on tags while preserving them
  const parts = html
    .replace(/>\s+</g, '><')
    .split(/(<[^>]+>)/)
    .filter(Boolean)

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('</')) {
      // Closing tag
      indent = Math.max(0, indent - 1)
      formatted += tab.repeat(indent) + trimmed + '\n'
    } else if (trimmed.startsWith('<')) {
      // Opening tag or self-closing
      const tagMatch = trimmed.match(/^<(\w+)/)
      const tagName = tagMatch ? tagMatch[1].toLowerCase() : ''
      const isSelfClosing = trimmed.endsWith('/>') || voidElements.has(tagName)

      formatted += tab.repeat(indent) + trimmed + '\n'
      if (!isSelfClosing && !trimmed.startsWith('<!') && !trimmed.startsWith('<?')) {
        indent++
      }
    } else {
      // Text content
      if (trimmed) {
        formatted += tab.repeat(indent) + trimmed + '\n'
      }
    }
  }

  return formatted.trim()
}

// Syntax highlighting for HTML
const highlightedContent = computed(() => {
  const formatted = formatHtml(props.content)
  const escaped = formatted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    // Tags
    .replace(/(&lt;\/?)(\w+)/g, '$1<span class="text-[var(--color-primary)]">$2</span>')
    // Attributes
    .replace(/\s([\w-]+)=/g, ' <span class="text-[var(--color-secondary)]">$1</span>=')
    // Attribute values
    .replace(/="([^"]*)"/g, '="<span class="text-[var(--color-warning)]">$1</span>"')
    // Close brackets
    .replace(/(\/?&gt;)/g, '<span class="text-[var(--color-text-dim)]">$1</span>')
    // Comments
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-[var(--color-text-dim)] italic">$1</span>')
    // DOCTYPE
    .replace(/(&lt;!DOCTYPE[^&]*&gt;)/gi, '<span class="text-[var(--color-text-dim)]">$1</span>')
})

// Create blob URL for iframe preview
const previewUrl = computed(() => {
  const blob = new Blob([props.content], { type: 'text/html' })
  return URL.createObjectURL(blob)
})
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- View mode toggle -->
    <div class="flex items-center gap-1 p-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
      <button
        class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-colors"
        :class="viewMode === 'preview'
          ? 'bg-[var(--color-primary)] text-[var(--color-bg)]'
          : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'"
        @click="viewMode = 'preview'"
      >
        <Eye class="w-3 h-3" />
        Preview
      </button>
      <button
        class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-colors"
        :class="viewMode === 'source'
          ? 'bg-[var(--color-primary)] text-[var(--color-bg)]'
          : 'text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'"
        @click="viewMode = 'source'"
      >
        <Code class="w-3 h-3" />
        Source
      </button>
    </div>

    <!-- Content area -->
    <div class="flex-1 overflow-hidden">
      <!-- Preview mode -->
      <iframe
        v-if="viewMode === 'preview'"
        :src="previewUrl"
        class="w-full h-full border-0 bg-white"
        sandbox="allow-same-origin"
        title="HTML Preview"
      />

      <!-- Source mode -->
      <div v-else class="h-full overflow-auto p-4 font-mono text-sm">
        <pre
          class="whitespace-pre-wrap break-words text-[var(--color-text)]"
          v-html="highlightedContent"
        />
      </div>
    </div>
  </div>
</template>
