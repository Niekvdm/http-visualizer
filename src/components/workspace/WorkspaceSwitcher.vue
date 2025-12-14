<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { useEnvironmentStore } from '@/stores/environmentStore'
import { ChevronDown, Settings, Plus, Check } from 'lucide-vue-next'

const emit = defineEmits<{
  'open-manager': []
}>()

const workspaceStore = useWorkspaceStore()
const collectionStore = useCollectionStore()
const environmentStore = useEnvironmentStore()

const isDropdownOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const activeWorkspace = computed(() => workspaceStore.activeWorkspace)
const workspaces = computed(() => workspaceStore.workspaces)

// Handle click outside to close dropdown
function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value
}

function selectWorkspace(workspaceId: string) {
  if (workspaceId === workspaceStore.activeWorkspaceId) {
    isDropdownOpen.value = false
    return
  }

  // Save current workspace data before switching
  collectionStore.saveToStorage()
  environmentStore.saveToStorage()

  // Switch workspace
  workspaceStore.setActiveWorkspace(workspaceId)

  // Load new workspace data
  collectionStore.setCurrentWorkspaceId(workspaceId)
  collectionStore.loadForWorkspace(workspaceId)
  
  environmentStore.setCurrentWorkspaceId(workspaceId)
  environmentStore.loadForWorkspace(workspaceId)

  isDropdownOpen.value = false
}

function openManager() {
  isDropdownOpen.value = false
  emit('open-manager')
}
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <!-- Workspace Button -->
    <button
      class="w-full flex items-center gap-2 px-3 py-2.5 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg)] border-b border-[var(--color-border)] transition-colors group"
      @click="toggleDropdown"
    >
      <!-- Color indicator -->
      <div
        class="w-2.5 h-2.5 rounded-full shrink-0"
        :style="{ backgroundColor: activeWorkspace?.color || '#10b981' }"
      />
      
      <!-- Workspace name -->
      <span class="flex-1 text-left text-sm font-medium text-[var(--color-text)] truncate">
        {{ activeWorkspace?.name || 'Select Workspace' }}
      </span>
      
      <!-- Chevron -->
      <ChevronDown 
        class="w-4 h-4 text-[var(--color-text-dim)] transition-transform shrink-0"
        :class="{ 'rotate-180': isDropdownOpen }"
      />
    </button>

    <!-- Dropdown Menu -->
    <div
      v-if="isDropdownOpen"
      class="absolute top-full left-0 right-0 mt-0 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] border-t-0 rounded-b-lg shadow-xl z-50 overflow-hidden"
    >
      <!-- Workspace List -->
      <div class="max-h-64 overflow-y-auto">
        <button
          v-for="workspace in workspaces"
          :key="workspace.id"
          class="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-bg-tertiary)] transition-colors text-left"
          @click="selectWorkspace(workspace.id)"
        >
          <!-- Color indicator -->
          <div
            class="w-2 h-2 rounded-full shrink-0"
            :style="{ backgroundColor: workspace.color || '#10b981' }"
          />
          
          <!-- Workspace name -->
          <span 
            class="flex-1 text-sm truncate"
            :class="workspace.id === workspaceStore.activeWorkspaceId 
              ? 'text-[var(--color-primary)] font-medium' 
              : 'text-[var(--color-text)]'"
          >
            {{ workspace.name }}
          </span>
          
          <!-- Active indicator -->
          <Check 
            v-if="workspace.id === workspaceStore.activeWorkspaceId"
            class="w-4 h-4 text-[var(--color-primary)] shrink-0" 
          />
        </button>
      </div>

      <!-- Divider -->
      <div class="border-t border-[var(--color-border)]" />

      <!-- Actions -->
      <div class="p-1">
        <button
          class="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-[var(--color-bg-tertiary)] transition-colors text-left"
          @click="openManager"
        >
          <Settings class="w-4 h-4 text-[var(--color-text-dim)]" />
          <span class="text-sm text-[var(--color-text-dim)]">Manage Workspaces</span>
        </button>
      </div>
    </div>
  </div>
</template>
