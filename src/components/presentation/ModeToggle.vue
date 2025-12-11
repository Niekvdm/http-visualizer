<script setup lang="ts">
import { computed } from 'vue'
import { usePresentationStore } from '@/stores/presentationStore'
import type { PresentationMode } from '@/types'

const presentationStore = usePresentationStore()

const mode = computed(() => presentationStore.mode)

function setMode(newMode: PresentationMode) {
  presentationStore.setMode(newMode)
}
</script>

<template>
  <div class="absolute top-3 right-3 z-20">
    <div class="relative group">
      <button class="mode-toggle-btn">
        {{ mode === 'terminal' ? 'TERMINAL' : 'DIALOG' }}
      </button>

      <!-- Dropdown -->
      <div class="mode-dropdown absolute top-full right-0 mt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
        <button
          class="mode-option"
          :class="{ active: mode === 'dialog' }"
          @click="setMode('dialog')"
        >
          DIALOG
        </button>
        <button
          class="mode-option"
          :class="{ active: mode === 'terminal' }"
          @click="setMode('terminal')"
        >
          TERMINAL
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
  background: rgba(10, 10, 10, 0.9);
  padding: 4px 0;
}

.mode-option {
  display: block;
  width: 100%;
  background: transparent;
  border: none;
  color: var(--color-text-dim);
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 11px;
  letter-spacing: 1px;
  padding: 6px 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}

.mode-option:hover {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.05);
}

.mode-option.active {
  color: var(--color-primary);
}
</style>

