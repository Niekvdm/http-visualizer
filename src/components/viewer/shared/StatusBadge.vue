<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  variant: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'default' | 'success' | 'redirect' | 'error' | 'info' | 'warning' | 'protocol-http2' | 'protocol-http1' | 'cached' | 'extension' | 'proxy' | 'direct'
  text: string
  size?: 'xs' | 'sm'
}>()

const classes = computed(() => {
  const sizeClass = props.size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-1 py-0.5 text-[10px]'

  const variantClasses: Record<string, string> = {
    // HTTP methods
    'get': 'bg-green-500/20 text-green-400',
    'post': 'bg-blue-500/20 text-blue-400',
    'put': 'bg-yellow-500/20 text-yellow-400',
    'patch': 'bg-orange-500/20 text-orange-400',
    'delete': 'bg-red-500/20 text-red-400',
    'default': 'bg-purple-500/20 text-purple-400',
    // Status codes
    'success': 'bg-green-500/20 text-green-400',
    'redirect': 'bg-orange-500/20 text-orange-400',
    'error': 'bg-red-500/20 text-red-400',
    // Info badges
    'info': 'bg-[var(--color-bg)] text-[var(--color-text-dim)]',
    'warning': 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
    // Protocol
    'protocol-http2': 'bg-green-500/20 text-green-400',
    'protocol-http1': 'bg-[var(--color-bg)] text-[var(--color-text-dim)]',
    // Cache
    'cached': 'bg-blue-500/20 text-blue-400',
    // Via indicators
    'extension': 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]',
    'proxy': 'bg-[var(--color-secondary)]/20 text-[var(--color-secondary)]',
    'direct': 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
  }

  return `${sizeClass} font-bold rounded-sm ${variantClasses[props.variant] || variantClasses.default}`
})
</script>

<template>
  <span :class="classes">
    {{ text }}
  </span>
</template>
