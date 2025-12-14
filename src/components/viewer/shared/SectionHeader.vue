<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  title: string
  badge?: string | number
}>()
</script>

<template>
  <div class="px-2.5 py-1.5 border-b border-[var(--color-border)] flex items-center gap-1.5">
    <component :is="icon" class="w-3.5 h-3.5 text-[var(--color-primary)]" />
    <span class="text-[10px] font-bold text-[var(--color-text-dim)] uppercase tracking-wider">
      {{ title }}
    </span>
    <span v-if="badge !== undefined" class="text-[10px] text-[var(--color-text-dim)]">
      ({{ badge }})
    </span>
  </div>
</template>
