<script setup lang="ts">
import { computed } from 'vue'
import type { HttpMethod } from '@/types'

const props = withDefaults(defineProps<{
  method: HttpMethod | string
  size?: 'xs' | 'sm' | 'md'
}>(), {
  size: 'xs',
})

const colorClass = computed(() => {
  const colors: Record<string, string> = {
    GET: 'text-green-400 bg-green-400/10',
    POST: 'text-blue-400 bg-blue-400/10',
    PUT: 'text-orange-400 bg-orange-400/10',
    PATCH: 'text-yellow-400 bg-yellow-400/10',
    DELETE: 'text-red-400 bg-red-400/10',
    HEAD: 'text-purple-400 bg-purple-400/10',
    OPTIONS: 'text-gray-400 bg-gray-400/10',
  }
  return colors[props.method.toUpperCase()] || 'text-gray-400 bg-gray-400/10'
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'text-xs px-1.5 py-0.5'
    case 'sm':
      return 'text-sm px-2 py-1'
    case 'md':
      return 'text-base px-2.5 py-1.5'
    default:
      return 'text-sm px-2 py-1'
  }
})
</script>

<template>
  <span 
    class="font-bold rounded font-mono shrink-0"
    :class="[colorClass, sizeClass]"
  >
    {{ method }}
  </span>
</template>

