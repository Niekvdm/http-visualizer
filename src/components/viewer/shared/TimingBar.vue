<script setup lang="ts">
defineProps<{
  label: string
  value: number
  total: number
  color: string
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="w-16 text-[10px] text-[var(--color-text-dim)] font-mono">{{ label }}</span>
    <div class="flex-1 h-3 bg-[var(--color-bg)] rounded-sm overflow-hidden">
      <div
        class="h-full"
        :class="color"
        :style="{ width: `${Math.max(2, (value / total) * 100)}%` }"
      />
    </div>
    <span class="w-12 text-right text-[10px] text-[var(--color-text)] font-mono">
      {{ value.toFixed(0) }}ms
    </span>
  </div>
</template>
