<script setup lang="ts">
import { computed } from 'vue'
import { useThemeStore } from '@/stores/themeStore'

const themeStore = useThemeStore()

const themes = computed(() => themeStore.availableThemes)
const currentThemeId = computed(() => themeStore.currentThemeId)

function selectTheme(themeId: string) {
  themeStore.setTheme(themeId)
}
</script>

<template>
  <div class="space-y-1">
    <button
      v-for="theme in themes"
      :key="theme.id"
      class="w-full px-2 py-1.5 rounded text-left transition-colors flex items-center gap-2"
      :class="[
        currentThemeId === theme.id 
          ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' 
          : 'text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
      ]"
      @click="selectTheme(theme.id)"
    >
      <div 
        class="w-2 h-2 rounded-full shrink-0"
        :style="{ backgroundColor: theme.colors.primary }"
      />
      <span class="text-xs font-mono flex-1">{{ theme.name }}</span>
      <div class="flex gap-0.5">
        <div 
          class="w-2 h-2 rounded-sm"
          :style="{ backgroundColor: theme.colors.bg }"
        />
        <div 
          class="w-2 h-2 rounded-sm"
          :style="{ backgroundColor: theme.colors.secondary }"
        />
      </div>
    </button>
  </div>
</template>

