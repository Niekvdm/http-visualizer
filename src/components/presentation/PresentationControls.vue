<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePresentationStore } from '@/stores/presentationStore'
import type { PresentationMode } from '@/types'
import { ChevronDown, LayoutDashboard, Terminal, Settings, Check } from 'lucide-vue-next'

const presentationStore = usePresentationStore()

const showSettings = ref(false)

const modes: { id: PresentationMode; label: string; icon: typeof LayoutDashboard; description: string }[] = [
  { id: 'dialog', label: 'Dialog', icon: LayoutDashboard, description: 'Standard card-based flow' },
  { id: 'terminal', label: 'Terminal', icon: Terminal, description: 'Retro command-line style' },
]

const currentMode = computed(() => presentationStore.mode)
const isPresentationMode = computed(() => presentationStore.isPresentationMode)
const settings = computed(() => presentationStore.settings)

function selectMode(mode: PresentationMode) {
  presentationStore.setMode(mode)
}

function updateTypingSpeed(speed: number) {
  presentationStore.updateSettings({ typingSpeed: speed })
}

function updateAutoAdvanceDelay(delay: number) {
  presentationStore.updateSettings({ autoAdvanceDelay: delay })
}

function toggleAutoAdvance() {
  presentationStore.updateSettings({ autoAdvance: !settings.value.autoAdvance })
}

function toggleDramaticPauses() {
  presentationStore.updateSettings({ dramaticPauses: !settings.value.dramaticPauses })
}

function toggleJsonReveal() {
  presentationStore.updateSettings({ showJsonReveal: !settings.value.showJsonReveal })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Mode selector dropdown -->
    <div class="relative group">
      <button
        class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
        :class="[
          isPresentationMode
            ? 'bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] border-[var(--color-secondary)]/30'
            : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text)] border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
        ]"
      >
        <component :is="modes.find(m => m.id === currentMode)?.icon" class="w-5 h-5" />
        <span>{{ modes.find(m => m.id === currentMode)?.label }}</span>
        <ChevronDown class="w-4 h-4 opacity-50" />
      </button>

      <!-- Dropdown menu -->
      <div class="absolute top-full right-0 mt-1 w-56 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div class="p-2 space-y-1">
          <button
            v-for="mode in modes"
            :key="mode.id"
            class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors"
            :class="[
              currentMode === mode.id
                ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                : 'text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
            ]"
            @click="selectMode(mode.id)"
          >
            <component :is="mode.icon" class="w-5 h-5" />
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm">{{ mode.label }}</div>
              <div class="text-xs text-[var(--color-text-dim)] truncate">{{ mode.description }}</div>
            </div>
            <Check v-if="currentMode === mode.id" class="w-4 h-4 text-[var(--color-primary)]" />
          </button>
        </div>

        <!-- Settings toggle -->
        <div class="border-t border-[var(--color-border)] p-2">
          <button
            class="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
            @click.stop="showSettings = !showSettings"
          >
            <Settings class="w-4 h-4" />
            <span>Settings</span>
            <ChevronDown 
              class="w-4 h-4 ml-auto transition-transform" 
              :class="{ 'rotate-180': showSettings }"
            />
          </button>

          <!-- Settings panel -->
          <div 
            v-if="showSettings"
            class="mt-2 p-3 bg-[var(--color-bg-tertiary)] rounded-md space-y-3"
            @click.stop
          >
            <!-- Typing speed (terminal mode) -->
            <div>
              <label class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1 block">
                Typing Speed
              </label>
              <input
                type="range"
                min="20"
                max="150"
                :value="settings.typingSpeed"
                class="w-full accent-[var(--color-primary)]"
                @input="updateTypingSpeed(Number(($event.target as HTMLInputElement).value))"
              />
              <div class="text-xs text-[var(--color-text-dim)] text-center">
                {{ settings.typingSpeed }} chars/sec
              </div>
            </div>

            <!-- Auto advance delay -->
            <div>
              <label class="text-xs text-[var(--color-text-dim)] uppercase tracking-wider mb-1 block">
                Phase Delay
              </label>
              <input
                type="range"
                min="500"
                max="5000"
                step="500"
                :value="settings.autoAdvanceDelay"
                class="w-full accent-[var(--color-primary)]"
                @input="updateAutoAdvanceDelay(Number(($event.target as HTMLInputElement).value))"
              />
              <div class="text-xs text-[var(--color-text-dim)] text-center">
                {{ settings.autoAdvanceDelay / 1000 }}s
              </div>
            </div>

            <!-- Toggles -->
            <div class="space-y-2">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="settings.autoAdvance"
                  class="accent-[var(--color-primary)]"
                  @change="toggleAutoAdvance"
                />
                <span class="text-xs text-[var(--color-text)]">Auto-advance phases</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="settings.dramaticPauses"
                  class="accent-[var(--color-primary)]"
                  @change="toggleDramaticPauses"
                />
                <span class="text-xs text-[var(--color-text)]">Dramatic pauses</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="settings.showJsonReveal"
                  class="accent-[var(--color-primary)]"
                  @change="toggleJsonReveal"
                />
                <span class="text-xs text-[var(--color-text)]">Animate JSON reveal</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Presentation mode indicator -->
    <div 
      v-if="isPresentationMode"
      class="px-2 py-1 rounded text-xs font-medium bg-[var(--color-secondary)]/10 text-[var(--color-secondary)] border border-[var(--color-secondary)]/20"
    >
      PRESENTATION
    </div>
  </div>
</template>

