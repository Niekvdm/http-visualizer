<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { ChevronUp, ChevronDown } from 'lucide-vue-next'

const emit = defineEmits<{
  'open-editor': []
}>()

const envStore = useEnvironmentStore()

const isOpen = ref(false)

const activeEnv = computed(() => envStore.activeEnvironment)
const environments = computed(() => envStore.environments)

function selectEnvironment(envId: string) {
  envStore.setActiveEnvironment(envId)
  isOpen.value = false
}

function openEditor() {
  isOpen.value = false
  emit('open-editor')
}

function toggleDropdown() {
  isOpen.value = !isOpen.value
}

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.env-selector')) {
    isOpen.value = false
  }
}

// Add/remove click listener
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="env-selector relative">
    <!-- Trigger button - inline with other header buttons -->
    <button
      class="px-3 py-1 text-xs font-mono uppercase tracking-wider rounded transition-colors text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] flex items-center gap-1"
      @click.stop="toggleDropdown"
    >
      ENV: {{ activeEnv?.name || 'None' }} <component :is="isOpen ? ChevronUp : ChevronDown" class="w-3 h-3" />
    </button>

    <!-- Dropdown -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="isOpen"
        class="absolute top-full left-0 mt-1 min-w-[160px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded shadow-xl z-50 overflow-hidden"
      >
        <!-- Environment list -->
        <div class="max-h-[200px] overflow-y-auto">
          <button
            v-for="env in environments"
            :key="env.id"
            class="w-full px-3 py-1.5 text-left text-xs font-mono hover:bg-[var(--color-bg-tertiary)] transition-colors flex items-center gap-2"
            :class="[
              activeEnv?.id === env.id 
                ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]' 
                : 'text-[var(--color-text)]'
            ]"
            @click="selectEnvironment(env.id)"
          >
            <span 
              class="w-1.5 h-1.5 rounded-full shrink-0"
              :class="activeEnv?.id === env.id ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-text-dim)]'"
            />
            <span class="flex-1 truncate">{{ env.name }}</span>
          </button>
        </div>

        <!-- Divider -->
        <div class="border-t border-[var(--color-border)]" />

        <!-- Actions -->
        <button
          class="w-full px-3 py-1.5 text-left text-xs font-mono text-[var(--color-text-dim)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          @click="openEditor"
        >
          MANAGE...
        </button>
      </div>
    </Transition>
  </div>
</template>

