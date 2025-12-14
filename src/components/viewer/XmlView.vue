<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  content: string
}>()

// Format XML with proper indentation
function formatXml(xml: string): string {
  let formatted = ''
  let indent = 0
  const tab = '  '

  // Normalize and split on tags
  const parts = xml
    .replace(/>\s*</g, '><')
    .replace(/</g, '~<')
    .replace(/>/g, '>~')
    .split('~')
    .filter(Boolean)

  for (const part of parts) {
    // Closing tag
    if (part.startsWith('</')) {
      indent--
      formatted += tab.repeat(Math.max(0, indent)) + part + '\n'
    }
    // Self-closing tag
    else if (part.endsWith('/>')) {
      formatted += tab.repeat(indent) + part + '\n'
    }
    // Opening tag
    else if (part.startsWith('<') && !part.startsWith('<?') && !part.startsWith('<!')) {
      formatted += tab.repeat(indent) + part + '\n'
      indent++
    }
    // Declaration or doctype
    else if (part.startsWith('<?') || part.startsWith('<!')) {
      formatted += part + '\n'
    }
    // Text content
    else {
      const trimmed = part.trim()
      if (trimmed) {
        formatted += tab.repeat(indent) + trimmed + '\n'
      }
    }
  }

  return formatted.trim()
}

// Syntax highlighting for XML
function highlightXml(xml: string): string {
  return xml
    // Tags
    .replace(/(&lt;\/?)([\w:-]+)/g, '$1<span class="text-[var(--color-primary)]">$2</span>')
    .replace(/<(\/?)([\w:-]+)/g, '&lt;$1<span class="text-[var(--color-primary)]">$2</span>')
    // Attributes
    .replace(/([\w:-]+)=/g, '<span class="text-[var(--color-secondary)]">$1</span>=')
    // Attribute values
    .replace(/="([^"]*)"/g, '="<span class="text-[var(--color-warning)]">$1</span>"')
    // Comments
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-[var(--color-text-dim)]">$1</span>')
    // CDATA
    .replace(/(&lt;!\[CDATA\[[\s\S]*?\]\]&gt;)/g, '<span class="text-[var(--color-text-dim)]">$1</span>')
    // Close brackets
    .replace(/(\/?&gt;)/g, '<span class="text-[var(--color-text-dim)]">$1</span>')
    .replace(/(\/>|>)/g, '<span class="text-[var(--color-text-dim)]">$1</span>')
}

const formattedContent = computed(() => {
  try {
    return formatXml(props.content)
  } catch {
    return props.content
  }
})

const highlightedContent = computed(() => {
  // Escape HTML first, then apply highlighting
  const escaped = formattedContent.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    // Tags (opening and closing)
    .replace(/(&lt;\/?)(\w[\w:-]*)/g, '$1<span class="text-[var(--color-primary)]">$2</span>')
    // Attributes
    .replace(/\s([\w:-]+)=/g, ' <span class="text-[var(--color-secondary)]">$1</span>=')
    // Attribute values
    .replace(/="([^"]*)"/g, '="<span class="text-[var(--color-warning)]">$1</span>"')
    // Close brackets
    .replace(/(\/?&gt;)/g, '<span class="text-[var(--color-text-dim)]">$1</span>')
    // Comments
    .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="text-[var(--color-text-dim)] italic">$1</span>')
})
</script>

<template>
  <div class="h-full overflow-auto p-4 font-mono text-sm">
    <pre
      class="whitespace-pre-wrap break-words text-[var(--color-text)]"
      v-html="highlightedContent"
    />
  </div>
</template>
