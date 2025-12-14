<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  label: string
  value: string
  valueClass?: string
  truncate?: boolean
}>()
</script>

<template>
  <div class="flex items-center gap-1.5">
    <component :is="icon" class="w-3 h-3 text-[var(--color-text-dim)] shrink-0" />
    <div class="min-w-0">
      <div class="text-[10px] text-[var(--color-text-dim)]">{{ label }}</div>
      <div
        class="text-xs font-mono"
        :class="[valueClass || 'text-[var(--color-text)]', truncate ? 'truncate' : '']"
      >
        {{ value }}
      </div>
    </div>
  </div>
</template>
