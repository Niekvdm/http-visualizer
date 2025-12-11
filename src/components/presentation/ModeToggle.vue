<script setup lang="ts">
import { computed } from 'vue'
import { usePresentationStore } from '@/stores/presentationStore'
import { PRESENTATION_MODES } from './modes'
import type { PresentationMode } from '@/types'

const presentationStore = usePresentationStore()

const mode = computed(() => presentationStore.mode)
const modeLabel = computed(() => presentationStore.modeLabel)

function setMode(newMode: PresentationMode) {
  presentationStore.setMode(newMode)
}
</script>

<template>
  <div class="absolute top-3 right-3 z-20">
    <div class="relative group">
      <button class="mode-toggle-btn">
        {{ modeLabel.toUpperCase() }}
      </button>

      <!-- Dropdown -->
      <div class="mode-dropdown absolute top-full right-0 mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        <button
          v-for="modeInfo in PRESENTATION_MODES"
          :key="modeInfo.id"
          class="mode-option"
          :class="{ active: mode === modeInfo.id }"
          @click="setMode(modeInfo.id)"
        >
          <span class="mode-name">{{ modeInfo.name.toUpperCase() }}</span>
          <span class="mode-desc">{{ modeInfo.description }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mode-toggle-btn {
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  letter-spacing: 1px;
  padding: 4px 8px;
  cursor: pointer;
  transition: color 0.15s;
}

.mode-toggle-btn:hover {
  color: var(--color-primary);
}

.mode-dropdown {
  background: rgba(10, 10, 10, 0.95);
  padding: 4px 0;
  min-width: 200px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  backdrop-filter: blur(8px);
}

.mode-option {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  padding: 8px 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
  gap: 2px;
}

.mode-option:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.05);
}

.mode-option.active {
  color: var(--color-primary);
  background: rgba(var(--color-primary-rgb), 0.1);
}

.mode-name {
  font-size: 11px;
  letter-spacing: 1px;
  font-weight: 500;
}

.mode-desc {
  font-size: 9px;
  letter-spacing: 0.5px;
  opacity: 0.6;
}

.mode-option.active .mode-desc {
  opacity: 0.8;
}
</style>
